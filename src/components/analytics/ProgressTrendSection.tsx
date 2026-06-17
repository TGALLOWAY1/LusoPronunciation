import { useMemo, useState } from 'react';
import type { AnalyticsWindow, TrendMetric, TrendPoint } from '@/lib/types';
import { TREND_METRICS } from '@/lib/practiceAnalytics';
import MultiMetricTrendChart from './MultiMetricTrendChart';

interface ProgressTrendSectionProps {
  data: TrendPoint[];
  window: AnalyticsWindow;
  onWindowChange: (window: AnalyticsWindow) => void;
}

const WINDOW_OPTIONS: { value: AnalyticsWindow; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const METRIC_LABELS: Record<TrendMetric, string> = {
  overall: 'Pronunciation',
  accuracy: 'Accuracy',
  fluency: 'Fluency',
  completeness: 'Completeness',
  prosody: 'Prosody',
};

/**
 * Progress section: window selector (7/30/90/all) + metric toggle driving a
 * multi-metric trend chart of pronunciation/accuracy/fluency/completeness scores.
 */
export default function ProgressTrendSection({
  data,
  window,
  onWindowChange,
}: ProgressTrendSectionProps) {
  // Only offer metric toggles for metrics that actually have data in this window.
  const availableMetrics = useMemo(
    () =>
      TREND_METRICS.filter((metric) =>
        data.some((point) => point.values[metric].length > 0),
      ),
    [data],
  );

  const [activeMetric, setActiveMetric] = useState<TrendMetric>('overall');
  const effectiveMetric = availableMetrics.includes(activeMetric)
    ? activeMetric
    : availableMetrics[0] ?? 'overall';

  return (
    <section id="progress" className="card scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Score History
        </h2>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Time window">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onWindowChange(opt.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                window === opt.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              aria-pressed={window === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {availableMetrics.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-4" role="group" aria-label="Metric">
          {availableMetrics.map((metric) => (
            <button
              key={metric}
              type="button"
              onClick={() => setActiveMetric(metric)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                effectiveMetric === metric
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              aria-pressed={effectiveMetric === metric}
            >
              {METRIC_LABELS[metric]}
            </button>
          ))}
        </div>
      )}

      <MultiMetricTrendChart data={data} activeMetric={effectiveMetric} />
    </section>
  );
}
