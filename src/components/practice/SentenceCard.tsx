import { memo, useState, useCallback, useEffect, useRef } from 'react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore, WordScore } from '@/types/pronunciation';
import AudioPlayerButton from './AudioPlayerButton';
import { useMicrophoneRecorder } from '@/hooks/useMicrophoneRecorder';
import SentenceFeedback from './SentenceFeedback';
import { useSettingsStore } from '@/state/settingsStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import PremiumRecordButton from '@/components/common/PremiumRecordButton';

interface SentenceCardProps {
  sentence: Sentence;
  currentIndex: number;
  totalCount: number;
  sessionId: string | null;
}

function SentenceCard({ sentence, currentIndex, totalCount, sessionId }: SentenceCardProps) {
  const { selectedVoice } = useSettingsStore();
  const { logSentenceAttempt } = usePracticeLogStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<AttemptScore[]>([]);
  // Store raw Azure responses keyed by attemptId for phoneme extraction
  const [rawAzureResponses, setRawAzureResponses] = useState<Map<string, any>>(new Map());
  
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
  const retriesForCurrentSentenceRef = useRef<number>(0);
  const currentSentenceIdRef = useRef<string | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Track native audio plays using useAudioPlayer hook
  const nativeAudioUrl = selectedVoice === 'male' ? sentence.audioMaleUrl : sentence.audioFemaleUrl;
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

  // Define submitRecording before useEffect that uses it
  const submitRecording = useCallback(async (blob: Blob, url: string | undefined) => {
    setIsSubmitting(true);
    
    try {
      // Build FormData
      const formData = new FormData();
      formData.append('audio', blob, `${sentence.id}-attempt.ogg`);
      formData.append('sentenceId', sentence.id);
      formData.append('referenceText', sentence.textPt);
      formData.append('language', 'pt-BR');

      // POST to API endpoint
      const response = await fetch('/api/pronunciation/assessment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { rawAzure, attemptScore } = await response.json();

      // Log rawAzure in development for debugging
      if (import.meta.env.DEV) {
        console.debug('Azure pronunciation assessment response:', rawAzure);
      }

      // Create new attempt with audioUrl from recorder
      // Ensure attemptId and createdAt are set (they should be from server, but add fallbacks)
      const attemptId = attemptScore.attemptId || `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newAttempt: AttemptScore = {
        ...attemptScore,
        attemptId,
        createdAt: attemptScore.createdAt || new Date().toISOString(),
        audioUrl: url || undefined,
      };

      // Store rawAzure response for phoneme extraction
      setRawAzureResponses(prev => {
        const next = new Map(prev);
        next.set(attemptId, rawAzure);
        return next;
      });

      // Add to attempts list (prepend so most recent is first)
      setAttempts(prev => [newAttempt, ...prev]);

      // Calculate recording duration if we have start time
      const recordingDurationSeconds = recordingStartTimeRef.current
        ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
        : undefined;

      // Log to practice log store
      if (sessionId) {
        try {
          // Determine if attempt passed (using 70 as threshold - TODO: make configurable)
          const passed = attemptScore.overallAccuracy >= 70;

          // Map word scores to the format expected by SentencePracticeAttempt
          const wordScores = attemptScore.wordScores.map((ws: WordScore) => ({
            token: ws.word,
            overallScore: ws.accuracy,
            accuracyScore: ws.accuracy,
            // TODO: Map wordId if we have word references
            // TODO: Map phonemeScores if available from Azure response
          }));

          logSentenceAttempt({
            sessionId,
            sentenceId: sentence.id,
            difficulty: sentence.difficulty,
            category: sentence.categoryId,
            overallScore: attemptScore.overallAccuracy,
            accuracyScore: attemptScore.overallAccuracy, // Azure returns overallAccuracy as the main score
            fluencyScore: attemptScore.fluency ?? 0,
            completenessScore: attemptScore.completeness ?? 0,
            prosodyScore: attemptScore.prosody,
            passed,
            // TODO: Add targetOverallThreshold and targetAccuracyThreshold if they exist
            recordingDurationSeconds,
            retriesInThisSession: retriesForCurrentSentenceRef.current,
            usedHint: hintUsedForCurrentAttempt,
            slowedAudioPlayback: slowedPlaybackUsedForCurrentAttempt,
            listenedToNativeModelCount: nativeModelPlayCountForCurrentAttempt,
            wordScores: wordScores.length > 0 ? wordScores : undefined,
          });

          // Reset UX flags for next attempt
          setHintUsedForCurrentAttempt(false);
          setSlowedPlaybackUsedForCurrentAttempt(false);
          setNativeModelPlayCountForCurrentAttempt(0);
          // Increment retries for next attempt on same sentence
          retriesForCurrentSentenceRef.current++;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('Failed to log sentence attempt:', error);
          }
        }
      } else if (import.meta.env.DEV) {
        console.warn('Cannot log sentence attempt: sessionId is missing');
      }

      // Reset recorder for next recording
      reset();
      recordingStartTimeRef.current = null;
    } catch (error) {
      console.error('Error submitting pronunciation assessment:', error);
      alert(`Failed to assess pronunciation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      setPendingSubmission(false);
    }
  }, [sentence.id, sentence.textPt, reset]);

  // Reset recorder and UX tracking when sentence changes
  useEffect(() => {
    reset();
    setAttempts([]);
    setRawAzureResponses(new Map());
    // Reset UX flags for new sentence
    setHintUsedForCurrentAttempt(false);
    setSlowedPlaybackUsedForCurrentAttempt(false);
    setNativeModelPlayCountForCurrentAttempt(0);
    // Reset retries only if sentence actually changed
    if (currentSentenceIdRef.current !== sentence.id) {
      retriesForCurrentSentenceRef.current = 0;
      currentSentenceIdRef.current = sentence.id;
    }
  }, [sentence.id, reset]);

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
    <div className="card card-hover p-6 md:p-8">
      {/* Progress indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {totalCount}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge ${difficultyColors[sentence.difficulty]}`}
          >
            {difficultyLabels[sentence.difficulty]}
          </span>
          <span className="badge badge-secondary">
            {sentence.categoryLabelEn}
          </span>
        </div>
      </div>

      {/* Portuguese sentence - prominent */}
      <div className="mb-6">
        <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
          {sentence.textPt}
        </p>
      </div>

      {/* English translation - smaller, lighter */}
      <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 italic">
          {sentence.translationEn}
        </p>
      </div>

      {/* Audio playback controls - uses global voice setting */}
      {(() => {
        const audioUrl = selectedVoice === 'male' ? sentence.audioMaleUrl : sentence.audioFemaleUrl;
        if (!audioUrl) return null;
        
        return (
          <div className="mb-6 flex gap-3">
            <AudioPlayerButton
              audioUrl={audioUrl}
              label={selectedVoice === 'male' ? 'Male Voice' : 'Female Voice'}
              icon={selectedVoice === 'male' ? '👨' : '👩'}
              variant={selectedVoice}
            />
          </div>
        );
      })()}

      {/* Pronunciation tips - track as hint usage */}
      {sentence.pronunciationNotes && (
        <div 
          className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded cursor-pointer"
          onClick={() => setHintUsedForCurrentAttempt(true)}
          title="Click to mark as hint used"
        >
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">💡 Pronunciation Tip</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">{sentence.pronunciationNotes}</p>
        </div>
      )}

      {/* Recording controls */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <PremiumRecordButton
            isRecording={isRecording}
            onClick={handleRecordToggle}
            disabled={isSubmitting}
            size="md"
          />
          {isRecording && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recording...
            </span>
          )}
        </div>
        {recorderError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{recorderError}</p>
        )}
      </div>

      {/* Pronunciation Feedback - always show panel scaffold, even before first attempt */}
      <SentenceFeedback 
        sentence={sentence}
        attempts={attempts}
        currentAttempt={attempts.length > 0 ? attempts[0] : null} // Most recent is first in array, or null if no attempts
        rawAzureResponse={attempts.length > 0 && attempts[0]?.attemptId 
          ? rawAzureResponses.get(attempts[0].attemptId) 
          : undefined}
      />

      {/* Category info (optional, subtle) */}
      <div className="text-xs text-gray-400 dark:text-gray-500">
        Category: {sentence.categoryLabelPt}
      </div>
    </div>
  );
}

export default memo(SentenceCard);

