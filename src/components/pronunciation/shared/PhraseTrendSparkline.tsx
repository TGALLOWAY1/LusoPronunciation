import { useRef, useEffect, useState } from 'react';

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
  width,
  height = 40,
}: PhraseTrendSparklineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width || 300);

  // Measure container width if not explicitly provided
  useEffect(() => {
    if (!width && containerRef.current) {
      const updateWidth = () => {
        if (containerRef.current) {
          setContainerWidth(containerRef.current.offsetWidth);
        }
      };
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, [width]);

  if (scores.length === 0) {
    return null;
  }

  const actualWidth = width || containerWidth;

  // Calculate padding for the chart (similar to ScoringPanel margins)
  const paddingLeft = 32; // Space for Y-axis labels
  const paddingRight = 4; // Reduced right padding
  const paddingTop = 8;
  const paddingBottom = 24; // Space for X-axis labels
  const chartWidth = actualWidth - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Normalize scores to chart coordinates
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore || 1; // Avoid division by zero

  // Generate points for the line
  const points = scores.map((score, index) => {
    const x = paddingLeft + (index / (scores.length - 1 || 1)) * chartWidth;
    // Invert Y so higher scores are at the top
    const normalizedScore = (score - minScore) / scoreRange;
    const y = paddingTop + chartHeight - normalizedScore * chartHeight;
    return { x, y, score };
  });

  // Create path for the line
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={actualWidth}
        height={height}
        className="overflow-visible"
        aria-label="Pronunciation trend across attempts"
      >
        {/* Y-axis labels (min and max scores) */}
        <text
          x={paddingLeft - 8}
          y={paddingTop}
          textAnchor="end"
          className="text-xs fill-gray-600 dark:fill-gray-400"
          alignmentBaseline="hanging"
        >
          {Math.round(maxScore)}
        </text>
        <text
          x={paddingLeft - 8}
          y={height - paddingBottom}
          textAnchor="end"
          className="text-xs fill-gray-600 dark:fill-gray-400"
          alignmentBaseline="baseline"
        >
          {Math.round(minScore)}
        </text>
        
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
  );
}

