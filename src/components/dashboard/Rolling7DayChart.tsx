interface Rolling7DayChartProps {
  title: string;
  data: Array<{ date: string; values: number[] }>;
}

/**
 * Line chart showing rolling 7-day average for a metric.
 * Desktop-only component with hover tooltips.
 */
export default function Rolling7DayChart({ title, data }: Rolling7DayChartProps) {
  if (data.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data available</p>
      </div>
    );
  }

  // Calculate average for each day
  const averages = data.map(d => ({
    date: d.date,
    average: d.values.length > 0
      ? d.values.reduce((sum, v) => sum + v, 0) / d.values.length
      : 0,
    count: d.values.length,
  }));

  const maxValue = 100;
  const minValue = 0;
  const chartHeight = 280;
  const chartWidth = 450;
  const padding = { top: 30, right: 30, bottom: 50, left: 50 };

  // Format date for display (MM/DD)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Normalize value to chart coordinates
  const normalizeY = (value: number) => {
    const range = maxValue - minValue || 1;
    return padding.top + chartHeight - ((value - minValue) / range) * chartHeight;
  };

  // Generate points for the line
  const points = averages.map((avg, index) => {
    const x = padding.left + (index / (averages.length - 1 || 1)) * chartWidth;
    const y = normalizeY(avg.average);
    return { x, y, ...avg };
  });

  // Create path for the line
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group">
      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">{title}</h3>
      <div className="relative" style={{ height: `${chartHeight + padding.top + padding.bottom}px` }}>
        <svg
          viewBox={`0 0 ${chartWidth + padding.left + padding.right} ${chartHeight + padding.top + padding.bottom}`}
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
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
            className="text-primary-500 dark:text-primary-400 group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors"
          />

          {/* Points with hover tooltips */}
          {points.map((point, index) => (
            <g key={`point-${index}`} className="group">
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="currentColor"
                className="text-primary-500 dark:text-primary-400 cursor-pointer group-hover:r-6 transition-all"
                style={{ transition: 'r 0.2s' }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="8"
                fill="currentColor"
                opacity="0"
                className="cursor-pointer"
              />
              <title>
                {formatDate(point.date)}: {point.average.toFixed(1)} ({point.count} attempts)
              </title>
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, index) => {
            if (index % 2 === 0 || index === points.length - 1) {
              return (
                <text
                  key={`label-${index}`}
                  x={point.x}
                  y={chartHeight + padding.top + padding.bottom - 12}
                  textAnchor="middle"
                  className="text-xs fill-gray-600 dark:fill-gray-400 font-medium"
                >
                  {formatDate(point.date)}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>
      <div className="mt-3 text-center">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Avg: <span className="font-bold text-gray-900 dark:text-gray-100">{(averages.reduce((sum, a) => sum + a.average, 0) / averages.length || 0).toFixed(1)}</span>
        </p>
      </div>
    </div>
  );
}

