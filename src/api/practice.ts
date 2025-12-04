/**
 * Practice API client
 * Handles practice sessions and pronunciation attempts
 */

import { authenticatedFetch } from './auth';
import type {
  PracticeSession,
  PronunciationAttempt,
  PracticeSessionMode,
  PracticeContentRef,
  PronunciationScores,
  WordScore,
  AssessmentEngine,
} from '../shared/types';

/**
 * Create a new practice session
 */
export async function createPracticeSession(
  mode: PracticeSessionMode
): Promise<PracticeSession> {
  const response = await authenticatedFetch('/api/practice-sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Complete a practice session
 */
export async function completePracticeSession(sessionId: string): Promise<PracticeSession> {
  const response = await authenticatedFetch(`/api/practice-sessions/${sessionId}/complete`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Log a pronunciation attempt
 */
export interface LogAttemptPayload {
  sessionId?: string;
  content: PracticeContentRef;
  engine: AssessmentEngine;
  scores: PronunciationScores;
  wordScores?: WordScore[];
  rawAssessment?: any;
  recordingUrl?: string;
  recordingDataUrl?: string;
  recordingDurationSeconds?: number;
  latencyMs?: number;
  passed?: boolean;
  targetOverallThreshold?: number;
  targetAccuracyThreshold?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  confidenceLabel?: 'unknown' | 'learning' | 'review' | 'known';
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  practiceMode?: 'pronunciation' | 'text-mcq' | 'listening-mcq' | 'self-rating';
  isCorrect?: boolean;
  selfRating?: 'know' | 'dont_know';
}

export async function logPronunciationAttempt(
  payload: LogAttemptPayload
): Promise<PronunciationAttempt> {
  const response = await authenticatedFetch('/api/pronunciation-attempts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch recent pronunciation attempts
 */
export interface FetchAttemptsParams {
  limit?: number;
  offset?: number;
  contentId?: string;
}

export interface FetchAttemptsResponse {
  attempts: PronunciationAttempt[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchRecentAttempts(
  params: FetchAttemptsParams = {}
): Promise<FetchAttemptsResponse> {
  const { limit = 50, offset = 0, contentId } = params;
  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  if (contentId) {
    queryParams.append('contentId', contentId);
  }

  const response = await authenticatedFetch(
    `/api/pronunciation-attempts?${queryParams.toString()}`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

