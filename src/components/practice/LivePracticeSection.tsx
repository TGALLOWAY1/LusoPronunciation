import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Volume2 } from 'lucide-react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { useLivePronunciationPractice } from '@/hooks/useLivePronunciationPractice';
import InteractiveSentenceDisplay from '@/components/practice/InteractiveSentenceDisplay';
import ScoringPanel from '@/components/pronunciation/ScoringPanel';
import {
  adaptWordScoresToNormalized,
  enrichWordsWithCanonicalData,
  FocusAreasCard,
  PhonemePanel,
  type NormalizedWordFeedback,
} from '@/components/pronunciation/shared';
import { alignUiTokensToAzureWords } from '@/pipeline/sentenceWordRefs';
import { computeTrustLevel, getTrustMessage } from '@/lib/assessmentTrust';
import { useSettingsStore } from '@/state/settingsStore';
import { useCanonicalWordMap } from '@/hooks/useCanonicalWordMap';
import PremiumRecordButton from '@/components/common/PremiumRecordButton';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';

export interface LivePracticeSectionProps {
  sentence: Sentence;
  sessionId: string | null;
  onCurrentAttemptChange?: (attempt: AttemptScore | null) => void;
  onRecordingUrlChange?: (url: string | null) => void;
}

/**
 * The core sentence practice loop, laid out as a coaching flow:
 *
 *   1. The sentence (with optional translation) front and center.
 *   2. A paired "Listen | Record" panel — hear the native model, then record.
 *   3. After scoring: overall score with interpretation, sentence-wide focus
 *      areas, per-word sound details, and a concrete next step.
 */
export default function LivePracticeSection({
  sentence,
  sessionId,
  onCurrentAttemptChange,
  onRecordingUrlChange,
}: LivePracticeSectionProps) {
  const { selectedVoice } = useSettingsStore();
  const canonicalWordMap = useCanonicalWordMap();
  const [showEnglish, setShowEnglish] = useState(false);
  const [selectedWord, setSelectedWord] = useState<NormalizedWordFeedback | null>(null);

  const {
    isRecording,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    submitting,
    error,
    attemptState,
    currentAttempt,
    rawAzureResponse,
    submitAttempt,
    cancelAnalysis,
    clearAssessmentState,
    dailyQuota,
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

  // Reset recording and per-sentence UI state when sentence changes
  useEffect(() => {
    resetRecording();
    clearAssessmentState();
    setShowEnglish(false);
    setSelectedWord(null);
  }, [sentence.id, resetRecording, clearAssessmentState]);

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

  // Normalize word scores, extracting phonemes from Azure response
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

  const nativeAudioUrl = useMemo(() => {
    return (selectedVoice === 'male' ? sentence.audioMaleUrl : sentence.audioFemaleUrl) || null;
  }, [selectedVoice, sentence.audioMaleUrl, sentence.audioFemaleUrl]);
  const nativeAudioAvailable = Boolean(nativeAudioUrl);

  // UI rendering is driven from the centralized attempt lifecycle state.
  const isScoredState = attemptState === 'scored';
  const recordingFileExists = Boolean(audioUrl);
  const isReadyToRecord = attemptState === 'idle' || (!recordingFileExists && attemptState !== 'recording');
  const isRecordingInProgress = attemptState === 'recording' || isRecording;
  const isReviewState =
    recordingFileExists &&
    !isScoredState &&
    (attemptState === 'recorded' ||
      attemptState === 'submitting' ||
      attemptState === 'error' ||
      attemptState === 'canceled');

  const canSubmit = Boolean(audioUrl) && attemptState !== 'submitting' && attemptState !== 'recording';

  // ---------------------------------------------------------------------
  // Audio playback (native model + user's own take) via one shared element
  // ---------------------------------------------------------------------
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [activeAudio, setActiveAudio] = useState<'native' | 'user' | null>(null);

  const stopPlayback = useCallback(() => {
    audioElRef.current?.pause();
    setActiveAudio(null);
  }, []);

  const toggleAudio = useCallback(
    (type: 'native' | 'user', url: string) => {
      const el = audioElRef.current;
      if (!el) return;

      if (activeAudio === type) {
        el.pause();
        setActiveAudio(null);
        return;
      }

      el.pause();
      el.currentTime = 0;
      el.src = url;
      setActiveAudio(type);
      el.play().catch(() => setActiveAudio(null));
    },
    [activeAudio]
  );

  // Stop playback when the sentence changes or a recording starts
  useEffect(() => {
    stopPlayback();
  }, [sentence.id, isRecordingInProgress, stopPlayback]);

  // ---------------------------------------------------------------------
  // Word selection for the Sound Details panel
  // ---------------------------------------------------------------------

  // Auto-select the weakest word of the latest scored attempt so the panel
  // opens on the most useful coaching target.
  useEffect(() => {
    if (isScoredState && enrichedWords.length > 0) {
      const weakest = [...enrichedWords].sort(
        (a, b) => (a.score ?? a.accuracyScore ?? 100) - (b.score ?? b.accuracyScore ?? 100)
      )[0];
      setSelectedWord(weakest);
    } else {
      setSelectedWord(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAttempt?.attemptId, isScoredState, enrichedWords.length]);

  const tokenWordScores = useMemo(() => {
    const { uiTokens, azureIndicesPerToken } = alignUiTokensToAzureWords(sentence.textPt);
    return uiTokens.map((token, i) => {
      const azureIndices = azureIndicesPerToken[i];
      const firstAzureIndex = azureIndices[0];
      const normalizedWord =
        firstAzureIndex === undefined || enrichedWords.length === 0
          ? undefined
          : enrichedWords.find((w) => w.index === firstAzureIndex) ?? enrichedWords[firstAzureIndex];

      return {
        word: token,
        overallScore: normalizedWord
          ? normalizedWord.score ?? normalizedWord.accuracyScore ?? null
          : null,
        normalizedWord,
      };
    });
  }, [sentence.textPt, enrichedWords]);

  const handleWordClick = useCallback((wordData: { [key: string]: any }) => {
    const normalizedWord: NormalizedWordFeedback | undefined = wordData?.normalizedWord;
    if (normalizedWord) {
      setSelectedWord(normalizedWord);
    }
  }, []);

  const trustLevel = useMemo(
    () => (currentAttempt ? computeTrustLevel(currentAttempt) : 'trusted'),
    [currentAttempt]
  );
  const trustMessage = getTrustMessage(trustLevel);

  const quotaExhausted = Boolean(dailyQuota) && dailyQuota!.remaining <= 0;
  const quotaLow =
    Boolean(dailyQuota) && dailyQuota!.remaining > 0 && dailyQuota!.remaining <= 5;

  return (
    <div className="space-y-6">
      {/* Sentence — the thing being practiced, front and center */}
      <div className="flex flex-col items-center gap-y-2">
        <InteractiveSentenceDisplay
          sentenceText={sentence.textPt}
          wordScores={tokenWordScores}
          onWordClick={handleWordClick}
        />

        {sentence.translationEn && (
          <button
            type="button"
            onClick={() => setShowEnglish((prev) => !prev)}
            className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors"
            aria-pressed={showEnglish}
            aria-label={showEnglish ? 'Hide translation' : 'Show translation'}
          >
            {showEnglish ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>{showEnglish ? 'Hide translation' : 'Show translation'}</span>
          </button>
        )}

        {sentence.translationEn && showEnglish && (
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 italic text-center">
            {sentence.translationEn}
          </p>
        )}
      </div>

      {/* Listen | Record panel */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700">
          {/* Listen half */}
          <div className="flex flex-col items-center text-center gap-2 pb-5 sm:pb-0 sm:pr-4">
            <PremiumPlayButton
              isPlaying={activeAudio === 'native'}
              onClick={() => nativeAudioUrl && toggleAudio('native', nativeAudioUrl)}
              disabled={!nativeAudioAvailable}
              size="md"
            />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Listen</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {nativeAudioAvailable
                ? 'Hear the native pronunciation'
                : 'Native audio not available for this sentence'}
            </span>
            {audioUrl && (
              <button
                type="button"
                onClick={() => toggleAudio('user', audioUrl)}
                className={`mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeAudio === 'user'
                    ? 'border-primary-500 text-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-700 dark:border-gray-600 dark:text-gray-300 dark:hover:text-primary-300'
                }`}
              >
                <Volume2 size={14} />
                {activeAudio === 'user' ? 'Stop my recording' : 'Play my recording'}
              </button>
            )}
          </div>

          {/* Record half — state-driven */}
          <div className="flex flex-col items-center text-center gap-2 pt-5 sm:pt-0 sm:pl-4">
            {(isReadyToRecord || isRecordingInProgress) && (
              <>
                <PremiumRecordButton
                  isRecording={isRecordingInProgress}
                  onClick={isRecordingInProgress ? stopRecording : startRecording}
                  disabled={submitting || (quotaExhausted && !isRecordingInProgress)}
                  size="md"
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {isRecordingInProgress ? 'Recording…' : 'Tap to record'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isRecordingInProgress
                    ? 'Tap again to stop when you finish the sentence'
                    : 'Speak clearly at a natural pace'}
                </span>
              </>
            )}

            {isReviewState && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  aria-label="Submit recording"
                  className="btn btn-primary btn-md inline-flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
                      Analyzing…
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Check my pronunciation
                    </>
                  )}
                </button>
                {submitting ? (
                  <button
                    onClick={cancelAnalysis}
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
                  >
                    Cancel analysis
                  </button>
                ) : (
                  <button
                    onClick={resetRecording}
                    disabled={submitting}
                    aria-label="Reset recording"
                    className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
                  >
                    Discard &amp; re-record
                  </button>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Listen back first, or submit to get your score
                </span>
              </>
            )}

            {isScoredState && (
              <>
                <PremiumRecordButton
                  isRecording={false}
                  onClick={() => {
                    resetRecording();
                    // Small delay to ensure state resets before starting
                    setTimeout(() => startRecording(), 0);
                  }}
                  disabled={quotaExhausted}
                  size="md"
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Try again
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Another take usually beats the first
                </span>
              </>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-800 dark:text-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
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

      {/* Daily quota — subtle status under the controls */}
      {dailyQuota && (quotaExhausted || quotaLow) && (
        <div className="flex justify-center">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              quotaExhausted
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            }`}
            title={`Daily limit resets at 00:00 UTC. Limit: ${dailyQuota.limit}.`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${quotaExhausted ? 'bg-red-500' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
            {quotaExhausted
              ? 'Daily limit reached — resets at 00:00 UTC'
              : `${dailyQuota.remaining} of ${dailyQuota.limit} attempts left today`}
          </span>
        </div>
      )}

      {/* Pre-attempt hint */}
      {!isScoredState && !currentAttempt && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Record yourself to get a score with word-by-word feedback.
        </p>
      )}

      {/* Results — coaching order: score, focus areas, word detail, next step */}
      {isScoredState && currentAttempt && (
        <>
          <ScoringPanel currentAttempt={currentAttempt} variant="strip" />

          {trustMessage && (
            <div
              data-testid="trust-badge"
              data-trust-level={trustLevel}
              role="status"
              className={
                trustLevel === 'untrusted'
                  ? 'rounded-lg p-3 border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20'
                  : 'rounded-lg p-3 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
              }
            >
              <p
                className={
                  trustLevel === 'untrusted'
                    ? 'text-sm text-rose-800 dark:text-rose-200'
                    : 'text-sm text-amber-800 dark:text-amber-200'
                }
              >
                {trustMessage}
              </p>
            </div>
          )}

          {enrichedWords.length > 0 && <FocusAreasCard words={enrichedWords} />}

          {selectedWord && (
            <PhonemePanel
              word={selectedWord}
              onClose={() => setSelectedWord(null)}
              trustLevel={trustLevel}
            />
          )}

        </>
      )}

      {/* Hidden shared audio element */}
      <audio
        ref={audioElRef}
        onEnded={stopPlayback}
        onPause={() => setActiveAudio(null)}
        className="hidden"
      />
    </div>
  );
}
