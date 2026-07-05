import { memo, useCallback, useState, useEffect, useRef } from 'react';
import type { Word } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import WordAudioButton from './WordAudioButton';
import WordStatusBar from './WordStatusBar';
import { useMicrophoneRecorder } from '@/hooks/useMicrophoneRecorder';
import { scoreWordPronunciation } from '@/lib/wordPronunciation';
import { addWordAttempt, getLatestWordAttempt } from '@/lib/practiceStore';
import SentenceFeedback from './SentenceFeedback';
import { useSettingsStore } from '@/state/settingsStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { PhonemePanel } from './PhonemePanel';
import PremiumRecordButton from '@/components/common/PremiumRecordButton';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';
import { ChevronDown, ChevronUp, Lightbulb, Volume2, Check, HelpCircle } from 'lucide-react';

interface WordCardProps {
  word: Word;
  sessionId: string | null;
  status?: 'new' | 'learning' | 'review' | 'known';
  showTranslation?: boolean;
  onToggleTranslation?: () => void;
  onKnowIt: (wordId: string) => void;
  onReviewLater: (wordId: string) => void;
}

function WordCard({ word, sessionId, status, showTranslation = false, onToggleTranslation, onKnowIt, onReviewLater }: WordCardProps) {
  const { selectedVoice } = useSettingsStore();
  const { logWordAttempt } = usePracticeLogStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<AttemptScore | null>(null);
  
  const {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    reset,
    error: recorderError,
  } = useMicrophoneRecorder();

  // Track if we're waiting for blob after stopping
  const [pendingSubmission, setPendingSubmission] = useState(false);

  // UX tracking state for current attempt
  const [hintUsedForCurrentAttempt, setHintUsedForCurrentAttempt] = useState(false);
  const [slowedPlaybackUsedForCurrentAttempt, setSlowedPlaybackUsedForCurrentAttempt] = useState(false);
  const [nativeModelPlayCountForCurrentAttempt, setNativeModelPlayCountForCurrentAttempt] = useState(0);
  const retriesForCurrentWordRef = useRef<number>(0);
  const currentWordIdRef = useRef<string | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Track native audio plays using useAudioPlayer hook
  const nativeAudioUrl = selectedVoice === 'male' ? word.audioMaleUrl : word.audioFemaleUrl;
  const {
    isPlaying: isNativePlaying,
    play: playNative,
    pause: pauseNative,
    isLoading: isNativeLoading,
  } = useAudioPlayer(nativeAudioUrl || null);
  const prevIsNativePlayingRef = useRef(false);

  // Track when native audio starts playing
  useEffect(() => {
    if (isNativePlaying && !prevIsNativePlayingRef.current) {
      // Audio just started playing
      setNativeModelPlayCountForCurrentAttempt(prev => prev + 1);
    }
    prevIsNativePlayingRef.current = isNativePlaying;
  }, [isNativePlaying]);

  // Load latest attempt on mount and when word changes
  useEffect(() => {
    const attempt = getLatestWordAttempt(word.id);
    setLatestAttempt(attempt);
  }, [word.id]);

  // Define submitRecording before useEffect that uses it
  const submitRecording = useCallback(async (blob: Blob, url: string | undefined) => {
    setIsSubmitting(true);
    
    // Track start time for latency calculation (from recording start to score received)
    const assessmentStartTime = Date.now();
    
    try {
      // Score the pronunciation
      const attemptScore = await scoreWordPronunciation(word.textPt, blob, word.id);

      // Calculate latency: time from recording start to score received
      const latencyMs = recordingStartTimeRef.current
        ? Date.now() - recordingStartTimeRef.current
        : Date.now() - assessmentStartTime; // Fallback if recordingStartTimeRef is null

      // Create new attempt with audioUrl from recorder
      const newAttempt: AttemptScore = {
        ...attemptScore,
        audioUrl: url || undefined,
      };

      // Store attempt in practice store
      addWordAttempt(word.id, newAttempt);
      setLatestAttempt(newAttempt);

      // Calculate recording duration if we have start time
      const recordingDurationSeconds = recordingStartTimeRef.current
        ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
        : undefined;

      // Log to practice log store
      if (sessionId) {
        try {
          // Determine if attempt passed (using 70 as threshold - TODO: make configurable)
          const passed = attemptScore.overallAccuracy >= 70;

          // Map phoneme scores if available (TODO: extract from Azure response if available)
          // For now, leave undefined as phoneme-level detail may not be in the response
          const phonemeScores = undefined; // TODO: Extract phoneme scores from Azure response if available

          // Pronunciation practice mode:
          // - practiceMode: 'pronunciation' (explicitly set for pronunciation attempts)
          // - practiceDirection: undefined (not relevant for pronunciation)
          // - latencyMs: time from recording start to score received
          logWordAttempt({
            sessionId,
            wordId: word.id,
            difficulty: word.difficulty,
            category: word.categoryId,
            overallScore: attemptScore.overallAccuracy,
            accuracyScore: attemptScore.overallAccuracy, // Azure returns overallAccuracy as the main score
            fluencyScore: attemptScore.fluency,
            completenessScore: attemptScore.completeness,
            prosodyScore: attemptScore.prosody,
            passed,
            // TODO: Add targetOverallThreshold if it exists
            recordingDurationSeconds,
            retriesInThisSession: retriesForCurrentWordRef.current,
            usedHint: hintUsedForCurrentAttempt,
            slowedAudioPlayback: slowedPlaybackUsedForCurrentAttempt,
            listenedToNativeModelCount: nativeModelPlayCountForCurrentAttempt,
            phonemeScores,
            // New fields for practice mode tracking:
            practiceMode: 'pronunciation',
            // practiceDirection: undefined (not relevant for pronunciation)
            latencyMs,
            // isCorrect: undefined (not used in pronunciation mode)
            // selfRating: undefined (not used in pronunciation mode)
          });

          // Reset UX flags for next attempt
          setHintUsedForCurrentAttempt(false);
          setSlowedPlaybackUsedForCurrentAttempt(false);
          setNativeModelPlayCountForCurrentAttempt(0);
          // Increment retries for next attempt on same word
          retriesForCurrentWordRef.current++;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to log word attempt:', error);
          }
        }
      } else if (import.meta.env.DEV) {
        console.warn('Cannot log word attempt: sessionId is missing');
      }

      // Reset recorder for next recording
      reset();
      recordingStartTimeRef.current = null;
    } catch (error) {
      console.error('Error submitting word pronunciation assessment:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to assess pronunciation. Please try again.');
    } finally {
      setIsSubmitting(false);
      setPendingSubmission(false);
    }
  }, [word.id, word.textPt, word.difficulty, word.categoryId, sessionId, reset, logWordAttempt, hintUsedForCurrentAttempt, slowedPlaybackUsedForCurrentAttempt, nativeModelPlayCountForCurrentAttempt]);

  // Reset recorder and UX tracking when word changes
  useEffect(() => {
    reset();
    // Reset UX flags for new word
    setHintUsedForCurrentAttempt(false);
    setSlowedPlaybackUsedForCurrentAttempt(false);
    setNativeModelPlayCountForCurrentAttempt(0);
    // Reset retries only if word actually changed
    if (currentWordIdRef.current !== word.id) {
      retriesForCurrentWordRef.current = 0;
      currentWordIdRef.current = word.id;
    }
  }, [word.id, reset]);

  // Submit when audioBlob becomes available after stopping
  useEffect(() => {
    if (pendingSubmission && audioBlob && !isRecording) {
      setPendingSubmission(false);
      submitRecording(audioBlob, audioUrl || undefined);
    }
  }, [audioBlob, audioUrl, isRecording, pendingSubmission, submitRecording]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording - blob will be available in onstop handler
      setPendingSubmission(true);
      stopRecording();
    } else {
      // Start recording - track start time for duration calculation
      setSubmitError(null);
      recordingStartTimeRef.current = Date.now();
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleKnowIt = useCallback(() => {
    // Log self-rating attempt
    if (sessionId) {
      try {
        logWordAttempt({
          sessionId,
          wordId: word.id,
          difficulty: word.difficulty,
          category: word.categoryId,
          overallScore: 0, // Neutral value for self-rating
          accuracyScore: 0, // Neutral value for self-rating
          practiceMode: 'self-rating',
          selfRating: 'know',
          // practiceDirection: undefined (not relevant for self-rating)
          // isCorrect: undefined (not used in self-rating mode)
          // latencyMs: undefined (not used in self-rating mode)
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to log self-rating attempt:', error);
        }
      }
    }
    onKnowIt(word.id);
  }, [word.id, word.difficulty, word.categoryId, sessionId, logWordAttempt, onKnowIt]);

  const handleReviewLater = useCallback(() => {
    // Log self-rating attempt
    if (sessionId) {
      try {
        logWordAttempt({
          sessionId,
          wordId: word.id,
          difficulty: word.difficulty,
          category: word.categoryId,
          overallScore: 0, // Neutral value for self-rating
          accuracyScore: 0, // Neutral value for self-rating
          practiceMode: 'self-rating',
          selfRating: 'dont_know',
          // practiceDirection: undefined (not relevant for self-rating)
          // isCorrect: undefined (not used in self-rating mode)
          // latencyMs: undefined (not used in self-rating mode)
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to log self-rating attempt:', error);
        }
      }
    }
    onReviewLater(word.id);
  }, [word.id, word.difficulty, word.categoryId, sessionId, logWordAttempt, onReviewLater]);
  const difficultyColors = {
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  const difficultyLabels = {
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
  };

  // Get grade from score
  const getGrade = (score: number): string => {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    return 'C';
  };

  // Get grade color
  const getGradeColor = (score: number): string => {
    if (score >= 85) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (score >= 70) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  };

  const handlePlayNative = useCallback(() => {
    if (!nativeAudioUrl) return;
    if (isNativePlaying) {
      pauseNative();
    } else {
      playNative();
    }
  }, [nativeAudioUrl, isNativePlaying, playNative, pauseNative]);

  return (
    <div className="card card-hover relative">
      {/* Header with status, category and difficulty */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          {status && <WordStatusBar status={status} />}
          <span className="badge badge-secondary">
            {word.categoryLabelEn}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {word.difficultForEnglish && (
            <span className="badge badge-warning">
              ⚠️ Tricky
            </span>
          )}
          <span
            className={`badge ${difficultyColors[word.difficulty]}`}
          >
            {difficultyLabels[word.difficulty]}
          </span>
          {latestAttempt && latestAttempt.overallAccuracy !== undefined && (
            <span className={`badge ${getGradeColor(latestAttempt.overallAccuracy)} text-xs px-2 py-1`}>
              {Math.round(latestAttempt.overallAccuracy)} ({getGrade(latestAttempt.overallAccuracy)})
            </span>
          )}
        </div>
      </div>

      {/* Portuguese word - large and prominent, with inline speaker */}
      <div className="flex flex-col items-center gap-y-2 mb-2">
        <div className="flex items-center gap-3">
          <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {word.textPt}
          </p>
          {nativeAudioUrl ? (
            <button
              type="button"
              onClick={handlePlayNative}
              disabled={isNativeLoading}
              aria-label={isNativePlaying ? 'Stop pronunciation' : 'Hear pronunciation'}
              className={`shrink-0 w-11 h-11 rounded-full border flex items-center justify-center transition-colors
                ${
                  isNativePlaying
                    ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-300 dark:border-gray-600 dark:text-gray-400 dark:hover:text-primary-300'
                }
                disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Volume2 size={20} className={isNativePlaying ? 'animate-pulse' : ''} />
            </button>
          ) : (
            word.id && <WordAudioButton wordId={word.id} compact />
          )}
        </div>

        {/* Part of speech */}
        {word.partOfSpeech && (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {word.partOfSpeech}
          </p>
        )}

        {/* Translation toggle chevron */}
        {word.translationEn && (
          <button
            type="button"
            onClick={() => {
              if (onToggleTranslation) {
                onToggleTranslation();
              }
            }}
            className="text-gray-300 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer transition-colors"
            aria-pressed={showTranslation}
            aria-label={showTranslation ? 'Hide translation' : 'Show translation'}
          >
            {showTranslation ? (
              <ChevronUp size={20} className="w-5 h-5" />
            ) : (
              <ChevronDown size={20} className="w-5 h-5" />
            )}
          </button>
        )}

        {/* English translation - shown conditionally */}
        {word.translationEn && showTranslation && (
          <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 italic text-center">
            {word.translationEn}
          </p>
        )}
      </div>

      {/* Pronunciation notes / tip - track as hint usage */}
      {word.pronunciationNotes && (
        <div
          className="mb-5 flex items-start gap-2 p-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/50 rounded-xl text-sm cursor-pointer"
          onClick={() => setHintUsedForCurrentAttempt(true)}
          title="Click to mark as hint used"
        >
          <Lightbulb size={18} className="shrink-0 mt-0.5 text-primary-600 dark:text-primary-400" />
          <p className="text-primary-800 dark:text-primary-200 font-medium">{word.pronunciationNotes}</p>
        </div>
      )}

      {/* Listen + Record panel */}
      <div className="mb-5 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-gray-700">
          {/* Listen */}
          <div className="flex flex-col items-center text-center gap-2 pb-5 sm:pb-0 sm:pr-4">
            {nativeAudioUrl ? (
              <PremiumPlayButton
                isPlaying={isNativePlaying}
                onClick={handlePlayNative}
                disabled={isNativeLoading}
                size="md"
              />
            ) : (
              word.id && <WordAudioButton wordId={word.id} compact />
            )}
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Listen</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Hear native pronunciation</span>
          </div>

          {/* Record */}
          <div className="flex flex-col items-center text-center gap-2 pt-5 sm:pt-0 sm:pl-4">
            <PremiumRecordButton
              isRecording={isRecording}
              onClick={handleRecordToggle}
              disabled={isSubmitting}
              size="md"
            />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {isRecording ? 'Recording…' : isSubmitting ? 'Assessing…' : 'Tap to record'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Speak clearly at a natural pace</span>
          </div>
        </div>
        {recorderError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{recorderError}</p>
        )}
      </div>

      {/* Pronunciation Breakdown */}
      <div className="mb-5">
        <PhonemePanel word={word} />
      </div>

      {/* Submit error banner */}
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between gap-2">
          <p className="text-sm text-red-700 dark:text-red-300">{submitError}</p>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 text-sm font-medium shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pronunciation Feedback - show feedback for the most recent attempt */}
      {latestAttempt && (
        <SentenceFeedback
          currentAttempt={latestAttempt}
          fallbackText={word.textPt}
          fallbackTranslation={word.translationEn}
          fallbackDifficulty={word.difficulty}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4">
        <button
          onClick={handleKnowIt}
          className="btn btn-success flex-1 flex flex-col items-center py-3"
        >
          <span className="flex items-center gap-2 text-base font-semibold">
            <Check size={18} /> Know it
          </span>
          <span className="text-xs font-normal opacity-90">I pronounced this correctly</span>
        </button>
        <button
          onClick={handleReviewLater}
          className="btn btn-secondary flex-1 flex flex-col items-center py-3"
        >
          <span className="flex items-center gap-2 text-base font-semibold">
            <HelpCircle size={18} /> Don't know it yet
          </span>
          <span className="text-xs font-normal opacity-80">I need more practice</span>
        </button>
      </div>
    </div>
  );
}

export default memo(WordCard);
