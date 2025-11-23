import { getPhonemeById } from '@/lib/phonemeMetadata';
import type { Word } from '@/lib/types';

interface PhonemePanelProps {
  word: Word;
}

/**
 * Panel displaying phoneme details and tips for a word during practice.
 * Uses canonical phoneme metadata from data/phoneme_metadata.json.
 */
export function PhonemePanel({ word }: PhonemePanelProps) {
  if (!word.phonemes || word.phonemes.length === 0) {
    return null;
  }

  const phonemeItems = word.phonemes
    .map((id) => getPhonemeById(id))
    .filter((p): p is NonNullable<ReturnType<typeof getPhonemeById>> => !!p);

  if (phonemeItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Pronunciation Breakdown
      </h4>
      
      <div className="space-y-3">
        {phonemeItems.map((p) => (
          <div key={p.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-md p-3 border border-gray-100 dark:border-gray-600">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-lg font-semibold text-primary-600 dark:text-primary-400 font-mono">
                {p.ipa}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                ({p.id})
              </span>
            </div>

            {p.teachingTips && p.teachingTips.length > 0 && (
              <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                {p.teachingTips[0]}
              </div>
            )}

            {p.exampleWords && p.exampleWords.length > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Ex: </span>
                {p.exampleWords.slice(0, 2).map((ex, i) => (
                  <span key={i}>
                    {ex.pt} {i < Math.min(p.exampleWords.length, 2) - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

