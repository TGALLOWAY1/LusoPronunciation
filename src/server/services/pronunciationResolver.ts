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
      return buildToken(token, 'exact_match', 'high', { wordEntryId: exact.id });
    }
  } catch (err) {
    console.warn(`${LOG_TAG} exact lookup failed for "${token.surfaceForm}":`, err);
  }

  // Stage 2: lemma match
  try {
    for (const candidate of candidateLemmas(token.normalizedForm)) {
      const match = await findMasterWordByNormalized(candidate);
      if (match) {
        return buildToken(token, 'lemma_match', 'high', { wordEntryId: match.id });
      }
    }
  } catch (err) {
    console.warn(`${LOG_TAG} lemma lookup failed for "${token.surfaceForm}":`, err);
  }

  // Stage 3+4: fallback generation (generated | unresolved)
  try {
    const generated = await generatePronunciation(token.surfaceForm);
    const confidence: TokenConfidence =
      generated.resolutionType === 'generated' ? 'medium' : 'low';
    return buildToken(token, generated.resolutionType, confidence, {
      generatedPronunciationId: generated.id,
    });
  } catch (err) {
    console.warn(
      `${LOG_TAG} generation failed for "${token.surfaceForm}":`,
      err instanceof Error ? err.message : err
    );
    return buildToken(token, 'unresolved', 'low', {});
  }
}

export async function resolvePronunciationCoverage(
  sentenceTokens: SentenceToken[]
): Promise<ResolvedCoverage> {
  const tokens: CustomSentenceTokenDto[] = [];
  const counts: Record<TokenResolutionType, number> = {
    exact_match: 0,
    lemma_match: 0,
    generated: 0,
    unresolved: 0,
  };

  for (const token of sentenceTokens) {
    const resolved = await resolveTokenPronunciation(token);
    tokens.push(resolved);
    counts[resolved.resolutionType] += 1;
  }

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
  confidence: TokenConfidence,
  refs: { wordEntryId?: string; generatedPronunciationId?: string }
): CustomSentenceTokenDto {
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
