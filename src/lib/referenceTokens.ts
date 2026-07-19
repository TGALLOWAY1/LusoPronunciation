/**
 * Shared helpers for reasoning about the reference text of a pronunciation
 * attempt (the sentence or word the learner was asked to say).
 *
 * A "token" here is a run of letters/numbers, matching how the Azure normalizer
 * counts reference tokens. Single-token references (i.e. individual words) make
 * Azure's fluency / completeness / prosody metrics degenerate — completeness is
 * effectively all-or-nothing and fluency/prosody have no rhythm to measure — so
 * callers use these helpers to suppress those metrics and any coaching derived
 * from them.
 */

/** Counts letter/number tokens in a reference string. */
export function countReferenceTokens(referenceText: string | undefined | null): number {
  if (!referenceText) return 0;
  return Array.from(referenceText.matchAll(/[\p{L}\p{N}]+/gu)).length;
}

/**
 * True when the reference is a single word/token, where fluency, completeness,
 * and prosody are degenerate and should not be shown or coached.
 */
export function isSingleTokenReference(referenceText: string | undefined | null): boolean {
  return countReferenceTokens(referenceText) === 1;
}
