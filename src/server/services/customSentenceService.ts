/**
 * Orchestrates the Custom Sentence Builder ingestion pipeline:
 *
 *   1. translateEnglishToPortuguese
 *   2. normalizePortugueseSentence
 *   3. tokenizeSentence
 *   4. resolvePronunciationCoverage      exact → lemma → generated → unresolved
 *   5. generatePortugueseTTS
 *   6. validate (coverage / confidence / TTS-vs-text)
 *   7. persist CustomSentence document
 *
 * Every stage is wrapped in `timeStage` so production logs show per-stage
 * latency plus token coverage counts. The validator in stage 6 enforces the
 * trust invariants (no silent "high-confidence" data, no orphan tokens, no
 * mismatched TTS output) and a failure there cleans up the orphaned WAV
 * before re-throwing.
 */

import mongoose from 'mongoose';
import {
  CustomSentenceModel,
  type ICustomSentenceDocument,
} from '../models/CustomSentenceModel';
import type {
  CustomSentenceDto,
  CustomSentenceStatus,
  CustomSentenceTokenDto,
} from '../../shared/types/customSentence';
import { translateEnglishToPortuguese } from './translationService';
import { normalizePortugueseSentence } from './sentenceNormalizer';
import { generatePortugueseTTS } from './portugueseTTSService';
import {
  tokenizeSentence,
  normalizeTokenForm,
} from './sentenceTokenizer';
import { resolvePronunciationCoverage } from './pronunciationResolver';
import { deleteCustomAudio } from './customAudioStorage';
import {
  CustomSentenceValidationError,
  summarizeCoverage,
  validateConfidenceInvariants,
  validateTokenCoverage,
  validateTtsOutput,
} from './customSentenceValidator';
import { recordUnknownWordObservations } from './unknownWordObservationService';
import { logStage, timeStage } from '../lib/pipelineLogger';

const PIPELINE = 'custom-sentence';
const MAX_ENGLISH_LENGTH = 500;

export class CustomSentenceError extends Error {
  readonly code:
    | 'INVALID_INPUT'
    | 'TRANSLATION_FAILED'
    | 'TTS_FAILED'
    | 'VALIDATION_FAILED'
    | 'PERSISTENCE_FAILED';
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CustomSentenceError['code'],
    message: string,
    cause?: unknown,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CustomSentenceError';
    this.code = code;
    this.cause = cause;
    this.details = details;
  }
}

export interface CreateCustomSentenceParams {
  englishText: string;
  userId: string;
}

export interface CreateCustomSentenceResult {
  sentence: CustomSentenceDto;
  tokens: CustomSentenceTokenDto[];
  audioUrl: string;
  status: CustomSentenceStatus;
}

export async function createCustomSentence(
  params: CreateCustomSentenceParams
): Promise<CreateCustomSentenceResult> {
  const { userId } = params;
  const englishText = (params.englishText ?? '').trim();

  if (!englishText) {
    throw new CustomSentenceError('INVALID_INPUT', 'englishText is required');
  }
  if (englishText.length > MAX_ENGLISH_LENGTH) {
    throw new CustomSentenceError(
      'INVALID_INPUT',
      `englishText exceeds ${MAX_ENGLISH_LENGTH} character limit`
    );
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new CustomSentenceError('INVALID_INPUT', 'userId is invalid');
  }

  const sentenceObjectId = new mongoose.Types.ObjectId();
  const sentenceId = sentenceObjectId.toHexString();

  logStage({
    pipeline: PIPELINE,
    stage: 'start',
    userId,
    sentenceId,
    data: { englishLength: englishText.length },
  });

  // Stage 1: translate ──────────────────────────────────────────────
  let translation;
  try {
    translation = await timeStage(
      { pipeline: PIPELINE, stage: 'translate', userId, sentenceId },
      () => translateEnglishToPortuguese(englishText)
    );
  } catch (err) {
    throw new CustomSentenceError(
      'TRANSLATION_FAILED',
      'Failed to translate sentence',
      err
    );
  }

  // Stage 2: normalize ──────────────────────────────────────────────
  const normalization = normalizePortugueseSentence(translation.textPt);
  const targetTextPt = normalization.text;
  const normalizedTextPt =
    normalizeTokenForm(targetTextPt) || targetTextPt.toLowerCase();

  logStage({
    pipeline: PIPELINE,
    stage: 'normalize',
    userId,
    sentenceId,
    data: {
      chars: targetTextPt.length,
      changed: normalization.changed,
    },
  });

  // Stage 3: tokenize ───────────────────────────────────────────────
  const sentenceTokens = tokenizeSentence(targetTextPt);
  logStage({
    pipeline: PIPELINE,
    stage: 'tokenize',
    userId,
    sentenceId,
    data: { tokens: sentenceTokens.length },
  });

  // Stage 4: resolve pronunciation coverage ─────────────────────────
  const coverage = await timeStage(
    { pipeline: PIPELINE, stage: 'resolve', userId, sentenceId },
    () => resolvePronunciationCoverage(sentenceTokens)
  );

  const unknownTokens = coverage.tokens.filter(
    (t) => t.resolutionType === 'unresolved'
  );
  const fallbackTokens = coverage.tokens.filter(
    (t) =>
      t.resolutionType === 'generated' || t.resolutionType === 'unresolved'
  );
  if (unknownTokens.length > 0) {
    logStage({
      pipeline: PIPELINE,
      stage: 'resolve.unknown',
      userId,
      sentenceId,
      level: 'warn',
      data: {
        unknown: unknownTokens.map((t) => t.surfaceForm),
      },
    });
  }
  if (fallbackTokens.length > 0) {
    logStage({
      pipeline: PIPELINE,
      stage: 'resolve.fallback',
      userId,
      sentenceId,
      data: {
        fallbacks: fallbackTokens.length,
        generated: coverage.counts.generated,
        unresolved: coverage.counts.unresolved,
      },
    });
  }

  const status = deriveStatus(coverage.tokens);

  // Stage 5: TTS ────────────────────────────────────────────────────
  let tts;
  try {
    tts = await timeStage(
      { pipeline: PIPELINE, stage: 'tts', userId, sentenceId },
      () =>
        generatePortugueseTTS({
          text: targetTextPt,
          userId,
          sentenceId,
        })
    );
  } catch (err) {
    throw new CustomSentenceError(
      'TTS_FAILED',
      'Failed to generate TTS audio',
      err
    );
  }

  // Stage 6: validate ───────────────────────────────────────────────
  try {
    await timeStage(
      { pipeline: PIPELINE, stage: 'validate', userId, sentenceId },
      async () => {
        validateTokenCoverage(coverage.tokens);
        validateConfidenceInvariants(coverage.tokens);
        await validateTtsOutput({
          ttsText: targetTextPt,
          persistedText: targetTextPt,
          audioAbsolutePath: tts.absolutePath,
        });
      }
    );
  } catch (err) {
    // Clean up the orphaned WAV so we don't keep disk state that doesn't
    // correspond to any document.
    await deleteCustomAudio(userId, sentenceId);
    if (err instanceof CustomSentenceValidationError) {
      throw new CustomSentenceError(
        'VALIDATION_FAILED',
        `Pipeline validation failed: ${err.code}`,
        err,
        err.details
      );
    }
    throw new CustomSentenceError(
      'VALIDATION_FAILED',
      'Pipeline validation failed',
      err
    );
  }

  // Stage 7: persist ────────────────────────────────────────────────
  let doc: ICustomSentenceDocument;
  try {
    doc = await timeStage(
      { pipeline: PIPELINE, stage: 'persist', userId, sentenceId },
      async () => {
        const draft = new CustomSentenceModel({
          _id: sentenceObjectId,
          userId: new mongoose.Types.ObjectId(userId),
          sourceTextEn: englishText,
          targetTextPt,
          normalizedTextPt,
          locale: 'pt-BR',
          ttsAudioUrl: tts.audioUrl,
          status,
          translationProvider: translation.provider,
          translationConfidence: translation.confidence,
          tokens: coverage.tokens,
        });
        return draft.save();
      }
    );
  } catch (err) {
    await deleteCustomAudio(userId, sentenceId);
    throw new CustomSentenceError(
      'PERSISTENCE_FAILED',
      'Failed to save custom sentence',
      err
    );
  }

  const sentence = toCustomSentenceDto(doc);

  // Best-effort: record unknown-word observations for the lexicon expansion
  // pipeline. This never blocks the sentence response.
  await recordUnknownWordObservations({
    userId,
    sentenceId: sentence.id,
    contextText: targetTextPt,
    tokens: coverage.tokens,
  });

  logStage({
    pipeline: PIPELINE,
    stage: 'done',
    userId,
    sentenceId: sentence.id,
    data: {
      status,
      ...summarizeCoverage(coverage.tokens),
    },
  });

  return {
    sentence,
    tokens: sentence.tokens,
    audioUrl: sentence.ttsAudioUrl,
    status,
  };
}

export function deriveStatus(
  tokens: CustomSentenceTokenDto[]
): CustomSentenceStatus {
  if (tokens.length === 0) {
    return 'needs_review';
  }
  const hasLow = tokens.some((t) => t.confidence === 'low');
  const hasMedium = tokens.some((t) => t.confidence === 'medium');
  if (hasLow) {
    return 'needs_review';
  }
  if (hasMedium) {
    return 'partial_support';
  }
  return 'ready';
}

export function toCustomSentenceDto(
  doc: ICustomSentenceDocument
): CustomSentenceDto {
  return {
    id: doc._id.toHexString(),
    userId: doc.userId.toHexString(),
    sourceTextEn: doc.sourceTextEn,
    targetTextPt: doc.targetTextPt,
    normalizedTextPt: doc.normalizedTextPt,
    locale: doc.locale,
    ttsAudioUrl: doc.ttsAudioUrl,
    status: doc.status,
    tokens: doc.tokens.map((t) => ({
      position: t.position,
      surfaceForm: t.surfaceForm,
      normalizedForm: t.normalizedForm,
      resolutionType: t.resolutionType,
      wordEntryId: t.wordEntryId,
      generatedPronunciationId: t.generatedPronunciationId?.toHexString(),
      confidence: t.confidence,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
