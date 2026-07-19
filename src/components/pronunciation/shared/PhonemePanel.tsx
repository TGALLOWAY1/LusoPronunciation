import type { NormalizedWordFeedback } from './types';
import { getPhonemeById, getPhonemeDisplayLabel } from '@/lib/phonemeMetadata';
import { findHomograph } from '@/lib/homographs';
import type { TrustLevel } from '@/lib/assessmentTrust';

interface PhonemePanelProps {
  word?: NormalizedWordFeedback | null;
  onClose?: () => void;
  trustLevel?: TrustLevel;
}

/**
 * Ring color for per-phoneme score circles, matching the app's score bands.
 */
function getPhonemeRingColor(score: number): string {
  if (score >= 80) return 'border-emerald-500 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300';
  if (score >= 60) return 'border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300';
  return 'border-rose-500 text-rose-700 dark:border-rose-400 dark:text-rose-300';
}

/**
 * Circular score indicator shown on the right of each phoneme card.
 */
function PhonemeScoreRing({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <div
      className={`shrink-0 w-11 h-11 sm:w-14 sm:h-14 rounded-full border-2 bg-white dark:bg-gray-800 flex flex-col items-center justify-center ${getPhonemeRingColor(rounded)}`}
      aria-label={`Score ${rounded} out of 100`}
    >
      <span className="text-sm sm:text-base font-bold leading-none">{rounded}</span>
      <span className="hidden sm:block text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">/100</span>
    </div>
  );
}

/**
 * Panel displaying phoneme details and tips for a selected word.
 */
export default function PhonemePanel({ word, onClose, trustLevel = 'trusted' }: PhonemePanelProps) {
  // Empty state: no word selected
  if (!word) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sound Details (Phonemes & Tips)
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click a word in the sentence to see tips for its sounds.
          </p>
        </div>
      </div>
    );
  }

  const problemPhonemes = word.phonemes?.filter(p => p.isProblem) || [];
  // Reference-only mode: phonemes came from the curated canonical list with no
  // Azure scores. In that mode we render the reference sounds WITHOUT any score
  // ring or "performing well" verdict.
  const hasPhonemeScores = word.phonemes?.some(p => typeof p.score === 'number') ?? false;
  const wordScore = word.score ?? word.accuracyScore;
  const wordLevel = word.level || (wordScore >= 90 ? 'excellent' : wordScore >= 80 ? 'good' : wordScore >= 70 ? 'ok' : 'practice');
  const homograph = findHomograph(word.text);

  return (
    <div
      data-testid="sound-details-panel"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Sound Details (Phonemes & Tips)
          </h3>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            <span className="text-primary-600 dark:text-primary-400">{word.text}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Word score: {wordScore}/100 • {wordLevel}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Tap any word in the sentence to inspect its sounds.
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {trustLevel === 'untrusted' && (
        <div
          data-testid="phoneme-panel-untrusted"
          className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Phoneme tips are hidden for this attempt because the audio couldn't be scored reliably.
            Re-record the full sentence in a quieter room to see detailed coaching.
          </p>
        </div>
      )}

      {trustLevel === 'degraded' && (
        <div
          data-testid="phoneme-panel-degraded"
          className="rounded-lg p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
        >
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Parts of this recording were hard to score — tips below may be less precise than usual.
          </p>
        </div>
      )}

      {homograph && trustLevel !== 'untrusted' && (
        <div
          data-testid="phoneme-panel-homograph"
          className="rounded-lg p-3 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20"
        >
          <p className="text-xs text-indigo-900 dark:text-indigo-200 mb-1">
            <strong>{homograph.form}</strong> has more than one common pronunciation in Brazilian
            Portuguese. Azure scored the reading that best matched your audio.
          </p>
          <ul className="text-xs text-indigo-900 dark:text-indigo-200 space-y-0.5">
            {homograph.readings.map((r, i) => (
              <li key={i}>
                <span className="font-mono">/{r.ipa}/</span> &mdash; {r.meaning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {trustLevel !== 'untrusted' && (!word.phonemes || word.phonemes.length === 0) && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            No phoneme data available for this word yet.
          </p>
        </div>
      )}

      {/* How to pronounce these sounds */}
      {trustLevel !== 'untrusted' && word.phonemes && word.phonemes.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            🔊 How to pronounce these sounds:
          </h4>
          <div className="space-y-3">
            {word.phonemes.map((phoneme, index) => {
              const metadata = getPhonemeById(phoneme.symbol);
              const displayLabel = getPhonemeDisplayLabel(phoneme.symbol);

              if (metadata) {
                const desc = metadata.englishApprox || metadata.articulation || '';
                const tip = metadata.teachingTips?.[0] || '';
                const ptEx = metadata.exampleWords?.map(w => w.pt).join(', ') || '';
                const enEx = metadata.englishExamples?.join(', ') || '';

                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200/70 dark:border-gray-700 flex items-center gap-3 sm:gap-4"
                  >
                    <div className="shrink-0 min-w-10 h-10 sm:min-w-12 sm:h-12 px-2 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className={`font-bold text-primary-700 dark:text-primary-300 font-mono whitespace-nowrap ${displayLabel.length > 3 ? 'text-[11px] sm:text-xs' : 'text-lg'}`}>
                        {displayLabel}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200">
                        <strong className="font-semibold">How to say it:</strong> {desc}
                      </p>
                      {tip && (
                        <p className="text-xs text-primary-700 dark:text-primary-300 mt-1">
                          💡 {tip}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        {ptEx && (
                          <span>
                            <strong className="text-gray-600 dark:text-gray-300">PT:</strong> <em>{ptEx}</em>
                          </span>
                        )}
                        {enEx && (
                          <span>
                            <strong className="text-gray-600 dark:text-gray-300">EN:</strong> <em>{enEx}</em>
                          </span>
                        )}
                      </div>
                    </div>
                    {typeof phoneme.score === 'number' && (
                      <PhonemeScoreRing score={phoneme.score} />
                    )}
                  </div>
                );
              } else {
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 border border-gray-200/70 dark:border-gray-700 flex items-center gap-3 sm:gap-4"
                  >
                    <div className="shrink-0 min-w-10 h-10 sm:min-w-12 sm:h-12 px-2 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                      <span className={`font-bold text-primary-700 dark:text-primary-300 font-mono whitespace-nowrap ${displayLabel.length > 3 ? 'text-[11px] sm:text-xs' : 'text-lg'}`}>
                        {displayLabel}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        No extra info available for this sound yet.
                      </p>
                      {phoneme.tip && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {phoneme.tip}
                        </p>
                      )}
                    </div>
                    {typeof phoneme.score === 'number' && (
                      <PhonemeScoreRing score={phoneme.score} />
                    )}
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {trustLevel !== 'untrusted' &&
        hasPhonemeScores &&
        problemPhonemes.length === 0 &&
        word.phonemes &&
        word.phonemes.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ✅ All phonemes are performing well!
            </p>
          </div>
        )}
    </div>
  );
}
