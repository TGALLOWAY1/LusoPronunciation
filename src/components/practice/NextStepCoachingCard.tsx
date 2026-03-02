import type { CoachingSuggestion } from '@/lib/coaching/coachingEngine';

type NextStepCoachingCardProps = {
  suggestion: CoachingSuggestion;
  drillOpen: boolean;
  onPrimaryCta: () => void;
  onRetrySentence: () => void;
};

export default function NextStepCoachingCard({
  suggestion,
  drillOpen,
  onPrimaryCta,
  onRetrySentence,
}: NextStepCoachingCardProps) {
  return (
    <section
      className="rounded-lg border border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 p-4"
      aria-label="Next step coaching"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
        Next step
      </p>
      <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {suggestion.title}
      </h3>
      <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{suggestion.message}</p>

      {suggestion.targets && suggestion.targets.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestion.targets.map((target) => (
            <span
              key={`${target.word}-${target.index}`}
              className="inline-flex items-center rounded-full bg-white/90 dark:bg-gray-900/60 px-2 py-1 text-xs font-medium text-gray-800 dark:text-gray-200 border border-emerald-200 dark:border-emerald-800"
            >
              {target.word}
              {typeof target.score === 'number' && (
                <span className="ml-1 text-[11px] text-gray-600 dark:text-gray-400">
                  {Math.round(target.score)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={onPrimaryCta}
          className="btn btn-primary btn-sm"
        >
          {suggestion.ctaLabel}
        </button>
      </div>

      {suggestion.drill && drillOpen && (
        <div className="mt-4 rounded-md border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-gray-900/50 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Minimal pair drill
          </p>
          <ul className="space-y-2">
            {suggestion.drill.pairs.slice(0, 3).map((pair, index) => (
              <li
                key={`${pair.a}-${pair.b}-${index}`}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-2"
              >
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {pair.a} / {pair.b}
                </p>
                {pair.note && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{pair.note}</p>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={onRetrySentence} className="btn btn-secondary btn-sm">
            Retry sentence
          </button>
        </div>
      )}
    </section>
  );
}
