import type { CategoryStats } from '@/lib/types';
import type { Category } from '@/lib/types';
import type { WordCategoryStats } from '@/lib/wordStats';

interface CategoryBreakdownTableProps {
  data: CategoryStats[];
  categories: Category[];
  wordStats?: WordCategoryStats;
}

/**
 * Wide table or bar chart showing performance by category.
 * Desktop-only component.
 */
export default function CategoryBreakdownTable({ data, categories, wordStats }: CategoryBreakdownTableProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        No category data available
      </p>
    );
  }

  // Sort by average score (descending)
  const sortedData = [...data].sort((a, b) => {
    const aScore = a.avgOverallScore ?? 0;
    const bScore = b.avgOverallScore ?? 0;
    return bScore - aScore;
  });

  const maxScore = 100;

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-300 dark:border-gray-600">
            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Category
            </th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Attempts
            </th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Known
            </th>
            <th className="text-right py-2.5 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300 min-w-[300px]">
              Average Score
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((stat) => {
            const category = categories.find(c => c.id === stat.category);
            const totalAttempts = stat.sentenceAttempts + stat.wordAttempts;
            const totalKnown = stat.sentencesKnownCount + stat.wordsKnownCount;
            const wordCount = wordStats?.byCategory[stat.category] || 0;
            const barWidth = stat.avgOverallScore !== undefined
              ? (stat.avgOverallScore / maxScore) * 100
              : 0;

            return (
              <tr
                key={stat.category}
                className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer"
                title={`${category?.labelEn || stat.category}: ${stat.avgOverallScore?.toFixed(1) || 'N/A'} avg score, ${totalAttempts} attempts, ${totalKnown} known`}
              >
                <td className="py-3 px-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {category?.labelEn || stat.category}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-700 dark:text-gray-300">
                  {totalAttempts > 0 ? totalAttempts : (wordCount > 0 ? `${wordCount} words` : '—')}
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-700 dark:text-gray-300">
                  {totalKnown > 0 ? totalKnown : '—'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-7 overflow-hidden group-hover:bg-gray-300 dark:group-hover:bg-gray-600 transition-colors">
                      {stat.avgOverallScore !== undefined ? (
                        <div
                          className="h-full bg-primary-500 dark:bg-primary-600 transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: `${barWidth}%` }}
                        >
                          {barWidth >= 12 && (
                            <span className="text-xs font-semibold text-white">
                              {stat.avgOverallScore.toFixed(1)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-xs text-gray-400 dark:text-gray-500">No data</span>
                        </div>
                      )}
                    </div>
                    {stat.avgOverallScore !== undefined && (
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 min-w-[50px] text-right group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {stat.avgOverallScore.toFixed(1)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

