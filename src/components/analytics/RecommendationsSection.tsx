import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import type { PracticeRecommendation } from '@/lib/types';

interface RecommendationsSectionProps {
  recommendations: PracticeRecommendation[];
}

const GROUPS: { kind: PracticeRecommendation['kind']; title: string }[] = [
  { kind: 'phoneme', title: 'Recommended Sounds' },
  { kind: 'word', title: 'Recommended Words' },
  { kind: 'sentence', title: 'Recommended Phrases' },
];

/**
 * Practice Recommendations: data-grounded "what to practice next" across sounds,
 * words, and phrases. Each item links to the relevant practice surface.
 */
export default function RecommendationsSection({
  recommendations,
}: RecommendationsSectionProps) {
  return (
    <section id="recommendations" className="card scroll-mt-20">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={18} className="text-primary-500 dark:text-primary-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Practice Recommendations
        </h2>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          Practice a little more and we'll recommend exactly what to work on next.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {GROUPS.map(({ kind, title }) => {
            const items = recommendations.filter((r) => r.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {title}
                </h3>
                <div className="space-y-2">
                  {items.map((rec) => (
                    <Link
                      key={`${rec.kind}-${rec.id}`}
                      to={rec.to}
                      className="block p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
                    >
                      <span
                        className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${kind === 'phoneme' ? 'font-mono' : ''}`}
                      >
                        {rec.label}
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {rec.reason}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
