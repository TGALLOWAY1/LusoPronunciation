import type { NormalizedWordFeedback } from './types';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import { findHomograph } from '@/lib/homographs';
import type { TrustLevel } from '@/lib/assessmentTrust';

interface PhonemePanelProps {
  word?: NormalizedWordFeedback | null;
  onClose?: () => void;
  trustLevel?: TrustLevel;
}

/**
 * Panel displaying phoneme details and tips for a selected word.
 */
export default function PhonemePanel({ word, onClose, trustLevel = 'trusted' }: PhonemePanelProps) {
  // Empty state: no word selected
  if (!word) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
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
  const wordScore = word.score ?? word.accuracyScore;
  const wordLevel = word.level || (wordScore >= 90 ? 'excellent' : wordScore >= 80 ? 'good' : wordScore >= 70 ? 'ok' : 'practice');
  const homograph = findHomograph(word.text);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
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
            Overall score: {wordScore}/100 • Level: {wordLevel}
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
              
              if (metadata) {
                const desc = metadata.englishApprox || metadata.articulation || '';
                const tip = metadata.teachingTips?.[0] || '';
                const ptEx = metadata.exampleWords?.map(w => w.pt).join(', ') || '';
                const enEx = metadata.englishExamples?.join(', ') || '';

                return (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {phoneme.symbol}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          <strong>How to say it:</strong> {desc}
                        </p>
                        {tip && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                            💡 {tip}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                          {ptEx && (
                            <span>
                              <strong>PT:</strong> <em>{ptEx}</em>
                            </span>
                          )}
                          {enEx && (
                            <span>
                              <strong>EN:</strong> <em>{enEx}</em>
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {phoneme.score}/100
                      </span>
                    </div>
                  </div>
                );
              } else {
                return (
                  <div
                    key={index}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {phoneme.symbol}
                      </span>
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
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {phoneme.score}/100
                      </span>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        </div>
      )}

      {/* Tips section for problem phonemes */}
      {trustLevel !== 'untrusted' && problemPhonemes.length > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            💡 Focus Areas:
          </h4>
          <ul className="space-y-2">
            {problemPhonemes.map((phoneme, index) => {
              const metadata = getPhonemeById(phoneme.symbol);
              const desc = metadata?.englishApprox || metadata?.articulation || '';
              const tip = phoneme.tip || metadata?.teachingTips?.[0] || desc || `Score: ${phoneme.score}/100 - needs practice`;
              
              return (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="text-rose-500 dark:text-rose-400 mt-0.5">•</span>
                  <span>
                    <strong className="font-medium">{phoneme.symbol}:</strong>{' '}
                    {tip}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {trustLevel !== 'untrusted' &&
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
