import { Award, TrendingUp } from 'lucide-react';
import type { ImprovementItem, PhonemeStats } from '@/lib/types';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import ImprovementRow from './ImprovementRow';
import { resolveItemLabel } from './itemLabels';

interface StrengthsSectionProps {
  mostImproved: ImprovementItem[];
  strongPhonemes: PhonemeStats[];
  wordLabels: Map<string, string>;
  sentenceLabels: Map<string, string>;
}

/**
 * Strengths: items the learner improved most over the window, plus their strongest sounds.
 */
export default function StrengthsSection({
  mostImproved,
  strongPhonemes,
  wordLabels,
  sentenceLabels,
}: StrengthsSectionProps) {
  const hasData = mostImproved.length > 0 || strongPhonemes.length > 0;

  return (
    <section id="strengths" className="card scroll-mt-20">
      <div className="flex items-center gap-2 mb-4">
        <Award size={18} className="text-green-500 dark:text-green-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Strengths</h2>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          Keep practicing — once you have a few attempts per item, your biggest gains
          and strongest sounds will appear here.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={15} className="text-green-500 dark:text-green-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Most Improved
              </h3>
            </div>
            {mostImproved.length > 0 ? (
              <div className="space-y-2">
                {mostImproved.map((item) => (
                  <ImprovementRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    label={resolveItemLabel(item, wordLabels, sentenceLabels)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No measurable gains yet in this period.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Strongest Sounds
            </h3>
            {strongPhonemes.length > 0 ? (
              <div className="space-y-2">
                {strongPhonemes.map((p) => {
                  const meta = getPhonemeById(p.phonemeId);
                  return (
                    <div
                      key={p.phonemeId}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div>
                        <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                          {meta?.ipa ?? p.phonemeId}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                          {p.attempts} reps
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {Math.round(p.avgOverallScore ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No standout sounds yet.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
