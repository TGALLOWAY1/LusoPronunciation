/**
 * Shared score-interpretation copy for the pronunciation summary components.
 *
 * Deduplicated from AttemptScoreSummary and PhraseScoreOverview, which each used
 * to hard-code the same messages — including a "smooth out your fluency" remark
 * shown at every 80-89 score regardless of the learner's actual fluency. Here the
 * fluency remark is conditional on the real fluency score, and threshold language
 * is softened to score bands rather than hard cutoffs.
 */

export interface ScoreFeedbackInput {
  /** The composite/overall score being interpreted (0-100). */
  overall: number;
  /** Azure accuracy score, when known, used to decide if fluency is lagging. */
  accuracy?: number | null;
  /**
   * Azure fluency score, when known. A fluency remark is only surfaced when
   * fluency is materially below accuracy (i.e. genuinely the weak dimension).
   */
  fluency?: number | null;
}

/** Fluency counts as "materially below accuracy" at this gap (points). */
const FLUENCY_LAG_THRESHOLD = 8;

/**
 * Returns a concise, honest interpretation of an attempt's overall score.
 * The 80-89 band only mentions fluency when the learner's fluency actually
 * trails their accuracy; otherwise it points at the highlighted sounds.
 */
export function getScoreFeedbackMessage({ overall, accuracy, fluency }: ScoreFeedbackInput): string {
  const fluencyLags =
    typeof fluency === 'number' &&
    typeof accuracy === 'number' &&
    fluency <= accuracy - FLUENCY_LAG_THRESHOLD;

  if (overall >= 90) {
    return "Excellent pronunciation — you're sounding very natural.";
  }
  if (overall >= 80) {
    return fluencyLags
      ? 'Strong overall — smoothing out your fluency will push it higher.'
      : 'Strong overall — a little polish on the highlighted sounds will push it higher.';
  }
  if (overall >= 70) {
    return 'Good base — a bit more practice will clean up some of the sounds.';
  }
  return 'Keep going — listen closely to the reference audio and repeat slowly.';
}
