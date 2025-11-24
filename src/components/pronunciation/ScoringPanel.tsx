import React, { useRef, useEffect } from 'react';
import type { AttemptScore } from '@/types/pronunciation';

interface ScoringPanelProps {
  currentAttempt: AttemptScore | null;
  variant?: 'card' | 'banner';
}

export interface ScoreTheme {
  bg: string;
  text: string;
  border: string;
}

/**
 * Metric descriptions for tooltips.
 */
const METRIC_DESCRIPTIONS: Record<string, string> = {
  accuracy: 'This score indicates how closely the speaker\'s pronunciation of words matches that of a native speaker, evaluating the correctness of individual sounds and words. It helps detect mispronunciations, insertions, and omissions.',
  fluency: 'This metric assesses how smoothly and continuously the speech is delivered, specifically by measuring how closely the use of silent breaks between words matches a native speaker\'s patterns.',
  completeness: 'This score indicates how many words from the provided reference text were correctly pronounced in the user\'s speech. Omissions are factored into this metric.',
  prosody: 'This metric evaluates the naturalness and expressiveness of the speech, including elements like intonation, pitch, tempo, and rhythm.',
};

/**
 * Gets the description for a metric.
 */
function getMetricDescription(metric: string): string {
  return METRIC_DESCRIPTIONS[metric.toLowerCase()] || '';
}

/**
 * Info icon component that shows all metric definitions in a tooltip
 */
function AllMetricsInfoIcon({ prosodyAvailable = false }: { prosodyAvailable?: boolean }) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isClickedOpen, setIsClickedOpen] = React.useState(false);
  const [tooltipStyle, setTooltipStyle] = React.useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isClickedOpen &&
        buttonRef.current &&
        tooltipRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        !tooltipRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
        setIsClickedOpen(false);
      }
    };

    if (isClickedOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isClickedOpen]);

  useEffect(() => {
    if (showTooltip && buttonRef.current && tooltipRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const tooltipWidth = 384; // w-96 = 384px
      const tooltipHeight = 500; // Approximate height, will be measured
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16; // 1rem padding from viewport edges

      // Measure actual tooltip height after it's rendered
      const actualHeight = tooltipRef.current.offsetHeight || tooltipHeight;

      // Calculate available space
      const spaceOnRight = viewportWidth - buttonRect.right;
      const spaceOnTop = buttonRect.top;
      const spaceOnBottom = viewportHeight - buttonRect.bottom;

      // Determine horizontal position
      const shouldPositionLeft = spaceOnRight < tooltipWidth + padding;
      
      // Determine vertical position - prefer above, but use below if not enough space
      const shouldPositionBelow = spaceOnTop < actualHeight + padding + 20; // 20px for margin

      const horizontalStyle = shouldPositionLeft
        ? {
            left: '0',
            right: 'auto',
            transform: `translateX(calc(-100% + ${buttonRect.width}px))`,
          }
        : {
            right: '0',
            left: 'auto',
            transform: 'translateX(0)',
          };

      const verticalStyle = shouldPositionBelow
        ? {
            top: '100%',
            bottom: 'auto',
            marginTop: '8px',
            marginBottom: '0',
          }
        : {
            bottom: '100%',
            top: 'auto',
            marginBottom: '8px',
            marginTop: '0',
          };

      setTooltipStyle({
        ...horizontalStyle,
        ...verticalStyle,
        maxWidth: `min(384px, calc(100vw - ${padding * 2}px))`,
        maxHeight: shouldPositionBelow 
          ? `${Math.min(500, Math.max(200, spaceOnBottom - padding - 20))}px`
          : `${Math.min(500, Math.max(200, spaceOnTop - padding - 20))}px`,
      });
    }
  }, [showTooltip]);

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
        aria-label="Information about pronunciation metrics"
        aria-expanded={showTooltip}
        onClick={(e) => {
          e.stopPropagation();
          if (showTooltip && isClickedOpen) {
            setShowTooltip(false);
            setIsClickedOpen(false);
          } else {
            setShowTooltip(true);
            setIsClickedOpen(true);
          }
        }}
        onMouseEnter={() => {
          if (!isClickedOpen) {
            setShowTooltip(true);
          }
        }}
        onMouseLeave={() => {
          if (!isClickedOpen) {
            setShowTooltip(false);
          }
        }}
        onFocus={() => {
          if (!isClickedOpen) {
            setShowTooltip(true);
          }
        }}
        onBlur={(e) => {
          // Only close on blur if not clicking into the tooltip
          if (!isClickedOpen && !tooltipRef.current?.contains(e.relatedTarget as Node)) {
            setShowTooltip(false);
          }
        }}
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {showTooltip && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 w-96 max-w-[min(384px,calc(100vw-2rem))] p-5 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg ${
            isClickedOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={tooltipStyle}
          role="tooltip"
          onMouseEnter={() => {
            if (!isClickedOpen) {
              setShowTooltip(true);
            }
          }}
          onMouseLeave={() => {
            if (!isClickedOpen) {
              setShowTooltip(false);
            }
          }}
        >
          <div className="space-y-4 overflow-y-auto" style={{ maxHeight: tooltipStyle.maxHeight }}>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Accuracy</h4>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300 break-words">
                {getMetricDescription('accuracy')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Fluency</h4>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300 break-words">
                {getMetricDescription('fluency')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Completeness</h4>
              <p className="leading-relaxed text-gray-700 dark:text-gray-300 break-words">
                {getMetricDescription('completeness')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Prosody</h4>
              {prosodyAvailable ? (
                <p className="leading-relaxed text-gray-700 dark:text-gray-300 break-words">
                  {getMetricDescription('prosody')}
                </p>
              ) : (
                <div>
                  <p className="leading-relaxed text-gray-700 dark:text-gray-300 mb-2 break-words">
                    {getMetricDescription('prosody')}
                  </p>
                  <p className="text-xs italic text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded border border-amber-200 dark:border-amber-800 break-words">
                    ⚠️ Not available for pt-BR. Prosody scoring is only supported for en-US locale in Azure Speech Service.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Tooltip arrow */}
          {(() => {
            const isBelow = tooltipStyle.top === '100%';
            const isLeft = tooltipStyle.left === '0';
            return (
              <div
                className="absolute w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700"
                style={{
                  ...(isBelow ? { top: '-4px' } : { bottom: '-4px' }),
                  right: isLeft ? 'auto' : '16px',
                  left: isLeft ? '16px' : 'auto',
                  transform: isBelow ? 'rotate(225deg)' : 'rotate(45deg)',
                }}
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

/**
 * Gets the color theme for a score.
 * Provides background, text, and border classes for consistent styling.
 */
export function getScoreColor(score: number): ScoreTheme {
  if (score >= 90) {
    return {
      bg: 'bg-emerald-500 dark:bg-emerald-600',
      text: 'text-emerald-800 dark:text-emerald-100',
      border: 'border-emerald-300 dark:border-emerald-700',
    };
  }

  if (score >= 80) {
    return {
      bg: 'bg-sky-500 dark:bg-sky-600',
      text: 'text-sky-800 dark:text-sky-100',
      border: 'border-sky-300 dark:border-sky-700',
    };
  }

  if (score >= 70) {
    return {
      bg: 'bg-amber-500 dark:bg-amber-600',
      text: 'text-amber-800 dark:text-amber-100',
      border: 'border-amber-300 dark:border-amber-700',
    };
  }

  return {
    bg: 'bg-rose-500 dark:bg-rose-600',
    text: 'text-rose-800 dark:text-rose-100',
    border: 'border-rose-300 dark:border-rose-700',
  };
}

/**
 * Scoring panel component that displays pronunciation metrics.
 * Shows Overall Pronunciation Score, Accuracy, Fluency, Completeness, and Prosody.
 * 
 * @param variant - 'card' for vertical card layout (default), 'banner' for horizontal banner layout
 */
export default function ScoringPanel({ currentAttempt, variant = 'card' }: ScoringPanelProps) {
  if (!currentAttempt) {
    if (variant === 'banner') {
      return null; // Don't render banner if no attempt
    }
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p>No attempt data available</p>
        </div>
      </div>
    );
  }

  const overall = Math.round(currentAttempt.overallAccuracy);
  const accuracy = Math.round(currentAttempt.overallAccuracy);
  const fluency = currentAttempt.fluency !== undefined && currentAttempt.fluency !== null ? Math.round(currentAttempt.fluency) : null;
  const completeness = currentAttempt.completeness !== undefined && currentAttempt.completeness !== null ? Math.round(currentAttempt.completeness) : null;
  const prosody = currentAttempt.prosody !== undefined && currentAttempt.prosody !== null ? Math.round(currentAttempt.prosody) : null;

  const overallTheme = getScoreColor(overall);
  const accuracyTheme = getScoreColor(accuracy);
  const fluencyTheme = fluency !== null ? getScoreColor(fluency) : null;
  const completenessTheme = completeness !== null ? getScoreColor(completeness) : null;
  const prosodyTheme = prosody !== null ? getScoreColor(prosody) : null;

  // Render horizontal banner variant
  if (variant === 'banner') {
    return (
      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-end mb-4">
          <AllMetricsInfoIcon prosodyAvailable={prosody !== null} />
        </div>
        <div className="grid grid-cols-4 gap-6 items-end">
          {/* Section 1: Overall Score - Prominent progress bar */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Overall</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{overall}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden border-2 border-gray-400 dark:border-gray-500 shadow-sm">
              <div
                className={`h-full transition-all duration-500 ${overallTheme.bg}`}
                style={{ width: `${overall}%` }}
              />
            </div>
          </div>

          {/* Section 2: Accuracy */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Accuracy</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{accuracy}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${accuracyTheme.bg}`}
                style={{ width: `${accuracy}%` }}
              />
            </div>
          </div>

          {/* Section 3: Fluency */}
          {fluency !== null ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Fluency</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{fluency}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${fluencyTheme?.bg ?? ''}`}
                  style={{ width: `${fluency}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col opacity-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-500">Fluency</span>
                <span className="text-lg font-bold text-gray-400 dark:text-gray-600">—</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3" />
            </div>
          )}

          {/* Section 4: Completeness */}
          {completeness !== null ? (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completeness</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{completeness}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${completenessTheme?.bg ?? ''}`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col opacity-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-500">Completeness</span>
                <span className="text-lg font-bold text-gray-400 dark:text-gray-600">—</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Debug logging in development to diagnose missing Prosody
  // Note: ProsodyScore is only available for en-US locale in Azure Speech Service.
  // For pt-BR and other locales, Prosody will always be undefined - this is expected.
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && currentAttempt) {
    if (currentAttempt.prosody === undefined || currentAttempt.prosody === null) {
      console.info('[ScoringPanel] Prosody score not available (expected for non-English locales):', {
        attemptId: currentAttempt.attemptId,
        hasFluency: currentAttempt.fluency !== undefined,
        hasCompleteness: currentAttempt.completeness !== undefined,
        hasProsody: currentAttempt.prosody !== undefined,
        note: 'ProsodyScore is only supported for en-US locale in Azure Speech Service',
      });
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Current Score
        </h3>
        <AllMetricsInfoIcon prosodyAvailable={prosody !== null} />
      </div>

      {/* Overall Pronunciation Score */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Overall Pronunciation Score
          </span>
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {overall} <span className="text-lg text-gray-500 dark:text-gray-400">/ 100</span>
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${overallTheme.bg}`}
            style={{ width: `${overall}%` }}
          />
        </div>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-4">
        {/* Accuracy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Accuracy
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{accuracy}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-full transition-all duration-500 ${accuracyTheme.bg}`}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* Fluency */}
        {fluency !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Fluency
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{fluency}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${fluencyTheme?.bg ?? ''}`}
                style={{ width: `${fluency}%` }}
              />
            </div>
          </div>
        )}

        {/* Completeness */}
        {completeness !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Completeness
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{completeness}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${completenessTheme?.bg ?? ''}`}
                style={{ width: `${completeness}%` }}
              />
            </div>
          </div>
        )}

        {/* Prosody */}
        {prosody !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Prosody
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{prosody}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-full transition-all duration-500 ${prosodyTheme?.bg ?? ''}`}
                style={{ width: `${prosody}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

