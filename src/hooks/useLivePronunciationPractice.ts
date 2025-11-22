import { useState, useCallback, useRef, useEffect } from 'react';
import { useMicrophoneRecorder } from './useMicrophoneRecorder';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import type { AttemptScore, WordScore } from '@/types/pronunciation';

/**
 * Response type from the pronunciation assessment API
 */
type PronunciationAssessmentResponse = {
  rawAzure: any;
  attemptScore: AttemptScore;
};

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
};

/**
 * React hook for live pronunciation practice with Azure assessment and latency tracking.
 * 
 * Encapsulates:
 * - Microphone recording (via useMicrophoneRecorder)
 * - Audio submission to /api/pronunciation-assessment
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
  const [attempts, setAttempts] = useState<AttemptScore[]>([]);
  const [allRawAzureResponses, setAllRawAzureResponses] = useState<Map<string, any>>(new Map());

  // AbortController for canceling in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Track recording start time for duration calculation (optional, for logging)
  const recordingStartTimeRef = useRef<number | null>(null);

  // Track retries per sentence (for logging)
  const retriesBySentenceRef = useRef<Map<string, number>>(new Map());

  // Reset error when starting a new recording
  useEffect(() => {
    if (isRecording) {
      setError(null);
      recordingStartTimeRef.current = Date.now();
    }
  }, [isRecording]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Resets all state: recording, attempts, errors, etc.
   */
  const resetRecording = useCallback(() => {
    resetRecorder();
    setError(null);
    recordingStartTimeRef.current = null;
  }, [resetRecorder]);

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
      return;
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSubmitting(true);
    setError(null);

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
      const response = await fetch('/api/pronunciation-assessment', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      // Measure latency: stop timer after response is received
      const finishedAt = performance.now();
      const latencyMs = Math.round(finishedAt - startedAt);

      // Check if request was aborted
      if (abortController.signal.aborted) {
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
      if (abortController.signal.aborted) {
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
          });

          // Increment retry count for this sentence
          retriesBySentenceRef.current.set(sentenceId, retriesInThisSession + 1);
        } catch (logError) {
          if (import.meta.env.DEV) {
            console.warn('Failed to log sentence attempt:', logError);
          }
        }
      }

      // Reset recorder for next recording
      resetRecorder();
      recordingStartTimeRef.current = null;
    } catch (err) {
      // Check if request was aborted
      if (abortController.signal.aborted) {
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
          errorMessage = 'API endpoint not found. Please ensure the server is running and the /api/pronunciation-assessment route is configured.';
        } else if (err.message.includes('500')) {
          errorMessage = 'Server error: The pronunciation assessment service encountered an error. Please try again.';
        }
        
        setError(errorMessage);
      } else {
        setError('Failed to assess pronunciation. Please try again.');
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
      // Only update submitting state if request wasn't aborted
      if (!abortController.signal.aborted) {
        setSubmitting(false);
      }
    }
  }, [audioBlob, audioUrl, resetRecorder, logSentenceAttempt]);

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

    // Attempt state
    attempts,
    currentAttempt,
    rawAzureResponse,
    allRawAzureResponses,

    // Actions
    submitAttempt,
  };
}

