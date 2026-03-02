import { useState, useCallback, useRef, useEffect } from 'react';
import { useMicrophoneRecorder } from './useMicrophoneRecorder';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import type { AttemptScore, WordScore } from '@/types/pronunciation';
import {
  analyzeAudioBlob,
  MIN_DURATION_MS,
} from '@/lib/audioQuality';

/**
 * Response type from the pronunciation assessment API
 */
type PronunciationAssessmentResponse = {
  rawAzure: any;
  attemptScore: AttemptScore;
};

const MAX_PERSISTED_AUDIO_BYTES = 1.5 * 1024 * 1024; // ~1.5MB safety cap for localStorage

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unknown FileReader error'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Parameters for logging a sentence attempt
 * These are optional because the hook can be used without logging
 */
export interface LogAttemptParams {
  sessionId: string;
  sentenceId: string;
  difficulty: number;
  category: string;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  recordingDurationSeconds?: number;
}

export type AttemptLifecycleState =
  | 'idle'
  | 'recording'
  | 'recorded'
  | 'submitting'
  | 'scored'
  | 'error'
  | 'canceled';

/**
 * Result type for the useLivePronunciationPractice hook
 */
export type UseLivePronunciationPracticeResult = {
  // Recording state
  isRecording: boolean;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;

  // Submission state
  submitting: boolean;
  error: string | null;
  attemptState: AttemptLifecycleState;

  // Attempt state
  attempts: AttemptScore[];
  currentAttempt: AttemptScore | null;
  rawAzureResponse: any | null; // raw response for currentAttempt
  allRawAzureResponses: Map<string, any>; // all raw responses keyed by attempt id

  // Actions
  submitAttempt: (
    sentenceId: string,
    referenceText: string,
    logParams?: LogAttemptParams | null
  ) => Promise<void>;
  cancelAnalysis: () => void;
};

/**
 * React hook for live pronunciation practice with Azure assessment and latency tracking.
 * 
 * Encapsulates:
 * - Microphone recording (via useMicrophoneRecorder)
 * - Audio submission to /api/pronunciation/assessment
 * - Round-trip latency measurement
 * - Attempt history management
 * - Optional practice log integration
 * 
 * @returns UseLivePronunciationPracticeResult with recording controls, attempt state, and submission function
 */
export function useLivePronunciationPractice(): UseLivePronunciationPracticeResult {
  const { 
    isRecording, 
    audioBlob, 
    audioUrl, 
    startRecording, 
    stopRecording, 
    reset: resetRecorder,
    error: recorderError 
  } = useMicrophoneRecorder();

  const { logSentenceAttempt } = usePracticeLogStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<AttemptLifecycleState>('idle');
  const [attempts, setAttempts] = useState<AttemptScore[]>([]);
  const [allRawAzureResponses, setAllRawAzureResponses] = useState<Map<string, any>>(new Map());

  // AbortController for canceling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);

  // Track recording start time for duration calculation (optional, for logging)
  const recordingStartTimeRef = useRef<number | null>(null);

  // Track retries per sentence (for logging)
  const retriesBySentenceRef = useRef<Map<string, number>>(new Map());

  // Reset error when starting a new recording
  useEffect(() => {
    if (isRecording) {
      setError(null);
      setAttemptState('recording');
      recordingStartTimeRef.current = Date.now();
    }
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording && audioBlob && (attemptState === 'idle' || attemptState === 'recording' || attemptState === 'canceled')) {
      setAttemptState('recorded');
    }
  }, [audioBlob, isRecording, attemptState]);

  useEffect(() => {
    if (recorderError) {
      setAttemptState('error');
    }
  }, [recorderError]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      activeRequestIdRef.current = null;
    };
  }, []);

  /**
   * Resets all state: recording, attempts, errors, etc.
   */
  const resetRecording = useCallback(() => {
    resetRecorder();
    setError(null);
    setAttemptState('idle');
    recordingStartTimeRef.current = null;
  }, [resetRecorder]);

  const cancelAnalysis = useCallback(() => {
    if (!abortControllerRef.current) {
      return;
    }

    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    activeRequestIdRef.current = null;
    setSubmitting(false);
    setError(null);
    setAttemptState('canceled');
  }, []);

  /**
   * Submits the recorded audio to the pronunciation assessment API.
   * Measures round-trip latency and includes it in the attempt data.
   * 
   * @param sentenceId - The ID of the sentence being practiced
   * @param referenceText - The reference text (PT-BR) to compare against
   * @param logParams - Optional parameters for logging to practice log store
   */
  const submitAttempt = useCallback(async (
    sentenceId: string,
    referenceText: string,
    logParams?: LogAttemptParams | null
  ): Promise<void> => {
    // Guard against missing audio blob
    if (!audioBlob) {
      setError('No recording available. Please record audio first.');
      setAttemptState('error');
      return;
    }

    setError(null);

    // Client-side audio quality gate: block very short or effectively silent submissions.
    try {
      const quality = await analyzeAudioBlob(audioBlob);
      if (quality.isTooShort) {
        setError(
          `Too short - try speaking the whole sentence (at least ${(MIN_DURATION_MS / 1000).toFixed(1)}s).`
        );
        setAttemptState('error');
        return;
      }
      if (quality.isSilent) {
        setError('Too quiet - move closer to the mic and try again.');
        setAttemptState('error');
        return;
      }
    } catch (qualityError) {
      console.error('Audio quality analysis failed:', qualityError);
      setError('Could not analyze this recording. Please record again and speak clearly.');
      setAttemptState('error');
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    activeRequestIdRef.current = null;

    // Create new AbortController for this request
    const abortController = new AbortController();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    abortControllerRef.current = abortController;
    activeRequestIdRef.current = requestId;

    setSubmitting(true);
    setAttemptState('submitting');

    try {
      // Build FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, `${sentenceId}-attempt.ogg`);
      formData.append('sentenceId', sentenceId);
      formData.append('referenceText', referenceText);
      formData.append('language', 'pt-BR');

      // Measure latency: start timer before fetch
      const startedAt = performance.now();

      // POST to API endpoint
      const response = await fetch('/api/pronunciation/assessment', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      // Measure latency: stop timer after response is received
      const finishedAt = performance.now();
      const latencyMs = Math.round(finishedAt - startedAt);

      // Check if request was aborted
      if (abortController.signal.aborted || activeRequestIdRef.current !== requestId) {
        return; // Don't update state if component unmounted
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Parse response with better error handling
      let responseData: PronunciationAssessmentResponse;
      try {
        const responseText = await response.text();
        if (import.meta.env.DEV) {
          console.debug('Raw response text (first 500 chars):', responseText.substring(0, 500));
        }
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response JSON:', parseError);
        // Note: Can't read response.text() again, so we'll use the error message
        throw new Error(`Invalid response from server: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}. The server may have returned invalid JSON.`);
      }

      const { rawAzure, attemptScore } = responseData;
      
      // Validate response structure
      if (!rawAzure || !attemptScore) {
        console.error('Invalid response structure:', { rawAzure, attemptScore });
        throw new Error('Invalid response: missing rawAzure or attemptScore');
      }

      // Check if request was aborted after JSON parsing
      if (abortController.signal.aborted || activeRequestIdRef.current !== requestId) {
        return;
      }

      // Log rawAzure in development for debugging
      if (import.meta.env.DEV) {
        console.debug('Azure pronunciation assessment response:', rawAzure);
        console.debug(`Latency: ${latencyMs}ms`);
      }

      // Ensure attemptId and createdAt are set (they should be from server, but add fallbacks)
      const attemptId = attemptScore.attemptId || `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create new attempt with latencyMs and audioUrl
      const attemptWithLatency: AttemptScore = {
        ...attemptScore,
        attemptId,
        createdAt: attemptScore.createdAt || new Date().toISOString(),
        audioUrl: audioUrl || undefined,
        latencyMs,
      };

      // Store rawAzure response for phoneme extraction
      setAllRawAzureResponses(prev => {
        const next = new Map(prev);
        next.set(attemptId, rawAzure);
        return next;
      });

      // Add to attempts list (prepend so most recent is first)
      setAttempts(prev => [attemptWithLatency, ...prev]);

      // Log to practice log store if logParams provided
      if (logParams) {
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

          // Calculate recording duration if we have start time
          const recordingDurationSeconds = recordingStartTimeRef.current
            ? Math.round((Date.now() - recordingStartTimeRef.current) / 1000)
            : logParams.recordingDurationSeconds;

          // Convert audio blob to data URL for persisted playback if not too large
          let recordingDataUrl: string | undefined;
          if (audioBlob.size <= MAX_PERSISTED_AUDIO_BYTES) {
            try {
              recordingDataUrl = await blobToDataUrl(audioBlob);
            } catch (conversionError) {
              if (import.meta.env.DEV) {
                console.warn('Failed to convert audio blob to data URL for history playback:', conversionError);
              }
            }
          } else if (import.meta.env.DEV) {
            console.warn(
              `Skipping audio persistence for attempt ${attemptId}: blob size ${audioBlob.size} exceeds cap`
            );
          }

          // Get retry count for this sentence
          const retriesInThisSession = logParams.retriesInThisSession ??
            (retriesBySentenceRef.current.get(sentenceId) || 0);

          logSentenceAttempt({
            sessionId: logParams.sessionId,
            sentenceId: logParams.sentenceId,
            difficulty: logParams.difficulty,
            category: logParams.category,
            overallScore: attemptScore.overallAccuracy,
            accuracyScore: attemptScore.overallAccuracy, // Azure returns overallAccuracy as the main score
            fluencyScore: attemptScore.fluency ?? 0,
            completenessScore: attemptScore.completeness ?? 0,
            prosodyScore: attemptScore.prosody,
            passed,
            recordingDurationSeconds,
            retriesInThisSession,
            usedHint: logParams.usedHint,
            slowedAudioPlayback: logParams.slowedAudioPlayback,
            listenedToNativeModelCount: logParams.listenedToNativeModelCount,
            wordScores: wordScores.length > 0 ? wordScores : undefined,
            latencyMs, // Include latency in practice log
            recordingUrl: audioUrl || undefined, // Include recording URL for playback (blob URL, may not persist across sessions)
            recordingDataUrl,
          });

          // Increment retry count for this sentence
          retriesBySentenceRef.current.set(sentenceId, retriesInThisSession + 1);
        } catch (logError) {
          if (import.meta.env.DEV) {
            console.warn('Failed to log sentence attempt:', logError);
          }
        }
      }

      // Don't reset recorder after submission - preserve audioUrl for playback
      // The recorder will be reset when:
      // 1. User explicitly clicks "Reset" button
      // 2. User starts a new recording (startRecording clears previous state)
      // 3. Sentence changes (handled by parent component)
      recordingStartTimeRef.current = null;
      setAttemptState('scored');
    } catch (err) {
      // Check if request was aborted
      if (abortController.signal.aborted || activeRequestIdRef.current !== requestId) {
        return; // Don't update state if component unmounted
      }

      // Handle fetch errors
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // Request was aborted, don't set error state
          return;
        }
        
        // Provide more specific error messages
        let errorMessage = err.message || 'Failed to assess pronunciation. Please try again.';
        
        // Check for network errors
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Network error: Could not connect to the server. Please check your connection and ensure the API route is configured.';
        } else if (err.message.includes('404')) {
          errorMessage = 'API endpoint not found. Please ensure the server is running and the /api/pronunciation/assessment route is configured.';
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error: The pronunciation assessment service encountered an error. Please try again.';
        }
        
        setError(errorMessage);
        setAttemptState('error');
      } else {
        setError('Failed to assess pronunciation. Please try again.');
        setAttemptState('error');
      }

      console.error('Error submitting pronunciation assessment:', err);
      if (import.meta.env.DEV) {
        console.error('Full error details:', {
          error: err,
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    } finally {
      if (activeRequestIdRef.current === requestId) {
        activeRequestIdRef.current = null;
        abortControllerRef.current = null;
        setSubmitting(false);
      }
    }
  }, [audioBlob, audioUrl, logSentenceAttempt]);

  // Derive current attempt (most recent)
  const currentAttempt = attempts.length > 0 ? attempts[0] : null;

  // Derive raw Azure response for current attempt
  const rawAzureResponse = currentAttempt?.attemptId 
    ? allRawAzureResponses.get(currentAttempt.attemptId) || null
    : null;

  // Combine recorder error with submission error
  const combinedError = error || recorderError;

  return {
    // Recording state
    isRecording,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,

    // Submission state
    submitting,
    error: combinedError,
    attemptState,

    // Attempt state
    attempts,
    currentAttempt,
    rawAzureResponse,
    allRawAzureResponses,

    // Actions
    submitAttempt,
    cancelAnalysis,
  };
}
