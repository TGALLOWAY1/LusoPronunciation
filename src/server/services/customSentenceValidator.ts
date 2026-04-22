/**
 * Invariant checks run right before a CustomSentence is persisted.
 *
 * The resolver is responsible for producing best-effort tokens; the validator
 * enforces the trust rules the rest of the system relies on:
 *
 *   - Every token has SOME pronunciation reference (curated word entry OR
 *     a generated_pronunciation id). A token with neither would slip past
 *     the UI silently.
 *   - A token's confidence matches its resolutionType. High-confidence
 *     tokens MUST come from curated data (wordEntryId present). We never
 *     fake high confidence from heuristic output.
 *   - The TTS audio on disk is the same text we're persisting, the file
 *     exists, and it's non-trivial in size (a 0-byte wav would play as
 *     silence and mislead the learner).
 *
 * Any violation throws a ValidationError with structured details so the
 * orchestrator can log it and fail the request cleanly — the outside world
 * never sees a half-valid sentence.
 */

import { promises as fs } from 'fs';
import type {
  CustomSentenceTokenDto,
  TokenResolutionType,
} from '../../shared/types/customSentence';
import { confidenceForResolution } from '../../shared/customSentenceConfidence';

const MIN_TTS_BYTES = 512;

export type ValidationCode =
  | 'COVERAGE_INVARIANT'
  | 'CONFIDENCE_INVARIANT'
  | 'TTS_INVARIANT';

export class CustomSentenceValidationError extends Error {
  readonly code: ValidationCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ValidationCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CustomSentenceValidationError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Every token must reference either a curated word entry or a generated
 * pronunciation cache record. Tokens with neither are silent failures.
 */
export function validateTokenCoverage(tokens: CustomSentenceTokenDto[]): void {
  tokens.forEach((token) => {
    const hasCurated = typeof token.wordEntryId === 'string' && token.wordEntryId.length > 0;
    const hasGenerated =
      typeof token.generatedPronunciationId === 'string' &&
      token.generatedPronunciationId.length > 0;

    if (!hasCurated && !hasGenerated) {
      throw new CustomSentenceValidationError(
        'COVERAGE_INVARIANT',
        `token "${token.surfaceForm}" at position ${token.position} has no pronunciation reference`,
        { position: token.position, surfaceForm: token.surfaceForm }
      );
    }
  });
}

/**
 * Confidence must match resolutionType, and "high" must always be backed
 * by curated data. This prevents a bug in the resolver (or future refactor)
 * from quietly shipping low-quality data with a misleading "high" badge.
 */
export function validateConfidenceInvariants(
  tokens: CustomSentenceTokenDto[]
): void {
  tokens.forEach((token) => {
    const expected = confidenceForResolution(token.resolutionType);
    if (token.confidence !== expected) {
      throw new CustomSentenceValidationError(
        'CONFIDENCE_INVARIANT',
        `token "${token.surfaceForm}" confidence=${token.confidence} does not match resolutionType=${token.resolutionType}`,
        {
          position: token.position,
          surfaceForm: token.surfaceForm,
          expectedConfidence: expected,
          actualConfidence: token.confidence,
          resolutionType: token.resolutionType,
        }
      );
    }

    if (token.confidence === 'high' && !token.wordEntryId) {
      throw new CustomSentenceValidationError(
        'CONFIDENCE_INVARIANT',
        `token "${token.surfaceForm}" is high-confidence but has no wordEntryId`,
        {
          position: token.position,
          surfaceForm: token.surfaceForm,
          resolutionType: token.resolutionType,
        }
      );
    }

    if (
      (token.resolutionType === 'exact_match' ||
        token.resolutionType === 'lemma_match') &&
      !token.wordEntryId
    ) {
      throw new CustomSentenceValidationError(
        'CONFIDENCE_INVARIANT',
        `token "${token.surfaceForm}" resolution=${token.resolutionType} requires a wordEntryId`,
        { position: token.position, surfaceForm: token.surfaceForm }
      );
    }

    if (
      (token.resolutionType === 'generated' ||
        token.resolutionType === 'unresolved') &&
      !token.generatedPronunciationId
    ) {
      throw new CustomSentenceValidationError(
        'CONFIDENCE_INVARIANT',
        `token "${token.surfaceForm}" resolution=${token.resolutionType} requires a generatedPronunciationId`,
        { position: token.position, surfaceForm: token.surfaceForm }
      );
    }
  });
}

export interface TtsValidationInput {
  /** Text passed to the TTS engine. */
  ttsText: string;
  /** Text we're about to persist on the sentence document. */
  persistedText: string;
  /** Absolute path of the WAV on disk. */
  audioAbsolutePath: string;
  /** Minimum byte size for a sane TTS output. */
  minBytes?: number;
}

/**
 * Verifies the audio that will be shipped to the client was synthesized for
 * the same text we're persisting, and that the file looks like a real WAV
 * (non-zero, above a sanity-threshold).
 */
export async function validateTtsOutput(
  input: TtsValidationInput
): Promise<void> {
  if (input.ttsText !== input.persistedText) {
    throw new CustomSentenceValidationError(
      'TTS_INVARIANT',
      'TTS text does not match the text being persisted',
      {
        ttsTextLength: input.ttsText.length,
        persistedTextLength: input.persistedText.length,
      }
    );
  }

  const minBytes = input.minBytes ?? MIN_TTS_BYTES;
  let stat;
  try {
    stat = await fs.stat(input.audioAbsolutePath);
  } catch (err: unknown) {
    throw new CustomSentenceValidationError(
      'TTS_INVARIANT',
      `TTS audio file is missing at ${input.audioAbsolutePath}`,
      { code: (err as NodeJS.ErrnoException).code }
    );
  }

  if (!stat.isFile()) {
    throw new CustomSentenceValidationError(
      'TTS_INVARIANT',
      `TTS path is not a regular file: ${input.audioAbsolutePath}`
    );
  }
  if (stat.size < minBytes) {
    throw new CustomSentenceValidationError(
      'TTS_INVARIANT',
      `TTS audio too small (${stat.size} bytes < ${minBytes})`,
      { size: stat.size, minBytes }
    );
  }
}

/**
 * Summarises token coverage for logging. Safe to call before or after
 * validation — it does not throw.
 */
export function summarizeCoverage(
  tokens: CustomSentenceTokenDto[]
): Record<TokenResolutionType, number> & { total: number } {
  const counts: Record<TokenResolutionType, number> = {
    exact_match: 0,
    lemma_match: 0,
    generated: 0,
    unresolved: 0,
  };
  tokens.forEach((t) => {
    counts[t.resolutionType] += 1;
  });
  return { ...counts, total: tokens.length };
}
