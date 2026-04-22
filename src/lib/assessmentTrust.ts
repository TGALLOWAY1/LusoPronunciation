import type { AttemptScore } from '@/types/pronunciation';

export type TrustLevel = 'trusted' | 'degraded' | 'untrusted';

const UNTRUSTED_COMPLETENESS_FLOOR = 40;
const DEGRADED_COMPLETENESS_FLOOR = 70;
const UNTRUSTED_MISSING_RATIO = 0.5;
const DEGRADED_MISSING_RATIO = 0.25;

function missingWordRatio(attempt: AttemptScore): number {
  const total = attempt.wordScores.length;
  if (total === 0) return 1;
  const missing = attempt.wordScores.filter(
    (w) => w.errorType === 'omitted' || w.errorType === 'extra'
  ).length;
  return missing / total;
}

/**
 * Classify how trustworthy an assessment is so the UI can decide whether to
 * show phoneme-level coaching. Returns one of:
 *
 * - 'untrusted': RecognitionStatus failed, audio was mostly silence, or most
 *   words were reported as Omission/Insertion — phoneme details would mislead.
 * - 'degraded': Mapping succeeded but completeness or word match is weak;
 *   phoneme coaching is shown with a caveat.
 * - 'trusted': Normal path; no caveat needed.
 */
export function computeTrustLevel(attempt: AttemptScore): TrustLevel {
  const status = attempt.recognitionStatus;
  if (status && status !== 'Success') return 'untrusted';

  const completeness = attempt.completeness;
  const ratio = missingWordRatio(attempt);

  if (
    (completeness !== undefined && completeness < UNTRUSTED_COMPLETENESS_FLOOR) ||
    ratio >= UNTRUSTED_MISSING_RATIO
  ) {
    return 'untrusted';
  }

  if (
    (completeness !== undefined && completeness < DEGRADED_COMPLETENESS_FLOOR) ||
    ratio >= DEGRADED_MISSING_RATIO
  ) {
    return 'degraded';
  }

  return 'trusted';
}

export function getTrustMessage(level: TrustLevel): string | null {
  if (level === 'untrusted') {
    return "We couldn't score this recording reliably. Try again in a quieter room and make sure you read the whole sentence.";
  }
  if (level === 'degraded') {
    return 'Parts of this recording were hard to score. Phoneme tips below may be less accurate than usual.';
  }
  return null;
}
