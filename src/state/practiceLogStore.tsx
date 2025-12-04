/**
 * Practice Log Store
 * 
 * Manages and persists pronunciation attempt history for sentences and words.
 * All sentence attempts are persisted to localStorage and can be viewed in Practice Sentences.
 * Attempts are automatically saved on every log and restored on app load.
 * 
 * DUAL-WRITE: When user is authenticated, also persists to backend API.
 * 
 * TODO: Gradually shift to server data as source of truth:
 *   - Load attempts from /api/pronunciation-attempts for authenticated users
 *   - Fall back to localStorage for unauthenticated users
 *   - Consider deprecating localStorage once migration is complete
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type {
  PracticeSession,
  SentencePracticeAttempt,
  WordPracticeAttempt,
} from '@/lib/types';
import { isAuthenticated } from '@/api/auth';
import {
  createPracticeSession as createServerSession,
  completePracticeSession as completeServerSession,
  logPronunciationAttempt as logServerAttempt,
} from '@/api/practice';

interface PracticeLogStoreState {
  userId: string;
  sessions: PracticeSession[];
  sentenceAttempts: SentencePracticeAttempt[];
  wordAttempts: WordPracticeAttempt[];
  // Map of local sessionId -> server sessionId (for authenticated users)
  serverSessionIds: Record<string, string>;
}

interface PracticeLogStore extends PracticeLogStoreState {
  storageError: boolean;
  startSession: (mode: PracticeSession['mode']) => Promise<string>;
  endSession: (sessionId: string) => Promise<void>;
  logSentenceAttempt: (
    attempt: Omit<SentencePracticeAttempt, 'attemptId' | 'userId' | 'createdAt'>
  ) => SentencePracticeAttempt;
  logWordAttempt: (
    attempt: Omit<WordPracticeAttempt, 'attemptId' | 'userId' | 'createdAt'>
  ) => WordPracticeAttempt;
  // Selectors
  getAllSessions: () => PracticeSession[];
  getAllSentenceAttempts: () => SentencePracticeAttempt[];
  getAllWordAttempts: () => WordPracticeAttempt[];
  getAttemptsBySessionId: (
    sessionId: string
  ) => { sentences: SentencePracticeAttempt[]; words: WordPracticeAttempt[] };
  getAttemptsBySentenceId: (sentenceId: string) => SentencePracticeAttempt[];
  getLastNSessions: (n: number) => PracticeSession[];
  getRecentAttempts: (
    limit: number
  ) => { sentences: SentencePracticeAttempt[]; words: WordPracticeAttempt[] };
}

const PracticeLogStoreContext = createContext<PracticeLogStore | null>(null);

const STORAGE_KEY = 'luso_practice_log_v1';
const DEFAULT_USER_ID = 'local_user';

// Generate a unique attempt ID
function generateAttemptId(): string {
  return `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Generate a unique session ID
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Load practice log data from localStorage
function loadPracticeLogFromStorage(): PracticeLogStoreState {
  try {
    if (typeof window === 'undefined') {
      return {
        userId: DEFAULT_USER_ID,
        sessions: [],
        sentenceAttempts: [],
        wordAttempts: [],
      };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure and provide defaults for missing fields
      return {
        userId: parsed.userId || DEFAULT_USER_ID,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        sentenceAttempts: Array.isArray(parsed.sentenceAttempts)
          ? parsed.sentenceAttempts
          : [],
        wordAttempts: Array.isArray(parsed.wordAttempts) ? parsed.wordAttempts : [],
        serverSessionIds: parsed.serverSessionIds || {},
      };
    }
  } catch (error) {
    console.error('Error loading practice log from storage:', error);
  }
  return {
    userId: DEFAULT_USER_ID,
    sessions: [],
    sentenceAttempts: [],
    wordAttempts: [],
    serverSessionIds: {},
  };
}

/**
 * Saves practice log to localStorage with quota error handling.
 * @returns true if save was successful, false if quota exceeded or other error
 */
function savePracticeLogToStorage(state: PracticeLogStoreState): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    // Check if it's a quota exceeded error
    if (
      error instanceof DOMException &&
      (error.code === 22 || // QUOTA_EXCEEDED_ERR
        error.code === 1014 || // NS_ERROR_DOM_QUOTA_REACHED
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      console.error('Storage quota exceeded. Unable to save practice log.');
      return false;
    }
    console.error('Error saving practice log to storage:', error);
    return false;
  }
}

/**
 * Calculate average scores for a session based on its attempts
 */
function calculateSessionAverages(
  sessionId: string,
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[]
): {
  avgOverallScore?: number;
  avgFluencyScore?: number;
  avgAccuracyScore?: number;
  avgCompletenessScore?: number;
  avgProsodyScore?: number;
} {
  const sessionSentences = sentenceAttempts.filter((a) => a.sessionId === sessionId);
  const sessionWords = wordAttempts.filter((a) => a.sessionId === sessionId);
  const allAttempts = [...sessionSentences, ...sessionWords];

  if (allAttempts.length === 0) {
    return {};
  }

  let totalOverall = 0;
  let totalFluency = 0;
  let totalAccuracy = 0;
  let totalCompleteness = 0;
  let totalProsody = 0;
  let countFluency = 0;
  let countCompleteness = 0;
  let countProsody = 0;

  for (const attempt of allAttempts) {
    totalOverall += attempt.overallScore;
    totalAccuracy += attempt.accuracyScore;

    if ('fluencyScore' in attempt && attempt.fluencyScore !== undefined) {
      totalFluency += attempt.fluencyScore;
      countFluency++;
    }
    if (
      'completenessScore' in attempt &&
      attempt.completenessScore !== undefined
    ) {
      totalCompleteness += attempt.completenessScore;
      countCompleteness++;
    }
    if ('prosodyScore' in attempt && attempt.prosodyScore !== undefined) {
      totalProsody += attempt.prosodyScore;
      countProsody++;
    }
  }

  const result: {
    avgOverallScore?: number;
    avgFluencyScore?: number;
    avgAccuracyScore?: number;
    avgCompletenessScore?: number;
    avgProsodyScore?: number;
  } = {
    avgOverallScore: totalOverall / allAttempts.length,
    avgAccuracyScore: totalAccuracy / allAttempts.length,
  };

  if (countFluency > 0) {
    result.avgFluencyScore = totalFluency / countFluency;
  }
  if (countCompleteness > 0) {
    result.avgCompletenessScore = totalCompleteness / countCompleteness;
  }
  if (countProsody > 0) {
    result.avgProsodyScore = totalProsody / countProsody;
  }

  return result;
}

export function PracticeLogStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PracticeLogStoreState>(() =>
    loadPracticeLogFromStorage()
  );
  const [storageError, setStorageError] = useState(false);

  // Save to localStorage whenever state changes
  useEffect(() => {
    const success = savePracticeLogToStorage(state);
    setStorageError(!success);
  }, [state]);

  const startSession = useCallback(
    async (mode: PracticeSession['mode']): Promise<string> => {
      const sessionId = generateSessionId();
      const now = new Date().toISOString();

      const newSession: PracticeSession = {
        sessionId,
        userId: state.userId,
        startedAt: now,
        endedAt: '', // Will be set when session ends
        durationSeconds: 0,
        mode,
        totalAttempts: 0,
        sentenceAttempts: 0,
        wordAttempts: 0,
      };

      // Dual-write: Create session on server if authenticated
      let serverSessionId: string | undefined;
      if (isAuthenticated()) {
        try {
          const serverSession = await createServerSession(mode);
          serverSessionId = serverSession.id;
        } catch (error) {
          // Log error but don't block local session creation
          console.warn('[PracticeLogStore] Failed to create server session:', error);
        }
      }

      setState((prev) => ({
        ...prev,
        sessions: [...prev.sessions, newSession],
        serverSessionIds: serverSessionId
          ? { ...prev.serverSessionIds, [sessionId]: serverSessionId }
          : prev.serverSessionIds,
      }));

      return sessionId;
    },
    [state.userId]
  );

  const endSession = useCallback(async (sessionId: string) => {
    setState((prev) => {
      const session = prev.sessions.find((s) => s.sessionId === sessionId);
      if (!session) {
        console.warn(`Session ${sessionId} not found`);
        return prev;
      }

      const now = new Date();
      const startedAt = new Date(session.startedAt);
      const durationSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      // Count attempts for this session
      const sentenceAttempts = prev.sentenceAttempts.filter(
        (a) => a.sessionId === sessionId
      );
      const wordAttempts = prev.wordAttempts.filter((a) => a.sessionId === sessionId);
      const totalAttempts = sentenceAttempts.length + wordAttempts.length;

      // Calculate averages
      const averages = calculateSessionAverages(
        sessionId,
        prev.sentenceAttempts,
        prev.wordAttempts
      );

      const updatedSession: PracticeSession = {
        ...session,
        endedAt: now.toISOString(),
        durationSeconds,
        totalAttempts,
        sentenceAttempts: sentenceAttempts.length,
        wordAttempts: wordAttempts.length,
        ...averages,
      };

      // Dual-write: Complete session on server if authenticated
      const serverSessionId = prev.serverSessionIds[sessionId];
      if (isAuthenticated() && serverSessionId) {
        completeServerSession(serverSessionId).catch((error) => {
          // Log error but don't block local session completion
          console.warn('[PracticeLogStore] Failed to complete server session:', error);
        });
      }

      return {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.sessionId === sessionId ? updatedSession : s
        ),
      };
    });
  }, []);

  /**
   * Logs a sentence practice attempt.
   * The attempt is automatically persisted to localStorage and can be viewed in Practice Sentences.
   * Every attempt is stored in the history, allowing users to review past attempts with scores and recordings.
   */
  const logSentenceAttempt = useCallback(
    (
      attempt: Omit<SentencePracticeAttempt, 'attemptId' | 'userId' | 'createdAt'>
    ): SentencePracticeAttempt => {
      const fullAttempt: SentencePracticeAttempt = {
        ...attempt,
        attemptId: generateAttemptId(),
        userId: state.userId,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        sentenceAttempts: [...prev.sentenceAttempts, fullAttempt],
      }));

      // Dual-write: Log attempt on server if authenticated
      if (isAuthenticated()) {
        const serverSessionId = state.serverSessionIds[attempt.sessionId];
        // Note: textPt should ideally be passed in, but for now we'll use a placeholder
        // The backend requires textPt, so we'll use the sentenceId as a fallback identifier
        // TODO: Update logSentenceAttempt interface to accept textPt and textEn
        logServerAttempt({
          sessionId: serverSessionId,
          content: {
            contentId: attempt.sentenceId,
            contentType: 'sentence',
            textPt: attempt.sentenceId, // Temporary: use sentenceId as placeholder until we pass textPt
            textEn: undefined,
          },
          engine: 'azure_speech',
          scores: {
            overall: attempt.overallScore,
            accuracy: attempt.accuracyScore,
            fluency: attempt.fluencyScore,
            completeness: attempt.completenessScore,
            prosody: attempt.prosodyScore,
          },
          wordScores: attempt.wordScores?.map((ws) => ({
            token: ws.token,
            overallScore: ws.overallScore,
            accuracyScore: ws.accuracyScore,
            fluencyScore: ws.fluencyScore,
            errorType: ws.errorType,
            phonemeScores: ws.phonemeScores,
          })),
          recordingUrl: attempt.recordingUrl,
          recordingDataUrl: attempt.recordingDataUrl,
          recordingDurationSeconds: attempt.recordingDurationSeconds,
          latencyMs: attempt.latencyMs,
          passed: attempt.passed,
          targetOverallThreshold: attempt.targetOverallThreshold,
          targetAccuracyThreshold: attempt.targetAccuracyThreshold,
          retriesInThisSession: attempt.retriesInThisSession,
          usedHint: attempt.usedHint,
          slowedAudioPlayback: attempt.slowedAudioPlayback,
          listenedToNativeModelCount: attempt.listenedToNativeModelCount,
          confidenceLabel: attempt.confidenceLabel,
        }).catch((error) => {
          // Log error but don't block local attempt logging
          console.warn('[PracticeLogStore] Failed to log server attempt:', error);
        });
      }

      return fullAttempt;
    },
    [state.userId, state.serverSessionIds]
  );

  /**
   * Logs a word practice attempt.
   * 
   * Practice mode field usage:
   * 
   * - Pronunciation mode (WordCard.tsx):
   *   - practiceMode: 'pronunciation'
   *   - practiceDirection: undefined (not relevant)
   *   - isCorrect, latencyMs: undefined (not used)
   * 
   * - Text MCQ mode (future implementation):
   *   - practiceMode: 'text-mcq'
   *   - practiceDirection: 'pt-to-en' | 'en-to-pt'
   *   - isCorrect: boolean (whether user selected correct answer)
   *   - latencyMs: number (response time in milliseconds)
   * 
   * - Listening MCQ mode (future implementation):
   *   - practiceMode: 'listening-mcq'
   *   - practiceDirection: 'pt-to-en' | 'en-to-pt'
   *   - isCorrect: boolean
   *   - latencyMs: number
   * 
   * - Self-rating mode (WordCard "Know it" / "Review later" actions):
   *   - practiceMode: 'self-rating'
   *   - selfRating: 'know' | 'dont_know'
   *   - practiceDirection: undefined (not relevant)
   *   - isCorrect, latencyMs: undefined (not used)
   * 
   * All new fields are optional for backward compatibility with existing logs.
   */
  const logWordAttempt = useCallback(
    (attempt: Omit<WordPracticeAttempt, 'attemptId' | 'userId' | 'createdAt'>): WordPracticeAttempt => {
      const fullAttempt: WordPracticeAttempt = {
        ...attempt,
        attemptId: generateAttemptId(),
        userId: state.userId,
        createdAt: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        wordAttempts: [...prev.wordAttempts, fullAttempt],
      }));

      // Dual-write: Log attempt on server if authenticated
      if (isAuthenticated()) {
        const serverSessionId = state.serverSessionIds[attempt.sessionId];
        // Note: textPt should ideally be passed in, but for now we'll use a placeholder
        // The backend requires textPt, so we'll use the wordId as a fallback identifier
        // TODO: Update logWordAttempt interface to accept textPt and textEn
        logServerAttempt({
          sessionId: serverSessionId,
          content: {
            contentId: attempt.wordId,
            contentType: 'word',
            textPt: attempt.wordId, // Temporary: use wordId as placeholder until we pass textPt
            textEn: undefined,
          },
          engine: 'azure_speech',
          scores: {
            overall: attempt.overallScore,
            accuracy: attempt.accuracyScore,
            fluency: attempt.fluencyScore,
            completeness: attempt.completenessScore,
            prosody: attempt.prosodyScore,
          },
          wordScores: undefined, // Word attempts don't have word-level scores
          recordingUrl: undefined, // Word attempts may not have recording URLs
          recordingDataUrl: undefined,
          recordingDurationSeconds: attempt.recordingDurationSeconds,
          latencyMs: attempt.latencyMs,
          passed: attempt.passed,
          targetOverallThreshold: attempt.targetOverallThreshold,
          retriesInThisSession: attempt.retriesInThisSession,
          usedHint: attempt.usedHint,
          slowedAudioPlayback: attempt.slowedAudioPlayback,
          listenedToNativeModelCount: attempt.listenedToNativeModelCount,
          practiceDirection: attempt.practiceDirection,
          practiceMode: attempt.practiceMode,
          isCorrect: attempt.isCorrect,
          selfRating: attempt.selfRating,
        }).catch((error) => {
          // Log error but don't block local attempt logging
          console.warn('[PracticeLogStore] Failed to log server attempt:', error);
        });
      }

      return fullAttempt;
    },
    [state.userId, state.serverSessionIds]
  );

  // Selectors
  const getAllSessions = useCallback(() => {
    return state.sessions;
  }, [state.sessions]);

  const getAllSentenceAttempts = useCallback(() => {
    return state.sentenceAttempts;
  }, [state.sentenceAttempts]);

  const getAllWordAttempts = useCallback(() => {
    return state.wordAttempts;
  }, [state.wordAttempts]);

  const getAttemptsBySessionId = useCallback(
    (sessionId: string) => {
      return {
        sentences: state.sentenceAttempts.filter((a) => a.sessionId === sessionId),
        words: state.wordAttempts.filter((a) => a.sessionId === sessionId),
      };
    },
    [state.sentenceAttempts, state.wordAttempts]
  );

  /**
   * Gets all attempts for a specific sentence, sorted by timestamp descending (most recent first).
   * Used by Practice Sentences page to display attempt history.
   */
  const getAttemptsBySentenceId = useCallback(
    (sentenceId: string) => {
      return state.sentenceAttempts
        .filter((a) => a.sentenceId === sentenceId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [state.sentenceAttempts]
  );

  const getLastNSessions = useCallback(
    (n: number) => {
      return [...state.sessions]
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, n);
    },
    [state.sessions]
  );

  const getRecentAttempts = useCallback(
    (limit: number) => {
      // Combine and sort all attempts by creation time
      const allAttempts: Array<
        (SentencePracticeAttempt & { _type: 'sentence' }) |
        (WordPracticeAttempt & { _type: 'word' })
      > = [
        ...state.sentenceAttempts.map((a) => ({ ...a, _type: 'sentence' as const })),
        ...state.wordAttempts.map((a) => ({ ...a, _type: 'word' as const })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);

      return {
        sentences: allAttempts
          .filter((a): a is SentencePracticeAttempt & { _type: 'sentence' } => a._type === 'sentence')
          .map(({ _type, ...rest }) => rest as SentencePracticeAttempt),
        words: allAttempts
          .filter((a): a is WordPracticeAttempt & { _type: 'word' } => a._type === 'word')
          .map(({ _type, ...rest }) => rest as WordPracticeAttempt),
      };
    },
    [state.sentenceAttempts, state.wordAttempts]
  );

  const value = useMemo<PracticeLogStore>(
    () => ({
      userId: state.userId,
      sessions: state.sessions,
      sentenceAttempts: state.sentenceAttempts,
      wordAttempts: state.wordAttempts,
      storageError,
      startSession,
      endSession,
      logSentenceAttempt,
      logWordAttempt,
      getAllSessions,
      getAllSentenceAttempts,
      getAllWordAttempts,
      getAttemptsBySessionId,
      getAttemptsBySentenceId,
      getLastNSessions,
      getRecentAttempts,
    }),
    [
      state,
      storageError,
      startSession,
      endSession,
      logSentenceAttempt,
      logWordAttempt,
      getAllSessions,
      getAllSentenceAttempts,
      getAllWordAttempts,
      getAttemptsBySessionId,
      getAttemptsBySentenceId,
      getLastNSessions,
      getRecentAttempts,
    ]
  );

  return (
    <PracticeLogStoreContext.Provider value={value}>
      {children}
    </PracticeLogStoreContext.Provider>
  );
}

/**
 * Hook to access the practice log store.
 * @throws Error if used outside PracticeLogStoreProvider
 */
export function usePracticeLogStore(): PracticeLogStore {
  const context = useContext(PracticeLogStoreContext);
  if (!context) {
    throw new Error(
      'usePracticeLogStore must be used within PracticeLogStoreProvider'
    );
  }
  return context;
}

