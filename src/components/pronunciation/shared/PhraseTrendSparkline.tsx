interface PhraseTrendSparklineProps {
  scores: number[];
  width?: number;
  height?: number;
}

/**
 * Simple SVG sparkline showing pronunciation score trend across attempts.
 * Renders a minimal line chart with points for each attempt.
 * 
 * TODO: Replace with real multi-attempt data when available.
 * This component currently uses synthetic trend data for UX simulation.
 */
export default function PhraseTrendSparkline({
  scores,
  width = 200,
  height = 40,
}: PhraseTrendSparklineProps) {
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
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Get first and last scores for labels
  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];

  return (
    <div className="flex items-center gap-3">
      <div className="flex-shrink-0">
        <svg
          width={width}
          height={height}
          className="overflow-visible"
          aria-label="Pronunciation trend across attempts"
        >
          {/* Line connecting points */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-emerald-500 dark:text-emerald-400"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Points */}
          {points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="currentColor"
              className="text-emerald-500 dark:text-emerald-400"
            />
          ))}
        </svg>
      </div>
      {/* Labels */}
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">{firstScore}</span>
        <span className="text-gray-400 dark:text-gray-500">→</span>
        <span className="font-medium">{lastScore}</span>
      </div>
    </div>
  );
}

