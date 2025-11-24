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
import PremiumRecordButton from '@/components/common/PremiumRecordButton';

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
  const recordingFileExists = Boolean(audioUrl);

  // Determine current state
  const isReadyToRecord = !isRecording && !recordingFileExists;
  const isRecordingInProgress = isRecording;
  const isReviewState = !isRecording && recordingFileExists;

  return (
    <div className="space-y-6">
      {/* Dynamic Recording Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-4">
          {/* State 1: Ready to Record - Single large red mic button */}
          {isReadyToRecord && (
            <PremiumRecordButton
              isRecording={false}
              onClick={startRecording}
              disabled={submitting}
              size="lg"
            />
          )}

          {/* State 2: Recording in Progress - Large red button with stop icon and pulsing */}
          {isRecordingInProgress && (
            <PremiumRecordButton
              isRecording={true}
              onClick={stopRecording}
              disabled={submitting}
              size="lg"
            />
          )}

          {/* State 3: Review - Two buttons side-by-side */}
          {isReviewState && (
            <>
              {/* Secondary Button (Left): Reset/Retry */}
              <button
                onClick={resetRecording}
                disabled={submitting}
                className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Reset recording"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>

              {/* Main Button (Right): Green Submit button */}
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Submit recording"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin w-6 h-6"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span className="text-xs font-medium">Submitting...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-7 h-7"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-xs font-medium">Submit</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Pronunciation Feedback Panel */}
      <PronunciationFeedbackPanel {...panelProps} />
    </div>
  );
}

