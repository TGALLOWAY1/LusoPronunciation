import { useMemo, useCallback, useEffect } from 'react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { useLivePronunciationPractice } from '@/hooks/useLivePronunciationPractice';
import { PronunciationFeedbackPanel, type PronunciationFeedbackPanelProps } from '@/components/pronunciation';
import SentenceResultView from '@/components/practice/SentenceResultView';
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
  activeTab?: 'practice' | 'history';
  onTabChange?: (tab: 'practice' | 'history') => void;
}

/**
 * Builds normalized audio variants from sentence audio URLs, including user recording.
 * Only includes the native audio variant that matches the selected voice preference.
 */
function buildSentenceAudioVariants(
  sentence: Sentence,
  userAudioUrl: string | null,
  selectedVoice: 'male' | 'female'
): NormalizedAudioVariant[] {
  const variants: NormalizedAudioVariant[] = [];

  const nativeAudioUrl = selectedVoice === 'male' ? sentence.audioMaleUrl : sentence.audioFemaleUrl;
  if (nativeAudioUrl) {
    variants.push({
      type: 'native',
      url: nativeAudioUrl,
    });
  }

  if (userAudioUrl) {
    variants.push({
      type: 'user',
      url: userAudioUrl,
    });
  }

  return variants;
}

export default function LivePracticeSection({
  sentence,
  sessionId,
  onCurrentAttemptChange,
  onRecordingUrlChange,
  activeTab = 'practice',
  onTabChange,
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
    attemptState,
    attempts,
    currentAttempt,
    rawAzureResponse,
    submitAttempt,
    cancelAnalysis,
    dailyQuota,
  } = useLivePronunciationPractice();

  useEffect(() => {
    if (onCurrentAttemptChange) {
      onCurrentAttemptChange(currentAttempt);
    }
  }, [currentAttempt, onCurrentAttemptChange]);

  useEffect(() => {
    if (onRecordingUrlChange) {
      onRecordingUrlChange(audioUrl);
    }
  }, [audioUrl, onRecordingUrlChange]);

  // Reset recording when sentence changes (but preserve it after submission for current sentence)
  useEffect(() => {
    resetRecording();
  }, [sentence.id, resetRecording]);

  const handleSubmit = useCallback(async () => {
    if (!audioUrl) return;

    await submitAttempt(
      sentence.id,
      sentence.textPt,
      sessionId
        ? {
            sessionId,
            sentenceId: sentence.id,
            difficulty: sentence.difficulty,
            category: sentence.categoryId,
          }
        : null
    );
  }, [sentence, sessionId, audioUrl, submitAttempt]);

  const sentenceAudio = useMemo(() => {
    return buildSentenceAudioVariants(sentence, audioUrl, selectedVoice);
  }, [sentence, audioUrl, selectedVoice]);

  const wordAudios = useMemo(() => {
    return buildWordAudioVariantsForSentence(sentence, selectedVoice);
  }, [sentence, selectedVoice]);

  const normalizedWords = useMemo(() => {
    if (currentAttempt && currentAttempt.wordScores && currentAttempt.wordScores.length > 0) {
      return adaptWordScoresToNormalized(currentAttempt.wordScores, rawAzureResponse);
    }
    return [];
  }, [currentAttempt, rawAzureResponse]);

  const enrichedWords = useMemo(() => {
    if (normalizedWords.length === 0) return normalizedWords;
    return enrichWordsWithCanonicalData(sentence, normalizedWords, canonicalWordMap);
  }, [sentence, normalizedWords, canonicalWordMap]);

  // Token-aligned word scores for the sentence display (mirrors PronunciationFeedbackPanel logic).
  const tokenWordScores = useMemo(() => {
    const tokens = sentence.textPt.trim().split(/\s+/);
    return tokens.map((token, index) => {
      const normalizedWord =
        enrichedWords.find((w) => {
          if (w.index !== undefined) return w.index === index;
          const parsedIndex = Number.isFinite(Number(w.id)) ? Number(w.id) : undefined;
          return parsedIndex === index;
        }) ?? enrichedWords[index];

      return {
        word: token,
        overallScore: normalizedWord?.score ?? normalizedWord?.accuracyScore ?? 0,
        normalizedWord,
      };
    });
  }, [sentence.textPt, enrichedWords]);

  // Pre-scored-state panel props (shows sentence + native audio before assessment).
  const panelProps: PronunciationFeedbackPanelProps = useMemo(
    () => ({
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
      hideHeaderContent: false,
      showDifficultyBadge: false,
    }),
    [attempts, currentAttempt, sentence, sentenceAudio, wordAudios, enrichedWords]
  );

  const canSubmit = Boolean(audioUrl) && attemptState !== 'submitting' && attemptState !== 'recording';
  const recordingFileExists = Boolean(audioUrl);

  const isScoredState = attemptState === 'scored';
  const isReadyToRecord = attemptState === 'idle' || (!recordingFileExists && attemptState !== 'recording');
  const isRecordingInProgress = attemptState === 'recording' || isRecording;
  const isReviewState =
    recordingFileExists &&
    !isScoredState &&
    (attemptState === 'recorded' ||
      attemptState === 'submitting' ||
      attemptState === 'error' ||
      attemptState === 'canceled');

  const quotaExhausted = Boolean(dailyQuota) && dailyQuota!.remaining <= 0;
  const quotaLow = Boolean(dailyQuota) && dailyQuota!.remaining > 0 && dailyQuota!.remaining <= 5;

  return (
    <div className="space-y-6">
      {/* Scored state: focused result view */}
      {isScoredState && currentAttempt && (
        <SentenceResultView
          sentenceText={sentence.textPt}
          tokenWordScores={tokenWordScores}
          words={enrichedWords}
          attempt={currentAttempt}
          difficulty={sentence.difficulty}
          activeTab={activeTab}
          onTabChange={onTabChange ?? (() => {})}
        />
      )}

      {/* Pre-scored states: sentence + native audio above recording controls */}
      {!isScoredState && (
        <>
          {onTabChange && (
            <div className="flex items-center justify-end">
              <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => onTabChange('practice')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'practice'
                      ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Practice
                </button>
                <button
                  onClick={() => onTabChange('history')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    (activeTab as string) === 'history'
                      ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  History
                </button>
              </div>
            </div>
          )}
          <PronunciationFeedbackPanel {...panelProps} />
        </>
      )}

      {/* Dynamic Recording Controls */}
      <div className="space-y-4">
        {dailyQuota && (
          <div className="flex justify-center">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                quotaExhausted
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                  : quotaLow
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
              title={`Daily limit resets at 00:00 UTC. Limit: ${dailyQuota.limit}.`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  quotaExhausted ? 'bg-red-500' : quotaLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {quotaExhausted
                ? 'Daily limit reached — resets at 00:00 UTC'
                : `${dailyQuota.remaining} of ${dailyQuota.limit} attempts left today`}
            </span>
          </div>
        )}
        <div className="flex items-center justify-center gap-4">
          {isReadyToRecord && (
            <PremiumRecordButton
              isRecording={false}
              onClick={startRecording}
              disabled={submitting || quotaExhausted}
              size="lg"
            />
          )}

          {isRecordingInProgress && (
            <PremiumRecordButton
              isRecording={true}
              onClick={stopRecording}
              disabled={submitting}
              size="lg"
            />
          )}

          {isReviewState && (
            <>
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

              <button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Submit recording"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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

          {isScoredState && (
            <PremiumRecordButton
              isRecording={false}
              onClick={() => {
                resetRecording();
                setTimeout(() => startRecording(), 0);
              }}
              disabled={false}
              size="lg"
            />
          )}
        </div>

        {isScoredState && (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            Tap to try again
          </p>
        )}

        {submitting && (
          <div className="flex justify-center">
            <button
              onClick={cancelAnalysis}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
              Cancel analysis
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={resetRecording}
              className="self-start sm:self-auto px-3 py-1.5 rounded-md border border-red-300 dark:border-red-700 text-xs font-medium bg-white/60 dark:bg-red-950/30 hover:bg-white dark:hover:bg-red-950/50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
