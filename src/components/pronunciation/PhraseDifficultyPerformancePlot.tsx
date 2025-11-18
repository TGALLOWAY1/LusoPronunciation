import { useState } from 'react';
import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';

interface PhraseDifficultyPerformancePlotProps {
  phrases: PracticePhraseFromFixture[];
  selectedPhraseId: string | null;
  onPhraseSelect?: (phraseId: string) => void;
}

/**
 * Scatter plot showing phrases by difficulty (x-axis) and overall score (y-axis).
 * Highlights the currently selected phrase and allows clicking dots to select phrases.
 * Uses responsive SVG with viewBox for full-width layout.
 */
export default function PhraseDifficultyPerformancePlot({
  phrases,
  selectedPhraseId,
  onPhraseSelect,
}: PhraseDifficultyPerformancePlotProps) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  if (phrases.length === 0) {
    return null;
  }

  // Use viewBox coordinates for responsive scaling
  // Increased left padding to accommodate y-axis label inside
  const viewBoxWidth = 400;
  const viewBoxHeight = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  // Extract data points
  const dataPoints = phrases.map((phrase) => ({
    id: phrase.id,
    difficulty: phrase.difficulty,
    score: Math.round(phrase.attempt.overallAccuracy),
    phrase,
  }));

  // Calculate axis ranges
  const minDifficulty = Math.min(...dataPoints.map((d) => d.difficulty));
  const maxDifficulty = Math.max(...dataPoints.map((d) => d.difficulty));
  const maxScore = 100;

  // Normalize coordinates to viewBox space
  const normalizeX = (difficulty: number): number => {
    const range = maxDifficulty - minDifficulty || 1;
    return padding.left + ((difficulty - minDifficulty) / range) * chartWidth;
  };

  const normalizeY = (score: number): number => {
    // Invert Y so higher scores are at the top
    return padding.top + chartHeight - (score / maxScore) * chartHeight;
  };

  // Generate grid lines and labels
  const difficultyTicks = Array.from(
    { length: maxDifficulty - minDifficulty + 1 },
    (_, i) => minDifficulty + i
  );
  const scoreTicks = [0, 25, 50, 75, 100];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 w-full">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Performance by Difficulty
      </h3>
      <div className="relative w-full" style={{ paddingBottom: '62.5%' }}>
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="absolute inset-0 w-full h-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          aria-label="Phrase performance scatter plot"
        >
          {/* Grid lines for scores (horizontal) */}
          {scoreTicks.map((score) => {
            const y = normalizeY(score);
            return (
              <g key={`grid-${score}`}>
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
              </g>
            );
          })}

          {/* Grid lines for difficulty (vertical) */}
          {difficultyTicks.map((difficulty) => {
            const x = normalizeX(difficulty);
            return (
              <g key={`grid-${difficulty}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={padding.top + chartHeight}
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-gray-200 dark:text-gray-700"
                  strokeDasharray="2,2"
                />
              </g>
            );
          })}

          {/* Y-axis labels (scores) */}
          {scoreTicks.map((score) => {
            const y = normalizeY(score);
            return (
              <text
                key={`y-label-${score}`}
                x={padding.left - 6}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {score}
              </text>
            );
          })}

          {/* Y-axis label "Score" inside chart */}
          <text
            x={8}
            y={padding.top + chartHeight / 2}
            textAnchor="middle"
            className="text-xs fill-gray-600 dark:fill-gray-400 font-medium"
            transform={`rotate(-90, 8, ${padding.top + chartHeight / 2})`}
          >
            Score
          </text>

          {/* X-axis labels (difficulty) */}
          {difficultyTicks.map((difficulty) => {
            const x = normalizeX(difficulty);
            return (
              <text
                key={`x-label-${difficulty}`}
                x={x}
                y={viewBoxHeight - padding.bottom + 12}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {difficulty}
              </text>
            );
          })}

          {/* X-axis label "Difficulty" centered below chart */}
          <text
            x={padding.left + chartWidth / 2}
            y={viewBoxHeight - 8}
            textAnchor="middle"
            className="text-xs fill-gray-600 dark:fill-gray-400 font-medium"
          >
            Difficulty
          </text>

          {/* Axis lines */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gray-400 dark:text-gray-500"
          />
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={padding.left + chartWidth}
            y2={padding.top + chartHeight}
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-gray-400 dark:text-gray-500"
          />

          {/* Data points */}
          {dataPoints.map((point) => {
            const x = normalizeX(point.difficulty);
            const y = normalizeY(point.score);
            const isSelected = point.id === selectedPhraseId;
            const isHovered = hoveredPointId === point.id;
            // Slightly larger radius on hover, but not enough to cause cursor issues
            const baseRadius = isSelected ? 6 : 4;
            const radius = isHovered ? baseRadius + 1 : baseRadius;
            const hitRadius = 10; // Larger hit area for easier clicking
            const fillColor = isSelected
              ? 'fill-blue-500 dark:fill-blue-400'
              : isHovered
              ? 'fill-blue-400 dark:fill-blue-500'
              : 'fill-gray-500 dark:fill-gray-400';
            const strokeColor = isSelected
              ? 'stroke-blue-600 dark:stroke-blue-300'
              : isHovered
              ? 'stroke-blue-500 dark:stroke-blue-400'
              : 'stroke-gray-600 dark:stroke-gray-500';

            return (
              <g key={point.id}>
                {/* Outer ring for selected point */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={baseRadius + 3}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-blue-300 dark:text-blue-600 animate-pulse"
                    opacity="0.5"
                  />
                )}
                {/* Invisible larger hit area for easier clicking */}
                <circle
                  cx={x}
                  cy={y}
                  r={hitRadius}
                  fill="transparent"
                  className="cursor-pointer"
                  onClick={() => onPhraseSelect?.(point.id)}
                  onMouseEnter={() => setHoveredPointId(point.id)}
                  onMouseLeave={() => setHoveredPointId(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onPhraseSelect?.(point.id);
                    }
                  }}
                  aria-label={`Select phrase ${point.id}: Difficulty ${point.difficulty}, Score ${point.score}`}
                />
                {/* Main point - visible circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  className={`${fillColor} ${strokeColor} transition-all pointer-events-none`}
                  strokeWidth={isSelected ? 2 : 1}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

