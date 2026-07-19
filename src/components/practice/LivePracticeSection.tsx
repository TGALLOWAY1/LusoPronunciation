import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Volume2 } from 'lucide-react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { useLivePronunciationPractice } from '@/hooks/useLivePronunciationPractice';
import NextStepCoachingCard from '@/components/practice/NextStepCoachingCard';
import InteractiveSentenceDisplay from '@/components/practice/InteractiveSentenceDisplay';
import ScoringPanel from '@/components/pronunciation/ScoringPanel';
import {
  adaptWordScoresToNormalized,
  enrichWordsWithCanonicalData,
  PhonemePanel,
  type NormalizedWordFeedback,
} from '@/components/pronunciation/shared';
import { alignUiTokensToAzureWords } from '@/pipeline/sentenceWordRefs';
import { computeTrustLevel, getTrustMessage } from '@/lib/assessmentTrust';
import { useSettingsStore } from '@/state/settingsStore';
import { useCanonicalWordMap } from '@/hooks/useCanonicalWordMap';
import { useAssessmentQuota } from '@/hooks/useAssessmentQuota';
import PremiumRecordButton from '@/components/common/PremiumRecordButton';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';
import { buildCoachingSuggestion } from '@/lib/coaching/coachingEngine';
import { detectConfusionTags } from '@/lib/coaching/confusionDetection';
import { pickMinimalPairsByTags } from '@/lib/coaching/minimalPairs.ptbr';
import { appendCoachingTelemetryEvent } from '@/lib/coaching/coachingTelemetry';

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
  const [isDrillOpen, setIsDrillOpen] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [selectedWord, setSelectedWord] = useState<NormalizedWordFeedback | null>(null);
  const lastShownKeyRef = useRef<string | null>(null);
  // "Try again" resets the current attempt and then immediately starts a new
  // recording. resetRecording() drives attemptState back to 'idle' via state
  // updates rather than synchronously, so we defer the startRecording() call
  // to an effect keyed on that transition instead of racing it with a timer.
  const retryRecordingPendingRef = useRef(false);

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

  // Deterministically start a new recording once a pending "Try again" reset
  // has actually completed (attemptState reaches 'idle'), instead of guessing
  // with a timer.
  useEffect(() => {
    if (retryRecordingPendingRef.current && attemptState === 'idle') {
      retryRecordingPendingRef.current = false;
      void startRecording();
    }
  }, [attemptState, startRecording]);

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

  // ---------------------------------------------------------------------
  // Coaching suggestion
  // ---------------------------------------------------------------------
  const coachingSuggestion = useMemo(() => {
    if (!currentAttempt) {
      return null;
    }

    const previousAttempt = attempts.length > 1 ? attempts[1] : undefined;
    const baseSuggestion = buildCoachingSuggestion(currentAttempt, {
      previousAttempt,
      sentenceText: sentence.textPt,
      nativeAudioAvailable,
    });

    if (baseSuggestion.kind !== 'clarity') {
      return baseSuggestion;
    }

    const detectedTags = detectConfusionTags(currentAttempt, sentence.textPt).slice(0, 3);
    if (detectedTags.length === 0) {
      return baseSuggestion;
    }

    const pairs = pickMinimalPairsByTags(detectedTags, 3);
    if (pairs.length < 2) {
      return baseSuggestion;
    }

    return {
      ...baseSuggestion,
      kind: 'minimal_pairs' as const,
      ctaLabel: 'Start drill',
      drill: {
        tags: detectedTags,
        pairs,
      },
    };
  }, [attempts, currentAttempt, nativeAudioAvailable, sentence.textPt]);

  useEffect(() => {
    setIsDrillOpen(false);
  }, [sentence.id, currentAttempt?.attemptId]);

  useEffect(() => {
    if (!coachingSuggestion || !currentAttempt || attemptState !== 'scored') {
      return;
    }

    const shownKey = `${currentAttempt.attemptId}:${coachingSuggestion.kind}`;
    if (lastShownKeyRef.current === shownKey) {
      return;
    }

    lastShownKeyRef.current = shownKey;
    appendCoachingTelemetryEvent({
      event: 'coaching_shown',
      kind: coachingSuggestion.kind,
      tags: coachingSuggestion.drill?.tags,
    });
  }, [attemptState, coachingSuggestion, currentAttempt]);

  const handleCoachingPrimaryCta = useCallback(() => {
    if (!coachingSuggestion) {
      return;
    }

    appendCoachingTelemetryEvent({
      event: 'coaching_cta_clicked',
      kind: coachingSuggestion.kind,
      tags: coachingSuggestion.drill?.tags,
    });

    if (coachingSuggestion.kind === 'minimal_pairs') {
      if (!isDrillOpen) {
        appendCoachingTelemetryEvent({
          event: 'minimal_pairs_opened',
          kind: coachingSuggestion.kind,
          tags: coachingSuggestion.drill?.tags,
        });
      }
      setIsDrillOpen(true);
      return;
    }

    setIsDrillOpen(false);
    resetRecording();
  }, [coachingSuggestion, isDrillOpen, resetRecording]);

  const handleRetrySentenceFromDrill = useCallback(() => {
    if (coachingSuggestion) {
      appendCoachingTelemetryEvent({
        event: 'coaching_cta_clicked',
        kind: coachingSuggestion.kind,
        tags: coachingSuggestion.drill?.tags,
      });
    }

    setIsDrillOpen(false);
    resetRecording();
  }, [coachingSuggestion, resetRecording]);

  // Assessment allowance. `dailyQuota` (from X-Quota-* response headers) updates
  // immediately after each attempt; the useAssessmentQuota hook provides the
  // initial snapshot plus lifetime + exempt state, and is re-read after each
  // scored attempt via the attempts-count refresh token.
  const { quota: assessmentQuota } = useAssessmentQuota(attempts.length);
  const isExempt = assessmentQuota?.exempt ?? false;

  const dailyLimitNum = dailyQuota?.limit ?? assessmentQuota?.dailyLimit ?? null;
  const dailyRemainingNum = dailyQuota
    ? dailyQuota.remaining
    : assessmentQuota
      ? Math.max(0, assessmentQuota.dailyLimit - assessmentQuota.dailyUsed)
      : null;
  const dailyUsedNum =
    dailyLimitNum !== null && dailyRemainingNum !== null
      ? Math.max(0, dailyLimitNum - dailyRemainingNum)
      : assessmentQuota?.dailyUsed ?? null;

  const lifetimeRemaining = assessmentQuota
    ? Math.max(0, assessmentQuota.lifetimeLimit - assessmentQuota.lifetimeUsed)
    : null;

  const dailyExhausted = !isExempt && dailyRemainingNum !== null && dailyRemainingNum <= 0;
  const lifetimeExhausted =
    !isExempt &&
    assessmentQuota != null &&
    assessmentQuota.lifetimeUsed >= assessmentQuota.lifetimeLimit;

  // Blocks new recordings (record buttons disabled) when either cap is hit.
  const quotaExhausted = dailyExhausted || lifetimeExhausted;
  const quotaLow =
    !isExempt &&
    !quotaExhausted &&
    dailyRemainingNum !== null &&
    dailyRemainingNum > 0 &&
    dailyRemainingNum <= 5;
  // Show a subtle "N of 10 today" indicator whenever we have numbers for a
  // non-exempt user and neither cap is currently blocking.
  const showDailyCounter =
    !isExempt && !quotaExhausted && dailyLimitNum !== null && dailyUsedNum !== null;

  return (
    <div className="space-y-6" data-testid="practice-content">
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
                    retryRecordingPendingRef.current = true;
                    resetRecording();
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

      {/* Lifetime cap reached — honest explanation of why the cap exists */}
      {lifetimeExhausted && (
        <div
          role="status"
          className="rounded-lg p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-200 space-y-1.5"
        >
          <p className="font-semibold">You've reached the lifetime assessment limit for this free account.</p>
          <p>
            Every pronunciation check runs through Azure Speech, which costs money on this personal
            project — so free accounts get{' '}
            {assessmentQuota ? assessmentQuota.lifetimeLimit : ''} lifetime assessments. You can keep
            using the rest of the app, and your history stays available.
          </p>
          <p>
            Have an invite code? Registering with one lifts the cap. Otherwise, reach out to the app
            owner for access.
          </p>
        </div>
      )}

      {/* Daily quota — subtle status under the controls */}
      {!lifetimeExhausted && (dailyExhausted || quotaLow || showDailyCounter) && (
        <div className="flex flex-col items-center gap-1">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
              dailyExhausted
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                : quotaLow
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                  : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
            title={`Daily assessments reset at 00:00 UTC.${dailyLimitNum !== null ? ` Daily limit: ${dailyLimitNum}.` : ''}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                dailyExhausted ? 'bg-red-500' : quotaLow ? 'bg-amber-500' : 'bg-primary-500'
              }`}
              aria-hidden="true"
            />
            {dailyExhausted
              ? 'Daily limit reached — resets at 00:00 UTC'
              : `${dailyUsedNum ?? 0} of ${dailyLimitNum} assessments used today`}
          </span>
          {lifetimeRemaining !== null && (
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {lifetimeRemaining} of {assessmentQuota?.lifetimeLimit} lifetime assessments left
            </span>
          )}
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

          {selectedWord && (
            <PhonemePanel
              word={selectedWord}
              onClose={() => setSelectedWord(null)}
              trustLevel={trustLevel}
            />
          )}

          {coachingSuggestion && (
            <NextStepCoachingCard
              suggestion={coachingSuggestion}
              drillOpen={isDrillOpen}
              onPrimaryCta={handleCoachingPrimaryCta}
              onRetrySentence={handleRetrySentenceFromDrill}
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
