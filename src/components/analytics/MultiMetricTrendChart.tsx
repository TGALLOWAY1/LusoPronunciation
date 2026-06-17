import type { TrendMetric, TrendPoint } from '@/lib/types';

interface MultiMetricTrendChartProps {
  data: TrendPoint[];
  activeMetric: TrendMetric;
}

/**
 * Responsive SVG line chart for a single metric across a window of time buckets.
 *
 * Generalizes the rolling-7-day chart: it averages each bucket's raw scores for the
 * active metric and plots only buckets that contain data (so no-practice gaps collapse
 * rather than dipping the line to zero). Fixed 0-100 Y-axis. The parent owns the metric
 * and window selectors; this component is purely presentational.
 */
export default function MultiMetricTrendChart({
  data,
  activeMetric,
}: MultiMetricTrendChartProps) {
  // Average each bucket for the active metric, keeping only buckets with data.
  const series = data
    .map((point) => {
      const values = point.values[activeMetric];
      return {
        date: point.date,
        label: point.label,
        average: values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : null,
        count: values.length,
      };
    })
    .filter((p): p is { date: string; label: string; average: number; count: number } => p.average !== null);

  if (series.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No {activeMetric} scores recorded in this period yet.
      </p>
    );
  }

  const chartHeight = 240;
  const chartWidth = 460;
  const padding = { top: 24, right: 24, bottom: 44, left: 44 };
  const maxValue = 100;
  const minValue = 0;

  const normalizeY = (value: number) => {
    const range = maxValue - minValue || 1;
    return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  };

  const points = series.map((s, index) => {
    const x = padding.left + (index / (series.length - 1 || 1)) * chartWidth;
    const y = normalizeY(s.average);
    return { x, y, ...s };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const overallAvg = series.reduce((sum, s) => sum + s.average, 0) / series.length;

  return (
    <div className="group">
      <div
        className="relative"
        style={{ height: `${chartHeight + padding.top + padding.bottom}px` }}
      >
        <svg
          viewBox={`0 0 ${chartWidth + padding.left + padding.right} ${chartHeight + padding.top + padding.bottom}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${activeMetric} score trend`}
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((value) => {
            const y = normalizeY(value);
            return (
              <g key={`grid-${value}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-gray-200 dark:text-gray-700"
                  strokeDasharray="2,2"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-500 dark:fill-gray-400 font-medium"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary-500 dark:text-primary-400"
          />

          {/* Points with tooltips */}
          {points.map((point, index) => (
            <g key={`point-${index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill="currentColor"
                className="text-primary-500 dark:text-primary-400"
              />
              <circle cx={point.x} cy={point.y} r="9" fill="transparent" />
              <title>
                {point.label}: {point.average.toFixed(1)} ({point.count} attempt
                {point.count === 1 ? '' : 's'})
              </title>
            </g>
          ))}

          {/* X-axis labels (avoid crowding) */}
          {points.map((point, index) => {
            const step = Math.ceil(points.length / 7);
            if (index % step === 0 || index === points.length - 1) {
              return (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={chartHeight + padding.top + padding.bottom - 12}
                  textAnchor="middle"
                  className="text-xs fill-gray-600 dark:fill-gray-400 font-medium"
                >
                  {point.label}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
      <p className="mt-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
        Average:{' '}
        <span className="font-bold text-gray-900 dark:text-gray-100">
          {overallAvg.toFixed(1)}
        </span>
      </p>
    </div>
  );
}
