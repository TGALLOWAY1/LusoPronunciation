import type { NormalizedWordFeedback } from '@/components/pronunciation/shared/types';
import { getPhonemeById } from '@/lib/phonemeMetadata';

interface PhonemeDetailListProps {
  word: NormalizedWordFeedback;
}

function dotColor(score: number): string | null {
  if (score >= 85) return null;
  if (score >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

export default function PhonemeDetailList({ word }: PhonemeDetailListProps) {
  const phonemes = word.phonemes ?? [];

  if (phonemes.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No phoneme data available for this word.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
      {phonemes.map((phoneme, index) => {
        const metadata = getPhonemeById(phoneme.symbol);
        const articulation = metadata?.englishApprox || metadata?.articulation || '';
        const tip = metadata?.teachingTips?.[0] || phoneme.tip || '';
        const ptExamples = metadata?.exampleWords?.map((w) => w.pt).filter(Boolean).join(', ') || '';
        const enExamples = metadata?.englishExamples?.join(', ') || '';
        const dot = dotColor(phoneme.score);

        return (
          <li
            key={`${phoneme.symbol}-${index}`}
            className="py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-start gap-4">
              <div className="flex items-center gap-2 min-w-[3rem]">
                <span className="font-mono text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {phoneme.symbol}
                </span>
                {dot && (
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${dot}`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                {articulation && (
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="text-gray-500 dark:text-gray-400">How to say it:</span>{' '}
                    {articulation}
                  </p>
                )}
                {tip && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                    <span aria-hidden="true">💡</span>
                    <span>{tip}</span>
                  </p>
                )}
                {(ptExamples || enExamples) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {ptExamples && (
                      <>
                        <span className="font-medium">PT:</span> {ptExamples}
                      </>
                    )}
                    {ptExamples && enExamples && <span className="mx-2">|</span>}
                    {enExamples && (
                      <>
                        <span className="font-medium">EN:</span> {enExamples}
                      </>
                    )}
                  </p>
                )}
              </div>

              <span className="font-mono text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                ({phoneme.score}/100)
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
