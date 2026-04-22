/**
 * Orchestrates the Custom Sentence Builder ingestion pipeline:
 *
 *   1. translateEnglishToPortuguese
 *   2. normalizePortugueseSentence
 *   3. generatePortugueseTTS
 *   4. tokenizeSentence
 *   5. resolvePronunciationCoverage   (curated-only for now)
 *   6. persist CustomSentence document
 *
 * Exposed as `createCustomSentence({ englishText, userId })` so the route
 * handler can call it directly. Each stage emits a structured console log
 * for observability; failures bubble up with context and are translated to
 * HTTP error codes by the route.
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

const LOG_TAG = '[CustomSentenceService]';
const MAX_ENGLISH_LENGTH = 500;

export class CustomSentenceError extends Error {
  readonly code:
    | 'INVALID_INPUT'
    | 'TRANSLATION_FAILED'
    | 'TTS_FAILED'
    | 'PERSISTENCE_FAILED';
  readonly cause?: unknown;

  constructor(
    code: CustomSentenceError['code'],
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = 'CustomSentenceError';
    this.code = code;
    this.cause = cause;
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

  console.log(`${LOG_TAG} start userId=${userId} chars=${englishText.length}`);

  // Stage 1: translate
  let translation;
  try {
    translation = await translateEnglishToPortuguese(englishText);
  } catch (err) {
    throw new CustomSentenceError(
      'TRANSLATION_FAILED',
      'Failed to translate sentence',
      err
    );
  }

  // Stage 2: normalize
  const normalization = normalizePortugueseSentence(translation.textPt);
  const targetTextPt = normalization.text;
  const normalizedTextPt = normalizeTokenForm(targetTextPt)
    || targetTextPt.toLowerCase();

  // Stage 4 (re-ordered before TTS to preserve logical flow, but both are
  // independent of each other — tokens feed into persistence below):
  const sentenceTokens = tokenizeSentence(targetTextPt);

  // Stage 5: pronunciation coverage (curated lookup only)
  const coverage = await resolvePronunciationCoverage(sentenceTokens);
  const status = deriveStatus(coverage.tokens);

  // Stage 3: TTS — do it after translate/normalize so the synthesized audio
  // matches the final displayed text. We allocate the Mongo _id up front so
  // the audio file name is stable before the document is written.
  const sentenceObjectId = new mongoose.Types.ObjectId();
  let tts;
  try {
    tts = await generatePortugueseTTS({
      text: targetTextPt,
      userId,
      sentenceId: sentenceObjectId.toHexString(),
    });
  } catch (err) {
    throw new CustomSentenceError('TTS_FAILED', 'Failed to generate TTS audio', err);
  }

  // Stage 6: persist
  let doc: ICustomSentenceDocument;
  try {
    doc = await CustomSentenceModel.create({
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
  } catch (err) {
    // Best-effort cleanup of the orphaned WAV so we don't leak disk on failed
    // persistence. Swallow secondary errors; the primary error is what matters.
    await deleteCustomAudio(userId, sentenceObjectId.toHexString());
    throw new CustomSentenceError(
      'PERSISTENCE_FAILED',
      'Failed to save custom sentence',
      err
    );
  }

  const sentence = toCustomSentenceDto(doc);
  console.log(
    `${LOG_TAG} done id=${sentence.id} status=${status} tokens=${sentence.tokens.length} curated=${coverage.curatedHits} unresolved=${coverage.unresolved}`
  );

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
      wordEntryId: t.wordEntryId,
      confidence: t.confidence,
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
