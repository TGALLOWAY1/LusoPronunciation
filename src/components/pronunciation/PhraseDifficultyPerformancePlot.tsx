import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';

interface PhraseDifficultyPerformancePlotProps {
  phrases: PracticePhraseFromFixture[];
  selectedPhraseId: string | null;
  onPhraseSelect?: (phraseId: string) => void;
  width?: number;
  height?: number;
}

/**
 * Scatter plot showing phrases by difficulty (x-axis) and overall score (y-axis).
 * Highlights the currently selected phrase and allows clicking dots to select phrases.
 */
export default function PhraseDifficultyPerformancePlot({
  phrases,
  selectedPhraseId,
  onPhraseSelect,
  width = 300,
  height = 200,
}: PhraseDifficultyPerformancePlotProps) {
  if (phrases.length === 0) {
    return null;
  }

  // Calculate padding and chart area
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

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

  // Normalize coordinates to SVG space
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
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Performance by Difficulty
      </h3>
      <div className="relative">
        <svg
          width={width}
          height={height}
          className="overflow-visible"
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
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {score}
              </text>
            );
          })}

          {/* X-axis labels (difficulty) */}
          {difficultyTicks.map((difficulty) => {
            const x = normalizeX(difficulty);
            return (
              <text
                key={`x-label-${difficulty}`}
                x={x}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="text-xs fill-gray-600 dark:fill-gray-400"
              >
                {difficulty}
              </text>
            );
          })}

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
            const radius = isSelected ? 6 : 4;
            const fillColor = isSelected
              ? 'text-blue-500 dark:text-blue-400'
              : 'text-gray-500 dark:text-gray-400';
            const strokeColor = isSelected
              ? 'text-blue-600 dark:text-blue-300'
              : 'text-gray-600 dark:text-gray-500';

            return (
              <g key={point.id}>
                {/* Outer ring for selected point */}
                {isSelected && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 3}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-blue-300 dark:text-blue-600 animate-pulse"
                    opacity="0.5"
                  />
                )}
                {/* Main point */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth={isSelected ? 2 : 1}
                  className={`${fillColor} ${strokeColor} cursor-pointer transition-all hover:scale-125`}
                  onClick={() => onPhraseSelect?.(point.id)}
                  aria-label={`Phrase ${point.id}: Difficulty ${point.difficulty}, Score ${point.score}`}
                />
              </g>
            );
          })}
        </svg>

        {/* Axis labels */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-6 text-xs text-gray-600 dark:text-gray-400">
          Difficulty
        </div>
        <div
          className="absolute left-0 top-1/2 transform -translate-x-8 -translate-y-1/2 -rotate-90 text-xs text-gray-600 dark:text-gray-400"
          style={{ writingMode: 'vertical-rl' }}
        >
          Overall Score
        </div>
      </div>
    </div>
  );
}

