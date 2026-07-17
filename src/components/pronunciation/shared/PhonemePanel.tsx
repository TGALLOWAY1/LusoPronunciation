import type { NormalizedWordFeedback } from './types';
import { findHomograph } from '@/lib/homographs';
import type { TrustLevel } from '@/lib/assessmentTrust';
import {
  buildPronunciationGuide,
  getEyeDialectSound,
  getReferenceWord,
} from '@/lib/pronunciationGuide';

interface PhonemePanelProps {
  word?: NormalizedWordFeedback | null;
  onClose?: () => void;
  trustLevel?: TrustLevel;
}

/**
 * Learner-facing pronunciation guide for the selected word.
 * Assessment phonemes remain available internally for scoring, but the UI uses
 * English respelling, familiar reference words, and Portuguese spelling rules.
 */
export default function PhonemePanel({
  word,
  onClose,
  trustLevel = 'trusted',
}: PhonemePanelProps) {
  if (!word) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Pronunciation guide
        </h3>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click a word in the sentence to see how to say it.
          </p>
        </div>
      </div>
    );
  }

  const guidePhonemes = word.guidePhonemes ?? word.phonemes?.map((phoneme) => phoneme.symbol) ?? [];
  const guide = buildPronunciationGuide({
    word: word.text,
    phonemes: guidePhonemes,
    pronunciationNote: word.pronunciationNote,
  });
  const problemSounds = word.phonemes?.filter((phoneme) => phoneme.isProblem) ?? [];
  const scoredSounds = word.phonemes?.filter((phoneme) => typeof phoneme.score === 'number') ?? [];
  const wordScore = word.score ?? word.accuracyScore;
  const wordLevel = word.level || (wordScore >= 90 ? 'excellent' : wordScore >= 80 ? 'good' : wordScore >= 70 ? 'ok' : 'practice');
  const homograph = findHomograph(word.text);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Pronunciation guide
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            <span className="font-semibold text-primary-600 dark:text-primary-400">{word.text}</span>
            {' '}• Score {wordScore}/100 • {wordLevel}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Tap any word in the sentence to inspect its pronunciation.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close pronunciation guide"
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
            Personalized sound coaching is hidden because this recording could not be scored reliably.
            The pronunciation and spelling guide below still comes from the reference word.
          </p>
        </div>
      )}

      {trustLevel === 'degraded' && (
        <div
          data-testid="phoneme-panel-degraded"
          className="rounded-lg p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20"
        >
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Parts of this recording were hard to score, so personalized coaching may be less precise than usual.
          </p>
        </div>
      )}

      {homograph && (
        <div
          data-testid="phoneme-panel-homograph"
          className="rounded-lg p-3 border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20"
        >
          <p className="text-xs text-indigo-900 dark:text-indigo-200 mb-1">
            <strong>{homograph.form}</strong> has more than one common pronunciation in Brazilian Portuguese.
            The intended sound depends on its meaning:
          </p>
          <ul className="text-xs text-indigo-900 dark:text-indigo-200 list-disc pl-4 space-y-0.5">
            {homograph.readings.map((reading) => (
              <li key={reading.meaning}>{reading.meaning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-primary-200 bg-primary-50 px-5 py-4 dark:border-primary-800 dark:bg-primary-900/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
          Say it like
        </p>
        <p className="mt-1 text-3xl font-bold tracking-wide text-gray-900 dark:text-white">
          {guide.respelling}
        </p>
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          English phonetic respelling — no special symbols needed.
        </p>
      </div>

      {guide.references.length > 0 && (
        <section aria-labelledby={`reference-words-${word.id}`}>
          <h4
            id={`reference-words-${word.id}`}
            className="text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            Reference words
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {guide.references.map((reference) => (
              <span
                key={`${reference.sound}-${reference.word}`}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200"
              >
                <strong>{reference.sound}</strong> like <strong>{reference.word}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section
        className="border-t border-gray-200 pt-4 dark:border-gray-700"
        aria-labelledby={`spelling-rules-${word.id}`}
      >
        <h4
          id={`spelling-rules-${word.id}`}
          className="text-sm font-semibold text-gray-800 dark:text-gray-200"
        >
          The spelling rule
        </h4>
        <div className="mt-2 space-y-2">
          {guide.spellingRules.map((rule) => (
            <p
              key={rule.spelling}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-gray-800 dark:border-amber-800/70 dark:bg-amber-900/20 dark:text-gray-200"
            >
              <strong>{rule.spelling}</strong> = <strong>{rule.sound}</strong>
              {rule.referenceWord && <> (like <strong>{rule.referenceWord}</strong>)</>}
            </p>
          ))}
        </div>
      </section>

      {trustLevel !== 'untrusted' && problemSounds.length > 0 && (
        <section
          className="border-t border-gray-200 pt-4 dark:border-gray-700"
          aria-labelledby={`focus-sounds-${word.id}`}
        >
          <h4
            id={`focus-sounds-${word.id}`}
            className="text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            Focus for your next try
          </h4>
          <ul className="mt-2 space-y-2">
            {problemSounds.map((phoneme, index) => {
              const focusPhoneme = index === 0 && /^r/i.test(word.text) && /^(r|r_tap)$/i.test(phoneme.symbol)
                ? 'HH'
                : phoneme.symbol;
              const sound = getEyeDialectSound(focusPhoneme);
              const referenceWord = getReferenceWord(focusPhoneme);
              return (
                <li
                  key={`${phoneme.symbol}-${index}`}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="mt-0.5 text-rose-500 dark:text-rose-400">•</span>
                  <span>
                    Make the <strong>“{sound}”</strong> sound slowly and clearly
                    {referenceWord ? <>—use <strong>{referenceWord}</strong> as your model.</> : '.'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {trustLevel !== 'untrusted' && problemSounds.length === 0 && scoredSounds.length > 0 && (
        <p className="border-t border-gray-200 pt-4 text-sm text-emerald-600 dark:border-gray-700 dark:text-emerald-400">
          ✓ Every sound scored well. Try the whole word once more at a natural pace.
        </p>
      )}
    </div>
  );
}
