/**
 * Practice Log Store
 * 
 * Manages and persists pronunciation attempt history for sentences and words.
 * All sentence attempts are persisted to localStorage and can be viewed in Practice Sentences.
 * Attempts are automatically saved on every log and restored on app load.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type {
  PracticeSession,
  SentencePracticeAttempt,
  WordPracticeAttempt,
} from '@/lib/types';

interface PracticeLogStoreState {
  userId: string;
  sessions: PracticeSession[];
  sentenceAttempts: SentencePracticeAttempt[];
  wordAttempts: WordPracticeAttempt[];
}

interface PracticeLogStore extends PracticeLogStoreState {
  storageError: boolean;
  startSession: (mode: PracticeSession['mode']) => string;
  endSession: (sessionId: string) => void;
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
    (mode: PracticeSession['mode']): string => {
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

      setState((prev) => ({
        ...prev,
        sessions: [...prev.sessions, newSession],
      }));

      return sessionId;
    },
    [state.userId]
  );

  const endSession = useCallback((sessionId: string) => {
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

      return fullAttempt;
    },
    [state.userId]
  );

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

      return fullAttempt;
    },
    [state.userId]
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

