import { memo, useCallback, useState, useEffect, useRef } from 'react';
import type { Word } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import AudioPlayerButton from './AudioPlayerButton';
import WordAudioButton from './WordAudioButton';
import { useMicrophoneRecorder } from '@/hooks/useMicrophoneRecorder';
import { scoreWordPronunciation } from '@/lib/wordPronunciation';
import { addWordAttempt, getLatestWordAttempt } from '@/lib/practiceStore';
import SentenceFeedback, { type OverallScores, type WordFeedback } from './SentenceFeedback';
import { useSettingsStore } from '@/state/settingsStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface WordCardProps {
  word: Word;
  sessionId: string | null;
  onKnowIt: (wordId: string) => void;
  onReviewLater: (wordId: string) => void;
}

function WordCard({ word, sessionId, onKnowIt, onReviewLater }: WordCardProps) {
  const { selectedVoice } = useSettingsStore();
  const { logWordAttempt } = usePracticeLogStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const { isPlaying: isNativePlaying } = useAudioPlayer(nativeAudioUrl || null);
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
    
    try {
      // Score the pronunciation
      const attemptScore = await scoreWordPronunciation(word.textPt, blob, word.id);

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
      alert(`Failed to assess pronunciation: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      recordingStartTimeRef.current = Date.now();
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleKnowIt = useCallback(() => {
    onKnowIt(word.id);
  }, [word.id, onKnowIt]);

  const handleReviewLater = useCallback(() => {
    onReviewLater(word.id);
  }, [word.id, onReviewLater]);
  const difficultyColors = {
    1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const difficultyLabels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };

  return (
    <div className="card card-hover card-compact">
      {/* Header with category and difficulty */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <span className="badge badge-secondary">
          {word.categoryLabelEn}
        </span>
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
        </div>
      </div>

      {/* Portuguese word - large and prominent */}
      <div className="mb-3">
        <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          {word.textPt}
        </p>
      </div>

      {/* English translation */}
      <div className="mb-4">
        <p className="text-base text-gray-600 dark:text-gray-300 italic">
          {word.translationEn}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {word.partOfSpeech}
        </p>
      </div>

      {/* Pronunciation notes - track as hint usage */}
      {word.pronunciationNotes && (
        <div 
          className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded text-sm cursor-pointer"
          onClick={() => setHintUsedForCurrentAttempt(true)}
          title="Click to mark as hint used"
        >
          <p className="text-blue-800 dark:text-blue-300">{word.pronunciationNotes}</p>
        </div>
      )}

      {/* Audio playback controls - uses global voice setting */}
      <div className="mb-4 flex gap-2">
        {(() => {
          const audioUrl = selectedVoice === 'male' ? word.audioMaleUrl : word.audioFemaleUrl;
          
          if (audioUrl) {
            return (
              <AudioPlayerButton
                audioUrl={audioUrl}
                label="Play"
                icon="▶"
                variant={selectedVoice}
                compact={true}
              />
            );
          } else if (word.id) {
            return <WordAudioButton wordId={word.id} compact={true} />;
          }
          return null;
        })()}
      </div>

      {/* Recording controls */}
      <div className="mb-4">
        <button
          onClick={handleRecordToggle}
          disabled={isSubmitting}
          className={`btn btn-md ${
            isRecording
              ? 'btn-danger'
              : 'btn-primary'
          } w-full`}
        >
          {isRecording ? (
            <>
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Stop & Score
            </>
          ) : (
            'Record Pronunciation'
          )}
        </button>
        {recorderError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{recorderError}</p>
        )}
      </div>

      {/* Pronunciation Feedback - show feedback for the most recent attempt */}
      {latestAttempt && (() => {
        // Map AttemptScore to SentenceFeedbackProps
        const overall: OverallScores = {
          accuracy: latestAttempt.overallAccuracy,
          fluency: latestAttempt.fluency,
          completeness: latestAttempt.completeness,
          prosody: latestAttempt.prosody,
        };

        // Map word scores to WordFeedback format
        // For a single word, the wordScores array should contain one entry
        const words: WordFeedback[] = latestAttempt.wordScores.length > 0
          ? latestAttempt.wordScores.map((ws, index) => ({
              index,
              text: ws.word,
              accuracyScore: ws.accuracy,
              errorType: ws.errorType,
            }))
          : [{
              index: 0,
              text: word.textPt,
              accuracyScore: latestAttempt.overallAccuracy,
            }];

        return <SentenceFeedback overall={overall} words={words} />;
      })()}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleKnowIt}
          className="btn btn-success btn-sm flex-1"
        >
          ✓ Know it
        </button>
        <button
          onClick={handleReviewLater}
          className="btn btn-secondary btn-sm flex-1"
        >
          ⏰ Review later
        </button>
      </div>
    </div>
  );
}

export default memo(WordCard);

