/**
 * Resolves per-token pronunciation coverage for a Custom Sentence.
 *
 * For this prompt we only implement the curated-word path:
 *   - If a token matches a `data/masterWords.json` entry by normalized form
 *     (`normalizedTokenForm`), confidence is 'high' and `wordEntryId` is set.
 *   - Otherwise confidence is 'low' (no fallback yet — phoneme generation
 *     lands in a later prompt).
 *
 * The separate derived status ('ready' | 'partial_support' | 'needs_review')
 * is computed by the caller so the resolver stays a pure data transform.
 */

import type {
  CustomSentenceTokenDto,
  TokenConfidence,
} from '../../shared/types/customSentence';
import { findMasterWordByNormalized } from '../lib/masterWordIndex';
import type { SentenceToken } from './sentenceTokenizer';

const LOG_TAG = '[PronunciationResolver]';

export interface ResolvedCoverage {
  tokens: CustomSentenceTokenDto[];
  curatedHits: number;
  unresolved: number;
}

export async function resolvePronunciationCoverage(
  sentenceTokens: SentenceToken[]
): Promise<ResolvedCoverage> {
  const tokens: CustomSentenceTokenDto[] = [];
  let curatedHits = 0;
  let unresolved = 0;

  for (const token of sentenceTokens) {
    const match = await findMasterWordByNormalized(token.normalizedForm);
    const confidence: TokenConfidence = match ? 'high' : 'low';

    if (match) {
      curatedHits += 1;
    } else {
      unresolved += 1;
    }

    tokens.push({
      position: token.position,
      surfaceForm: token.surfaceForm,
      normalizedForm: token.normalizedForm,
      wordEntryId: match?.id,
      confidence,
    });
  }

  console.log(
    `${LOG_TAG} resolved ${sentenceTokens.length} tokens — curated=${curatedHits}, unresolved=${unresolved}`
  );

  return { tokens, curatedHits, unresolved };
}
