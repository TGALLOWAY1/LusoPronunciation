import { useMemo } from 'react';
import { Activity, ArrowDown, CheckCircle2, Info, Target, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AttemptScore } from '@/types/pronunciation';
import type { WordFeedback } from '@/types/pronunciationFixtures';
import PhraseTrendSparkline from './PhraseTrendSparkline';

interface PhraseScoreOverviewProps {
  attemptScore: AttemptScore;
  words?: WordFeedback[];
  onWordSelected?: (word: WordFeedback) => void;
  // onPracticeWord removed - practice functionality will be on dedicated Practice Words page
}

/**
 * Metric descriptions for tooltips.
 */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  overall: 'Combined pronunciation score across accuracy, fluency, completeness, and prosody.',
  accuracy: 'How closely the pronunciation of individual sounds and words matches the target.',
  fluency: 'Smoothness and rhythm of speech, including pauses and hesitations.',
  completeness: 'How fully the user pronounced all expected words in the sentence.',
  prosody: 'Naturalness of intonation, stress, and overall speech melody.',
};

/**
 * Gets the description for a metric.
 */
function getMetricDescription(metric: string): string {
  return METRIC_DESCRIPTIONS[metric.toLowerCase()] || '';
}

/**
 * Fixed visual identity per metric: icon, badge tint, and bar fill.
 * Colors are consistent per metric (not score-based) so rows stay scannable.
 */
const METRIC_STYLES: Record<string, { icon: LucideIcon; badge: string; bar: string }> = {
  accuracy: {
    icon: Target,
    badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    bar: 'bg-emerald-500',
  },
  fluency: {
    icon: Waves,
    badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    bar: 'bg-blue-500',
  },
  completeness: {
    icon: CheckCircle2,
    badge: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400',
    bar: 'bg-violet-600',
  },
  prosody: {
    icon: Activity,
    badge: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    bar: 'bg-orange-500',
  },
};

/**
 * Generates synthetic trend data for pronunciation attempts.
 *
 * TODO: Replace with real multi-attempt data when available.
 * This function creates 4-5 simulated attempts showing gradual improvement
 * for UX demonstration purposes only.
 *
 * @param currentScore - The current attempt's overall score
 * @returns Array of scores representing attempt history
 */
function generateTrendData(currentScore: number): number[] {
  const numAttempts = 5;
  const scores: number[] = [currentScore];

  // Generate synthetic future attempts with gradual improvement
  // Each attempt improves by 2-3 points, capped at 100
  for (let i = 1; i < numAttempts; i++) {
    const improvement = 2 + Math.random(); // 2-3 points improvement
    const nextScore = Math.min(100, scores[i - 1] + improvement);
    scores.push(Math.round(nextScore * 10) / 10); // Round to 1 decimal
  }

  return scores;
}

/**
 * Generates weekly date labels ending today, matching the simulated attempts.
 */
function generateTrendLabels(count: number): string[] {
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (count - 1 - i) * 7);
    return formatter.format(date);
  });
}

/**
 * Graphical score representation with progress bars for pronunciation assessment.
 * Note: Practice-specific features (e.g., "Focus on these words") are handled
 * on a dedicated Practice Words page, not in the assessment view.
 */
export default function PhraseScoreOverview({
  attemptScore,
  words: _words,
  onWordSelected: _onWordSelected,
}: PhraseScoreOverviewProps) {
  const overall = Math.round(attemptScore.overallAccuracy);
  const accuracy = Math.round(attemptScore.overallAccuracy);
  const fluency = attemptScore.fluency ? Math.round(attemptScore.fluency) : null;
  const completeness = attemptScore.completeness ? Math.round(attemptScore.completeness) : null;
  const prosody = attemptScore.prosody ? Math.round(attemptScore.prosody) : null;

  // Generate trend data for visualization (memoized so re-renders don't reshuffle it)
  // TODO: Replace with real multi-attempt data when available
  const trendScores = useMemo(
    () => generateTrendData(attemptScore.overallAccuracy),
    [attemptScore.overallAccuracy],
  );
  const trendLabels = useMemo(() => generateTrendLabels(trendScores.length), [trendScores.length]);

  const trendFirst = trendScores[0];
  const trendLast = trendScores[trendScores.length - 1];

  const metrics: Array<{ key: string; label: string; value: number }> = [
    { key: 'accuracy', label: 'Accuracy', value: accuracy },
  ];
  if (fluency !== null) metrics.push({ key: 'fluency', label: 'Fluency', value: fluency });
  if (completeness !== null) {
    metrics.push({ key: 'completeness', label: 'Completeness', value: completeness });
  }
  if (prosody !== null) metrics.push({ key: 'prosody', label: 'Prosody', value: prosody });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/70 dark:border-gray-700 shadow-sm p-6 sm:p-7">
      {/* Header: title + overall score */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
            Your Pronunciation Score
          </h3>
          <span
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 cursor-help"
            title={getMetricDescription('overall')}
          >
            Overall score
            <Info size={14} aria-hidden="true" />
          </span>
        </div>
        <p className="shrink-0 text-3xl font-bold leading-none text-emerald-600 dark:text-emerald-400 sm:text-4xl">
          {overall}{' '}
          <span className="text-xl font-bold text-gray-400 dark:text-gray-500 sm:text-2xl">
            / 100
          </span>
        </p>
      </div>

      {/* Overall progress bar (purely visual — the number above carries the value) */}
      <div
        className="mt-5 h-3.5 w-full rounded-full bg-gray-200 dark:bg-gray-700"
        aria-hidden="true"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_1px_6px_rgba(16,185,129,0.45)] transition-all duration-500"
          style={{ width: `${overall}%` }}
        />
      </div>

      {/* Progress over time: chart + trend summary */}
      <div className="mt-8">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Progress over time{' '}
          <span className="font-normal text-emerald-600 dark:text-emerald-400">(simulated)</span>
        </p>
        <div className="mt-3 flex items-stretch gap-4">
          <div className="min-w-0 flex-1">
            <PhraseTrendSparkline scores={trendScores} labels={trendLabels} height={150} />
          </div>
          <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-gray-200/70 dark:border-gray-700 px-3 py-4 sm:w-28">
            <div className="text-center">
              <p className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                {trendFirst}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{trendLabels[0]}</p>
            </div>
            <ArrowDown size={16} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <div className="text-center">
              <p className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                {trendLast}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {trendLabels[trendLabels.length - 1]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-score rows */}
      <div className="mt-6 divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700/60 dark:border-gray-700/60">
        {metrics.map((metric) => {
          const style = METRIC_STYLES[metric.key];
          const MetricIcon = style.icon;
          return (
            <div key={metric.key} className="py-4 last:pb-0">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.badge}`}
                  aria-hidden="true"
                >
                  <MetricIcon size={18} />
                </span>
                <span
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-help"
                  title={getMetricDescription(metric.key)}
                >
                  {metric.label}
                </span>
                <span className="ml-auto text-lg font-bold text-gray-900 dark:text-gray-100">
                  {metric.value}{' '}
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    / 100
                  </span>
                </span>
              </div>
              <div
                className="ml-12 mt-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700"
                aria-hidden="true"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
