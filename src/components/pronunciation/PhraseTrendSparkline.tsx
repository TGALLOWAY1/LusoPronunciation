import { useId } from 'react';

interface PhraseTrendSparklineProps {
  scores: number[];
  width?: number;
  height?: number;
}

/**
 * SVG sparkline showing pronunciation score trend across attempts.
 * Renders a smooth line with a soft gradient area fill, a subtle glow,
 * and an emphasized endpoint marking the latest attempt.
 *
 * TODO: Replace with real multi-attempt data when available.
 * This component currently uses synthetic trend data for UX simulation.
 */
export default function PhraseTrendSparkline({
  scores,
  width = 220,
  height = 48,
}: PhraseTrendSparklineProps) {
  // Unique ids so multiple sparklines on one page don't share gradient defs.
  const uid = useId().replace(/[:]/g, '');
  const areaGradId = `spark-area-${uid}`;
  const lineGradId = `spark-line-${uid}`;

  if (scores.length === 0) {
    return null;
  }

  // Calculate padding for the chart
  const padding = 8;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Normalize scores to chart coordinates (0-100 scale)
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore || 1; // Avoid division by zero

  // Generate points for the line
  const points = scores.map((score, index) => {
    const x = padding + (index / (scores.length - 1 || 1)) * chartWidth;
    // Invert Y so higher scores are at the top
    const normalizedScore = (score - minScore) / scoreRange;
    const y = padding + chartHeight - normalizedScore * chartHeight;
    return { x, y, score };
  });

  // Create path for the line
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Closed path for the gradient area fill (line + down to the baseline)
  const baseline = height - padding;
  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${baseline}` +
    ` L ${points[0].x} ${baseline} Z`;

  const lastPoint = points[points.length - 1];

  // Get first and last scores for labels
  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];
  const delta = Math.round((lastScore - firstScore) * 10) / 10;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          role="img"
          aria-label={`Pronunciation trend across attempts: from ${firstScore} to ${lastScore}`}
        >
          <defs>
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Gradient area under the line */}
          <path d={areaPath} fill={`url(#${areaGradId})`} className="text-emerald-500" />

          {/* Trend line */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Intermediate points */}
          {points.slice(0, -1).map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="2.5"
              fill="currentColor"
              className="text-emerald-500 dark:text-emerald-400"
            />
          ))}

          {/* Emphasized endpoint (latest attempt) */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="6"
            fill="currentColor"
            className="text-emerald-500/20 dark:text-emerald-400/20"
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
            className="text-emerald-500 dark:text-emerald-400"
          />
        </svg>
      </div>
      {/* Labels */}
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">{firstScore}</span>
        <span className="text-gray-400 dark:text-gray-500">→</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{lastScore}</span>
        {delta > 0 && (
          <span className="ml-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            +{delta}
          </span>
        )}
      </div>
    </div>
  );
}
