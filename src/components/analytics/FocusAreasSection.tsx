import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type { ImprovementItem, PhonemeStats } from '@/lib/types';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import ImprovementRow from './ImprovementRow';
import { resolveItemLabel } from './itemLabels';

export interface MispronouncedWord {
  token: string;
  count: number;
}

export interface RetriedPhrase {
  id: string;
  label: string;
  retries: number;
}

interface FocusAreasSectionProps {
  weakPhonemes: PhonemeStats[];
  needsPractice: ImprovementItem[];
  mispronouncedWords: MispronouncedWord[];
  retriedPhrases: RetriedPhrase[];
  wordLabels: Map<string, string>;
  sentenceLabels: Map<string, string>;
}

/**
 * Focus Areas: weakest sounds, items that need more practice, frequently mispronounced
 * words, and phrases that were repeatedly retried.
 */
export default function FocusAreasSection({
  weakPhonemes,
  needsPractice,
  mispronouncedWords,
  retriedPhrases,
  wordLabels,
  sentenceLabels,
}: FocusAreasSectionProps) {
  const hasData =
    weakPhonemes.length > 0 ||
    needsPractice.length > 0 ||
    mispronouncedWords.length > 0 ||
    retriedPhrases.length > 0;

  return (
    <section id="focus" className="card scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Focus Areas</h2>
        </div>
        <Link
          to="/review"
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Review weak items
        </Link>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          No problem areas detected yet. Practice more to surface the sounds, words, and
          phrases worth extra attention.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {weakPhonemes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Hardest Sounds
              </h3>
              <div className="space-y-2">
                {weakPhonemes.map((p) => {
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
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                        {Math.round(p.avgOverallScore ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {needsPractice.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Needs More Practice
              </h3>
              <div className="space-y-2">
                {needsPractice.map((item) => (
                  <ImprovementRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    label={resolveItemLabel(item, wordLabels, sentenceLabels)}
                    showAsRegression={item.delta <= 0}
                  />
                ))}
              </div>
            </div>
          )}

          {mispronouncedWords.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Frequently Mispronounced Words
              </h3>
              <div className="flex flex-wrap gap-2">
                {mispronouncedWords.map((w) => (
                  <span
                    key={w.token}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  >
                    {w.token}
                    <span className="text-red-400 dark:text-red-500">×{w.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {retriedPhrases.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Most Retried Phrases
              </h3>
              <div className="space-y-2">
                {retriedPhrases.map((phrase) => (
                  <div
                    key={phrase.id}
                    className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span
                      className="truncate text-sm text-gray-900 dark:text-gray-100"
                      title={phrase.label}
                    >
                      {phrase.label}
                    </span>
                    <span className="shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400">
                      {phrase.retries} retries
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
