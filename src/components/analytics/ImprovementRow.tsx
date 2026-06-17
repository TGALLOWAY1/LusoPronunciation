import type { ImprovementItem } from '@/lib/types';
import { KIND_LABEL } from './itemLabels';

interface ImprovementRowProps {
  item: ImprovementItem;
  label: string;
  /** When true, show the delta in red (regression) instead of green. */
  showAsRegression?: boolean;
}

/**
 * A single row in a Most-Improved / Needs-Practice list: kind chip, label,
 * early→recent score transition, and signed delta.
 */
export default function ImprovementRow({ item, label, showAsRegression }: ImprovementRowProps) {
  const early = Math.round(item.earlyAvg);
  const recent = Math.round(item.recentAvg);
  const delta = Math.round(item.delta);
  const improved = delta > 0;
  const deltaColor =
    showAsRegression || delta < 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-green-600 dark:text-green-400';

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
            {KIND_LABEL[item.kind]}
          </span>
          <span
            className={`truncate text-sm font-medium text-gray-900 dark:text-gray-100 ${item.kind === 'phoneme' ? 'font-mono' : ''}`}
            title={label}
          >
            {label}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {item.attempts} attempts
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-sm">
        <span className="text-gray-500 dark:text-gray-400">{early}</span>
        <span className="text-gray-400 dark:text-gray-500">→</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{recent}</span>
        <span className={`font-semibold tabular-nums ${deltaColor}`}>
          {improved ? '+' : ''}
          {delta}
        </span>
      </div>
    </div>
  );
}
