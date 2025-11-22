import { memo, useMemo } from 'react';
import type { AttemptScore } from '@/types/pronunciation';
import type { Sentence } from '@/lib/types';
import type { NormalizedWordFeedback, NormalizedAudioVariant } from '@/components/pronunciation/shared/types';
import { PronunciationFeedbackPanel } from '@/components/pronunciation';
import type { PronunciationFeedbackPanelProps } from '@/components/pronunciation';

export interface SentenceFeedbackProps {
  /** Sentence data for context (text, translation, audio, etc.) - required for sentence practice */
  sentence?: Sentence;
  /** Full array of attempts */
  attempts?: AttemptScore[];
  /** Current attempt to display (optional, defaults to latest from attempts if provided) */
  currentAttempt?: AttemptScore | null;
  /** Fallback text if sentence is not provided (for word practice compatibility) */
  fallbackText?: string;
  /** Fallback translation if sentence is not provided */
  fallbackTranslation?: string;
  /** Fallback difficulty if sentence is not provided */
  fallbackDifficulty?: number;
}

/**
 * Maps WordScore array to NormalizedWordFeedback array.
 * This adapter allows word scores from live attempts to be used with shared components.
 */
export function mapWordScoresToNormalized(
  wordScores: AttemptScore['wordScores'] | undefined,
  startIndex: number = 0
): NormalizedWordFeedback[] {
  if (!wordScores || wordScores.length === 0) {
    return [];
  }

  return wordScores.map((ws, idx) => {
    const score = ws.accuracy;
    const level: NormalizedWordFeedback['level'] = 
      score >= 90 ? 'excellent' :
      score >= 80 ? 'good' :
      score >= 70 ? 'ok' : 'practice';

    return {
      id: `word_${startIndex + idx}`,
      text: ws.word,
      accuracyScore: score,
      errorType: ws.errorType || null,
      phonemes: undefined, // WordScore doesn't have phonemes yet, but can be added later
      index: startIndex + idx,
      level,
      score,
    };
  });
}

/**
 * Builds normalized audio variants from sentence audio URLs.
 */
function buildSentenceAudioVariants(sentence: Sentence): NormalizedAudioVariant[] {
  const variants: NormalizedAudioVariant[] = [];
  
  if (sentence.audioMaleUrl) {
    variants.push({
      type: 'native',
      url: sentence.audioMaleUrl,
    });
  }
  
  if (sentence.audioFemaleUrl && sentence.audioFemaleUrl !== sentence.audioMaleUrl) {
    variants.push({
      type: 'native',
      url: sentence.audioFemaleUrl,
    });
  }
  
  return variants;
}

/**
 * SentenceFeedback displays pronunciation assessment results.
 * 
 * This is now a thin wrapper around PronunciationFeedbackPanel that:
 * - Builds generic panel props from practice-specific data
 * - Delegates all layout and visualization to the shared panel component
 * - Keeps practice-specific extras (if any) outside the panel
 */
function SentenceFeedback({ 
  sentence,
  attempts = [],
  currentAttempt: providedCurrentAttempt,
  fallbackText,
  fallbackTranslation,
  fallbackDifficulty,
}: SentenceFeedbackProps) {
  // Derive current attempt if not provided but attempts array is available
  const currentAttempt = useMemo(() => {
    if (providedCurrentAttempt !== undefined) {
      return providedCurrentAttempt;
    }
    if (attempts && attempts.length > 0) {
      return attempts[0]; // Most recent is first in array
    }
    return null;
  }, [providedCurrentAttempt, attempts]);

  // Normalize word scores for the panel
  const normalizedWords = useMemo(() => {
    if (currentAttempt && currentAttempt.wordScores && currentAttempt.wordScores.length > 0) {
      return mapWordScoresToNormalized(currentAttempt.wordScores);
    }
    return undefined;
  }, [currentAttempt]);

  // Build sentence audio variants (only if sentence is provided)
  const sentenceAudio = useMemo(() => {
    if (sentence) {
      return buildSentenceAudioVariants(sentence);
    }
    return [];
  }, [sentence]);

  // Get text, translation, and difficulty from sentence or fallbacks
  const sentenceText = sentence?.textPt || fallbackText || '';
  const translationText = sentence?.translationEn || fallbackTranslation;
  const difficulty = sentence?.difficulty || fallbackDifficulty;

  // Build panel props
  const panelProps: PronunciationFeedbackPanelProps = useMemo(() => ({
    attempts: attempts,
    currentAttempt: currentAttempt,
    sentenceText: sentenceText,
    translationText: translationText,
    difficulty: difficulty,
    sentenceAudio: sentenceAudio.length > 0 ? sentenceAudio : undefined,
    wordAudios: undefined, // Per-word audio not wired yet for live attempts
    words: normalizedWords,
    title: undefined, // No title for practice page
    showDevControls: false,
  }), [attempts, currentAttempt, sentenceText, translationText, difficulty, sentenceAudio, normalizedWords]);

  // Empty state - no attempts yet
  if (!currentAttempt && (!attempts || attempts.length === 0)) {
    return (
      <div className="mt-6 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
        <p className="text-gray-600 dark:text-gray-400">
          Record your pronunciation to see detailed feedback and scores.
        </p>
      </div>
    );
  }

  // Delegate to the generic panel component
  return (
    <div className="mt-6">
      <PronunciationFeedbackPanel {...panelProps} />
    </div>
  );
}

export default memo(SentenceFeedback);
