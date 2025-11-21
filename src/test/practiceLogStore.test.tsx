import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PracticeLogStoreProvider, usePracticeLogStore } from '@/state/practiceLogStore';
import { ReactNode } from 'react';
import type {
  SentencePracticeAttempt,
  WordPracticeAttempt,
} from '@/lib/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('practiceLogStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <PracticeLogStoreProvider>{children}</PracticeLogStoreProvider>
  );

  describe('startSession and endSession', () => {
    it('should create a session with correct mode', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('sentences');
      });

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const sessions = result.current.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].mode).toBe('sentences');
      expect(sessions[0].startedAt).toBeDefined();
      expect(sessions[0].endedAt).toBe(''); // Not ended yet
      expect(sessions[0].totalAttempts).toBe(0);
    });

    it('should end session and calculate duration', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      const startTime = new Date('2024-01-01T10:00:00Z');
      vi.setSystemTime(startTime);

      act(() => {
        sessionId = result.current.startSession('words');
      });

      const endTime = new Date('2024-01-01T10:05:00Z'); // 5 minutes later
      vi.setSystemTime(endTime);

      act(() => {
        result.current.endSession(sessionId);
      });

      const sessions = result.current.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].endedAt).toBeDefined();
      expect(sessions[0].endedAt).not.toBe('');
      expect(sessions[0].durationSeconds).toBe(300); // 5 minutes = 300 seconds
    });

    it('should update session metrics when ending with attempts', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('mixed');
      });

      // Log some attempts
      act(() => {
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        });
        result.current.logWordAttempt({
          sessionId,
          wordId: 'word1',
          difficulty: 1,
          category: 'food',
          overallScore: 90,
          accuracyScore: 95,
        });
      });

      act(() => {
        result.current.endSession(sessionId);
      });

      const sessions = result.current.getAllSessions();
      expect(sessions[0].totalAttempts).toBe(2);
      expect(sessions[0].sentenceAttempts).toBe(1);
      expect(sessions[0].wordAttempts).toBe(1);
      expect(sessions[0].avgOverallScore).toBeCloseTo(85, 1); // (80 + 90) / 2
      expect(sessions[0].avgAccuracyScore).toBeCloseTo(90, 1); // (85 + 95) / 2
    });
  });

  describe('logSentenceAttempt', () => {
    it('should create attempt with generated ID, userId, and createdAt', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('sentences');
      });

      const fixedTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(fixedTime);

      let attempt: SentencePracticeAttempt;
      act(() => {
        attempt = result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        });
      });

      expect(attempt.attemptId).toBeDefined();
      expect(attempt.attemptId).toContain('attempt_');
      expect(attempt.userId).toBe('local_user');
      expect(attempt.createdAt).toBe(fixedTime.toISOString());
      expect(attempt.sentenceId).toBe('sent1');
      expect(attempt.overallScore).toBe(80);

      const attempts = result.current.getAllSentenceAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toEqual(attempt);
    });

    it('should handle multiple attempts for same sentence', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('sentences');
      });

      act(() => {
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        });
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 85,
          accuracyScore: 90,
          fluencyScore: 80,
          completenessScore: 85,
        });
      });

      const attempts = result.current.getAllSentenceAttempts();
      expect(attempts).toHaveLength(2);
      expect(attempts.every((a) => a.sentenceId === 'sent1')).toBe(true);
    });
  });

  describe('logWordAttempt', () => {
    it('should create attempt with generated ID, userId, and createdAt', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('words');
      });

      const fixedTime = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(fixedTime);

      let attempt: WordPracticeAttempt;
      act(() => {
        attempt = result.current.logWordAttempt({
          sessionId,
          wordId: 'word1',
          difficulty: 1,
          category: 'food',
          overallScore: 90,
          accuracyScore: 95,
        });
      });

      expect(attempt.attemptId).toBeDefined();
      expect(attempt.attemptId).toContain('attempt_');
      expect(attempt.userId).toBe('local_user');
      expect(attempt.createdAt).toBe(fixedTime.toISOString());
      expect(attempt.wordId).toBe('word1');
      expect(attempt.overallScore).toBe(90);

      const attempts = result.current.getAllWordAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toEqual(attempt);
    });
  });

  describe('selectors', () => {
    it('should get attempts by session ID', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let session1: string;
      let session2: string;

      act(() => {
        session1 = result.current.startSession('sentences');
        session2 = result.current.startSession('words');
      });

      act(() => {
        result.current.logSentenceAttempt({
          sessionId: session1,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        });
        result.current.logWordAttempt({
          sessionId: session2,
          wordId: 'word1',
          difficulty: 1,
          category: 'food',
          overallScore: 90,
          accuracyScore: 95,
        });
      });

      const session1Attempts = result.current.getAttemptsBySessionId(session1);
      expect(session1Attempts.sentences).toHaveLength(1);
      expect(session1Attempts.words).toHaveLength(0);

      const session2Attempts = result.current.getAttemptsBySessionId(session2);
      expect(session2Attempts.sentences).toHaveLength(0);
      expect(session2Attempts.words).toHaveLength(1);
    });

    it('should get last N sessions', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      const times = [
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
      ];

      const sessionIds: string[] = [];
      act(() => {
        vi.setSystemTime(times[0]);
        sessionIds.push(result.current.startSession('sentences'));
        vi.setSystemTime(times[1]);
        sessionIds.push(result.current.startSession('words'));
        vi.setSystemTime(times[2]);
        sessionIds.push(result.current.startSession('mixed'));
      });

      const last2 = result.current.getLastNSessions(2);
      expect(last2).toHaveLength(2);
      // Should be sorted by startedAt descending (most recent first)
      expect(new Date(last2[0].startedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(last2[1].startedAt).getTime()
      );
      // Most recent should be the last one started
      expect(last2[0].startedAt).toBe(times[2].toISOString());
      expect(last2[1].startedAt).toBe(times[1].toISOString());
    });

    it('should get recent attempts', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('mixed');
      });

      const times = [
        new Date('2024-01-01T10:00:00Z'),
        new Date('2024-01-01T11:00:00Z'),
        new Date('2024-01-01T12:00:00Z'),
      ];

      act(() => {
        vi.setSystemTime(times[0]);
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        });

        vi.setSystemTime(times[1]);
        result.current.logWordAttempt({
          sessionId,
          wordId: 'word1',
          difficulty: 1,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
        });

        vi.setSystemTime(times[2]);
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'food',
          overallScore: 90,
          accuracyScore: 95,
          fluencyScore: 85,
          completenessScore: 90,
        });
      });

      const recent = result.current.getRecentAttempts(2);
      // Should return most recent 2 attempts
      expect(recent.sentences.length + recent.words.length).toBe(2);
      // Most recent should be sent2
      expect(recent.sentences[0].sentenceId).toBe('sent2');
    });
  });

  describe('localStorage persistence', () => {
    it('should persist state to localStorage', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('sentences');
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        });
      });

      // Check that data was saved to localStorage
      const stored = localStorageMock.getItem('luso_practice_log_v1');
      expect(stored).toBeDefined();
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.sessions).toHaveLength(1);
        expect(parsed.sentenceAttempts).toHaveLength(1);
      }
    });

    it('should load state from localStorage on initialization', () => {
      // Pre-populate localStorage
      const existingData = {
        userId: 'local_user',
        sessions: [
          {
            sessionId: 'existing-session',
            userId: 'local_user',
            startedAt: '2024-01-01T10:00:00Z',
            endedAt: '2024-01-01T10:05:00Z',
            durationSeconds: 300,
            mode: 'sentences',
            totalAttempts: 1,
            sentenceAttempts: 1,
            wordAttempts: 0,
          },
        ],
        sentenceAttempts: [
          {
            attemptId: 'existing-attempt',
            userId: 'local_user',
            sessionId: 'existing-session',
            sentenceId: 'sent1',
            difficulty: 2,
            category: 'food',
            createdAt: '2024-01-01T10:00:00Z',
            overallScore: 80,
            accuracyScore: 85,
            fluencyScore: 75,
            completenessScore: 80,
          },
        ],
        wordAttempts: [],
      };

      localStorageMock.setItem('luso_practice_log_v1', JSON.stringify(existingData));

      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      const sessions = result.current.getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('existing-session');

      const attempts = result.current.getAllSentenceAttempts();
      expect(attempts).toHaveLength(1);
      expect(attempts[0].attemptId).toBe('existing-attempt');
    });

    it('should handle malformed localStorage data gracefully', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      localStorageMock.setItem('luso_practice_log_v1', 'invalid json');

      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      // Should fall back to empty state
      expect(result.current.getAllSessions()).toHaveLength(0);
      expect(result.current.getAllSentenceAttempts()).toHaveLength(0);
      expect(result.current.getAllWordAttempts()).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle logging attempts before session ends', () => {
      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      let sessionId: string;
      act(() => {
        sessionId = result.current.startSession('sentences');
      });

      // Log attempts before ending session
      act(() => {
        result.current.logSentenceAttempt({
          sessionId,
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        });
      });

      // Should not throw
      expect(result.current.getAllSentenceAttempts()).toHaveLength(1);

      // End session
      act(() => {
        result.current.endSession(sessionId);
      });

      // Session should have correct metrics
      const sessions = result.current.getAllSessions();
      expect(sessions[0].totalAttempts).toBe(1);
    });

    it('should handle ending non-existent session gracefully', () => {
      // Suppress console.warn for this test
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => usePracticeLogStore(), { wrapper });

      // Should not throw
      act(() => {
        result.current.endSession('non-existent-session');
      });

      expect(result.current.getAllSessions()).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });
});

