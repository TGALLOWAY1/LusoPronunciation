import { useMemo, useCallback, useEffect } from 'react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { useLivePronunciationPractice } from '@/hooks/useLivePronunciationPractice';
import { PronunciationFeedbackPanel, type PronunciationFeedbackPanelProps } from '@/components/pronunciation';
import {
  adaptWordScoresToNormalized,
  buildWordAudioVariantsForSentence,
  enrichWordsWithCanonicalData,
  type NormalizedAudioVariant,
} from '@/components/pronunciation/shared';
import { useSettingsStore } from '@/state/settingsStore';
import { useCanonicalWordMap } from '@/hooks/useCanonicalWordMap';

export interface LivePracticeSectionProps {
  sentence: Sentence;
  sessionId: string | null;
  onCurrentAttemptChange?: (attempt: AttemptScore | null) => void;
  onRecordingUrlChange?: (url: string | null) => void;
}

/**
 * Builds normalized audio variants from sentence audio URLs, including user recording.
 */
function buildSentenceAudioVariants(
  sentence: Sentence,
  userAudioUrl: string | null
): NormalizedAudioVariant[] {
  const variants: NormalizedAudioVariant[] = [];
  
  // Add native audio variants
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

  // Add user recording if available
  if (userAudioUrl) {
    variants.push({
      type: 'user',
      url: userAudioUrl,
    });
  }
  
  return variants;
}

/**
 * LivePracticeSection component for recording and assessing pronunciation in real-time.
 * 
 * Uses the useLivePronunciationPractice hook to handle recording, submission, and attempt management.
 * Displays results using PronunciationFeedbackPanel.
 */
export default function LivePracticeSection({ 
  sentence, 
  sessionId,
  onCurrentAttemptChange,
  onRecordingUrlChange,
}: LivePracticeSectionProps) {
  const { selectedVoice } = useSettingsStore();
  const canonicalWordMap = useCanonicalWordMap();
  
  const {
    isRecording,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    submitting,
    error,
    attempts,
    currentAttempt,
    rawAzureResponse,
    submitAttempt,
  } = useLivePronunciationPractice();

  // Notify parent of current attempt changes
  useEffect(() => {
    if (onCurrentAttemptChange) {
      onCurrentAttemptChange(currentAttempt);
    }
  }, [currentAttempt, onCurrentAttemptChange]);

  // Notify parent of recording URL changes
  useEffect(() => {
    if (onRecordingUrlChange) {
      onRecordingUrlChange(audioUrl);
    }
  }, [audioUrl, onRecordingUrlChange]);

  // Reset recording when sentence changes (but preserve it after submission for current sentence)
  useEffect(() => {
    resetRecording();
  }, [sentence.id, resetRecording]);

  // Handle submit button click
  const handleSubmit = useCallback(async () => {
    if (!audioUrl) {
      return; // Should be disabled, but guard anyway
    }

    await submitAttempt(
      sentence.id,
      sentence.textPt,
      sessionId ? {
        sessionId,
        sentenceId: sentence.id,
        difficulty: sentence.difficulty,
        category: sentence.categoryId,
      } : null
    );
  }, [sentence, sessionId, audioUrl, submitAttempt]);

  // Build sentence audio variants (native + user recording)
  const sentenceAudio = useMemo(() => {
    return buildSentenceAudioVariants(sentence, audioUrl);
  }, [sentence, audioUrl]);

  // Build word audio variants from sentence wordRefs
  const wordAudios = useMemo(() => {
    return buildWordAudioVariantsForSentence(sentence, selectedVoice);
  }, [sentence, selectedVoice]);

  // Normalize word scores for the panel, extracting phonemes from Azure response
  const normalizedWords = useMemo(() => {
    if (currentAttempt && currentAttempt.wordScores && currentAttempt.wordScores.length > 0) {
      return adaptWordScoresToNormalized(currentAttempt.wordScores, rawAzureResponse);
    }
    return [];
  }, [currentAttempt, rawAzureResponse]);

  const enrichedWords = useMemo(() => {
    if (normalizedWords.length === 0) {
      return normalizedWords;
    }
    return enrichWordsWithCanonicalData(sentence, normalizedWords, canonicalWordMap);
  }, [sentence, normalizedWords, canonicalWordMap]);

  // Build panel props
  const panelProps: PronunciationFeedbackPanelProps = useMemo(() => ({
    attempts: attempts ?? [],
    currentAttempt: currentAttempt ?? null,
    sentenceText: sentence.textPt,
    translationText: sentence.translationEn,
    difficulty: sentence.difficulty,
    sentenceAudio: sentenceAudio.length > 0 ? sentenceAudio : undefined,
    wordAudios: wordAudios.length > 0 ? wordAudios : undefined,
    words: enrichedWords.length > 0 ? enrichedWords : undefined,
    title: undefined,
    showDevControls: false,
    hideHeaderContent: false, // Show sentence text, translation, difficulty, and audio
  }), [attempts, currentAttempt, sentence, sentenceAudio, wordAudios, enrichedWords]);

  const canSubmit = Boolean(audioUrl) && !submitting && !isRecording;

  return (
    <div className="space-y-6">
      {/* Recording Controls */}
      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={submitting}
            className={`btn btn-md ${
              isRecording
                ? 'btn-danger'
                : 'btn-primary'
            }`}
          >
            {isRecording ? (
              <>
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                Stop Recording
              </>
            ) : (
              'Start Recording'
            )}
          </button>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn btn-md btn-secondary"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>

          {audioUrl && (
            <button
              onClick={resetRecording}
              disabled={submitting || isRecording}
              className="btn btn-md btn-outline"
            >
              Reset
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {currentAttempt?.latencyMs !== undefined && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Last attempt latency: {currentAttempt.latencyMs}ms
          </div>
        )}
      </div>

      {/* Pronunciation Feedback Panel */}
      <PronunciationFeedbackPanel {...panelProps} />
    </div>
  );
}

