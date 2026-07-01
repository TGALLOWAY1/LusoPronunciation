import { useEffect, useId, useRef, useState } from 'react';

interface PhraseTrendSparklineProps {
  scores: number[];
  /** Optional x-axis labels, one per score (e.g. dates). Omitted labels collapse the x-axis band. */
  labels?: string[];
  /** Fixed width in px. Omit to fill the container responsively. */
  width?: number;
  height?: number;
}

const PADDING_TOP = 10;
const PADDING_RIGHT = 12;
const Y_AXIS_BAND = 34;
const X_AXIS_BAND = 24;
const GRID_VALUES = [0, 25, 50, 75, 100];
const TICK_VALUES = [0, 50, 100];
// Minimum horizontal room per x label before thinning kicks in
const MIN_LABEL_SPACING = 44;

/**
 * Converts data points into a gently smoothed cubic-bezier path (Catmull-Rom style).
 */
function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    d +=
      ` C ${r(p1.x + (p2.x - p0.x) / 6)} ${r(p1.y + (p2.y - p0.y) / 6)},` +
      ` ${r(p2.x - (p3.x - p1.x) / 6)} ${r(p2.y - (p3.y - p1.y) / 6)},` +
      ` ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}

/**
 * Compact SVG trend chart showing pronunciation scores across attempts.
 * Renders a fixed 0-100 y-scale with hairline gridlines, a smoothed line with
 * a soft area wash beneath it, ringed data points, and optional x-axis labels.
 *
 * TODO: Replace with real multi-attempt data when available.
 * This component currently uses synthetic trend data for UX simulation.
 */
export default function PhraseTrendSparkline({
  scores,
  labels,
  width,
  height = 150,
}: PhraseTrendSparklineProps) {
  // Unique ids so multiple charts on one page don't share gradient defs.
  const uid = useId().replace(/[:]/g, '');
  const areaGradId = `trend-area-${uid}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(width || 300);

  useEffect(() => {
    const el = containerRef.current;
    if (width || !el) return;
    const update = () => setContainerWidth(el.offsetWidth || 300);
    update();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [width]);

  if (scores.length === 0) {
    return null;
  }

  const actualWidth = width || containerWidth;
  const hasXLabels = !!labels && labels.length === scores.length;
  const paddingBottom = hasXLabels ? X_AXIS_BAND : 10;
  const chartWidth = Math.max(actualWidth - Y_AXIS_BAND - PADDING_RIGHT, 40);
  const chartHeight = height - PADDING_TOP - paddingBottom;

  const xFor = (index: number) => Y_AXIS_BAND + (index / (scores.length - 1 || 1)) * chartWidth;
  const yFor = (value: number) =>
    PADDING_TOP + chartHeight - (Math.min(Math.max(value, 0), 100) / 100) * chartHeight;

  const points = scores.map((score, index) => ({ x: xFor(index), y: yFor(score), score }));
  const baselineY = yFor(0);
  const linePath = buildSmoothPath(points);
  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${baselineY}` +
    ` L ${points[0].x} ${baselineY} Z`;

  // Thin x labels when the chart is too narrow to fit them all, keeping the latest one.
  const labelStride = hasXLabels
    ? Math.max(1, Math.ceil((scores.length * MIN_LABEL_SPACING) / chartWidth))
    : 1;
  const showLabelAt = (index: number) => (scores.length - 1 - index) % labelStride === 0;

  const firstScore = scores[0];
  const lastScore = scores[scores.length - 1];

  return (
    // The svg is absolutely positioned so its measured pixel width never feeds
    // back into the layout's intrinsic width (which would let the chart force
    // its container — and the page — wider than the viewport).
    <div ref={containerRef} className="relative w-full" style={{ height, width }}>
      <svg
        width={actualWidth}
        height={height}
        viewBox={`0 0 ${actualWidth} ${height}`}
        className="absolute inset-0 overflow-visible"
        role="img"
        aria-label={`Pronunciation trend across ${scores.length} attempts: from ${firstScore} to ${lastScore} out of 100`}
      >
        <defs>
          <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="currentColor"
              stopOpacity="0.18"
              className="text-emerald-500 dark:text-emerald-400"
            />
            <stop
              offset="100%"
              stopColor="currentColor"
              stopOpacity="0.02"
              className="text-emerald-500 dark:text-emerald-400"
            />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines (hairline, recessive) */}
        {GRID_VALUES.map((value) => (
          <line
            key={value}
            x1={Y_AXIS_BAND}
            y1={yFor(value)}
            x2={Y_AXIS_BAND + chartWidth}
            y2={yFor(value)}
            strokeWidth="1"
            className={
              value === 0
                ? 'stroke-gray-300 dark:stroke-gray-600'
                : 'stroke-gray-200/80 dark:stroke-gray-700/60'
            }
          />
        ))}

        {/* Y axis */}
        <line
          x1={Y_AXIS_BAND}
          y1={PADDING_TOP}
          x2={Y_AXIS_BAND}
          y2={baselineY}
          strokeWidth="1"
          className="stroke-gray-300 dark:stroke-gray-600"
        />
        {TICK_VALUES.map((value) => (
          <text
            key={value}
            x={Y_AXIS_BAND - 8}
            y={yFor(value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="text-[10px] fill-gray-400 dark:fill-gray-500"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </text>
        ))}

        {/* Area wash under the line */}
        <path d={areaPath} fill={`url(#${areaGradId})`} />

        {/* Trend line */}
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-emerald-500 dark:text-emerald-400"
        />

        {/* Data points with a surface ring so they stay legible over the line */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            strokeWidth="2"
            className="fill-emerald-500 stroke-white dark:fill-emerald-400 dark:stroke-gray-800"
          />
        ))}

        {/* X axis labels */}
        {hasXLabels &&
          points.map(
            (point, index) =>
              showLabelAt(index) && (
                <text
                  key={index}
                  x={point.x}
                  y={height - 6}
                  textAnchor="middle"
                  className="text-[10px] fill-gray-500 dark:fill-gray-400"
                >
                  {labels[index]}
                </text>
              ),
          )}

        {/* Oversized hover targets with native tooltips */}
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="14" fill="transparent">
            <title>
              {hasXLabels
                ? `${labels[index]}: ${point.score} / 100`
                : `Attempt ${index + 1}: ${point.score} / 100`}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
