/**
 * Per-token pronunciation coverage for the Custom Sentence Builder.
 *
 * Resolution strategy (tried in order):
 *   1. exact_match   curated masterWords hit on the token's normalized form
 *   2. lemma_match   curated masterWords hit on any candidate lemma
 *   3. generated     phonemeMapper produced a phoneme sequence
 *   4. unresolved    fallback generation returned no phonemes
 *
 * The resolver NEVER throws on lookup failure — every token gets a best-
 * effort result. The caller derives sentence-level status from the
 * aggregated `TokenConfidence` bucket.
 */

import type {
  CustomSentenceTokenDto,
  TokenConfidence,
  TokenResolutionType,
} from '../../shared/types/customSentence';
import { confidenceForResolution } from '../../shared/customSentenceConfidence';
import { findMasterWordByNormalized } from '../lib/masterWordIndex';
import { candidateLemmas } from './lemmaNormalizer';
import { generatePronunciation } from './generatedPronunciationService';
import type { SentenceToken } from './sentenceTokenizer';

const LOG_TAG = '[PronunciationResolver]';

export interface ResolvedCoverage {
  tokens: CustomSentenceTokenDto[];
  counts: Record<TokenResolutionType, number>;
}

/**
 * Resolves a single token's pronunciation coverage. Safe to call standalone
 * (public API per the feature spec). Never throws; worst case returns an
 * "unresolved" token with low confidence.
 */
export async function resolveTokenPronunciation(
  token: SentenceToken
): Promise<CustomSentenceTokenDto> {
  // Stage 1: exact curated match
  try {
    const exact = await findMasterWordByNormalized(token.normalizedForm);
    if (exact) {
      return buildToken(token, 'exact_match', { wordEntryId: exact.id });
    }
  } catch (err) {
    console.warn(`${LOG_TAG} exact lookup failed for "${token.surfaceForm}":`, err);
  }

  // Stage 2: lemma match
  try {
    for (const candidate of candidateLemmas(token.normalizedForm)) {
      const match = await findMasterWordByNormalized(candidate);
      if (match) {
        return buildToken(token, 'lemma_match', { wordEntryId: match.id });
      }
    }
  } catch (err) {
    console.warn(`${LOG_TAG} lemma lookup failed for "${token.surfaceForm}":`, err);
  }

  // Stage 3+4: fallback generation (generated | unresolved)
  try {
    const generated = await generatePronunciation(token.surfaceForm);
    return buildToken(token, generated.resolutionType, {
      generatedPronunciationId: generated.id,
    });
  } catch (err) {
    console.warn(
      `${LOG_TAG} generation failed for "${token.surfaceForm}":`,
      err instanceof Error ? err.message : err
    );
    // Best-effort: keep the token resolved as "unresolved" with no refs.
    // Validation will reject this, so we also surface it here so the
    // orchestrator can skip persistence and return an error to the user.
    return buildToken(token, 'unresolved', {});
  }
}

export async function resolvePronunciationCoverage(
  sentenceTokens: SentenceToken[]
): Promise<ResolvedCoverage> {
  // Resolution is per-token and independent (curated lookups are in-memory;
  // generated-pronunciation upserts are atomic at the Mongo level). Running
  // them in parallel cuts multi-word sentence latency roughly in half for
  // any sentence that has more than 1-2 uncached fallbacks.
  const tokens = await Promise.all(
    sentenceTokens.map((t) => resolveTokenPronunciation(t))
  );

  const counts: Record<TokenResolutionType, number> = {
    exact_match: 0,
    lemma_match: 0,
    generated: 0,
    unresolved: 0,
  };
  tokens.forEach((t) => {
    counts[t.resolutionType] += 1;
  });

  console.log(
    `${LOG_TAG} resolved ${sentenceTokens.length} tokens —` +
      ` exact=${counts.exact_match} lemma=${counts.lemma_match}` +
      ` generated=${counts.generated} unresolved=${counts.unresolved}`
  );

  return { tokens, counts };
}

function buildToken(
  token: SentenceToken,
  resolutionType: TokenResolutionType,
  refs: { wordEntryId?: string; generatedPronunciationId?: string }
): CustomSentenceTokenDto {
  const confidence: TokenConfidence = confidenceForResolution(resolutionType);
  return {
    position: token.position,
    surfaceForm: token.surfaceForm,
    normalizedForm: token.normalizedForm,
    resolutionType,
    wordEntryId: refs.wordEntryId,
    generatedPronunciationId: refs.generatedPronunciationId,
    confidence,
  };
}
