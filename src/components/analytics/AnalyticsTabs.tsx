interface AnalyticsTabsProps {
  /** Section ids that are actually rendered, in display order. */
  sections: string[];
}

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  progress: 'Progress',
  strengths: 'Strengths',
  focus: 'Focus Areas',
  recommendations: 'Recommendations',
  resources: 'Resources',
};

/**
 * Sticky, horizontally scrollable in-page navigation that jumps to dashboard sections.
 * Uses anchor links + CSS smooth scrolling (scroll-mt on each section), so it works on
 * mobile and desktop with no router changes.
 */
export default function AnalyticsTabs({ sections }: AnalyticsTabsProps) {
  return (
    <nav
      className="sticky top-0 z-10 -mx-4 px-4 sm:mx-0 sm:px-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800"
      aria-label="Analytics sections"
    >
      <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
        {sections.map((id) => (
          <a
            key={id}
            href={`#${id}`}
            className="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            {SECTION_LABELS[id] ?? id}
          </a>
        ))}
      </div>
    </nav>
  );
}
