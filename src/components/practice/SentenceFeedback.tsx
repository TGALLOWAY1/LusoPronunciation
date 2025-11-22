import { memo, useMemo } from 'react';
import type { AttemptScore } from '@/types/pronunciation';
import type { Sentence } from '@/lib/types';
import type { NormalizedAudioVariant } from '@/components/pronunciation/shared/types';
import { PronunciationFeedbackPanel } from '@/components/pronunciation';
import type { PronunciationFeedbackPanelProps } from '@/components/pronunciation';
import {
  adaptWordScoresToNormalized,
  buildWordAudioVariantsForSentence,
} from '@/components/pronunciation/shared';
import { useSettingsStore } from '@/state/settingsStore';

export interface SentenceFeedbackProps {
  /** Sentence data for context (text, translation, audio, etc.) - required for sentence practice */
  sentence?: Sentence;
  /** Full array of attempts */
  attempts?: AttemptScore[];
  /** Current attempt to display (optional, defaults to latest from attempts if provided) */
  currentAttempt?: AttemptScore | null;
  /** Raw Azure response for the current attempt (used for phoneme extraction) */
  rawAzureResponse?: any;
  /** Fallback text if sentence is not provided (for word practice compatibility) */
  fallbackText?: string;
  /** Fallback translation if sentence is not provided */
  fallbackTranslation?: string;
  /** Fallback difficulty if sentence is not provided */
  fallbackDifficulty?: number;
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
  rawAzureResponse,
  fallbackText,
  fallbackTranslation,
  fallbackDifficulty,
}: SentenceFeedbackProps) {
  const { selectedVoice } = useSettingsStore();

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

  // Normalize word scores for the panel, extracting phonemes from Azure response
  // Returns empty array if no word scores (not undefined)
  const normalizedWords = useMemo(() => {
    if (currentAttempt && currentAttempt.wordScores && currentAttempt.wordScores.length > 0) {
      return adaptWordScoresToNormalized(currentAttempt.wordScores, rawAzureResponse);
    }
    return [];
  }, [currentAttempt, rawAzureResponse]);

  // Build sentence audio variants (only if sentence is provided)
  const sentenceAudio = useMemo(() => {
    if (sentence) {
      return buildSentenceAudioVariants(sentence);
    }
    return [];
  }, [sentence]);

  // Build word audio variants from sentence wordRefs
  // Returns empty array if no sentence or wordRefs (not undefined)
  const wordAudios = useMemo(() => {
    if (sentence) {
      // Use selected voice from settings store
      return buildWordAudioVariantsForSentence(sentence, selectedVoice);
    }
    return [];
  }, [sentence, selectedVoice]);

  // Get text, translation, and difficulty from sentence or fallbacks
  const sentenceText = sentence?.textPt || fallbackText || '';
  const translationText = sentence?.translationEn || fallbackTranslation;
  const difficulty = sentence?.difficulty || fallbackDifficulty;

  // Build panel props
  // hideHeaderContent=true because SentenceCard already shows sentence text, translation, difficulty, and audio controls above
  // Don't pass sentenceAudio when hideHeaderContent is true to prevent "Compare Pronunciations" buttons from showing
  const panelProps: PronunciationFeedbackPanelProps = useMemo(() => ({
    attempts: attempts ?? [],
    currentAttempt: currentAttempt ?? null,
    sentenceText: sentenceText,
    translationText: translationText,
    difficulty: difficulty,
    sentenceAudio: undefined, // Never pass sentenceAudio in Practice - SentenceCard handles audio playback
    wordAudios: wordAudios.length > 0 ? wordAudios : undefined,
    words: normalizedWords.length > 0 ? normalizedWords : undefined,
    title: undefined, // No title for practice page
    showDevControls: false,
    hideHeaderContent: true, // Hide sentence text/translation/difficulty/audio since SentenceCard shows them above
  }), [attempts, currentAttempt, sentenceText, translationText, difficulty, wordAudios, normalizedWords]);

  // Always render the panel - it will handle empty state internally
  // No card wrapper needed - SentenceCard already provides the card container
  return (
    <div className="mt-6">
      <PronunciationFeedbackPanel {...panelProps} />
    </div>
  );
}

export default memo(SentenceFeedback);
