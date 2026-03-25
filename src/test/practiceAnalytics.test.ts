import { describe, it, expect } from 'vitest';
import {
  buildSentenceProgress,
  buildWordProgress,
  computeUserGlobalStats,
  computeDifficultyStats,
  computeCategoryStats,
  computePhonemeStats,
  computeUxDiagnostics,
} from '@/lib/practiceAnalytics';
import type {
  SentencePracticeAttempt,
  WordPracticeAttempt,
  PracticeSession,
} from '@/lib/types';

describe('practiceAnalytics', () => {
  // Helper to create test attempts with fixed dates
  const createDate = (daysAgo: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
  };

  describe('buildSentenceProgress', () => {
    it('should build progress for sentences with multiple attempts', () => {
      const date1 = createDate(5);
      const date2 = createDate(3);
      const date3 = createDate(1);

      const attempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: date1,
          overallScore: 60,
          accuracyScore: 65,
          fluencyScore: 55,
          completenessScore: 70,
          passed: false,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: date2,
          overallScore: 85,
          accuracyScore: 90,
          fluencyScore: 80,
          completenessScore: 85,
          passed: true,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session2',
          sentenceId: 'sent2',
          difficulty: 3,
          category: 'travel',
          createdAt: date3,
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
          passed: true,
        },
      ];

      const result = buildSentenceProgress(attempts, 100);

      // Check per-sentence progress
      expect(result.perSentence['sent1']).toBeDefined();
      expect(result.perSentence['sent1'].attempts).toBe(2);
      expect(result.perSentence['sent1'].successfulAttempts).toBe(1);
      expect(result.perSentence['sent1'].bestOverallScore).toBe(85);
      expect(result.perSentence['sent1'].bestAccuracyScore).toBe(90);
      expect(result.perSentence['sent1'].avgOverallScore).toBe(72.5); // (60 + 85) / 2
      expect(result.perSentence['sent1'].status).toBe('known'); // best score >= 85
      expect(result.perSentence['sent1'].firstPracticedAt).toBe(date1);
      expect(result.perSentence['sent1'].lastPracticedAt).toBe(date2);

      expect(result.perSentence['sent2']).toBeDefined();
      expect(result.perSentence['sent2'].attempts).toBe(1);
      expect(result.perSentence['sent2'].status).toBe('learning'); // best score >= 60 but < 85

      // Check global counts
      expect(result.globalCounts.known).toBe(1); // sent1
      expect(result.globalCounts.learning).toBe(1); // sent2
      expect(result.globalCounts.review).toBe(0);
      expect(result.globalCounts.new).toBe(98); // 100 total - 2 practiced
    });

    it('should handle empty attempts array', () => {
      const result = buildSentenceProgress([], 50);
      expect(Object.keys(result.perSentence)).toHaveLength(0);
      expect(result.globalCounts.known).toBe(0);
      expect(result.globalCounts.learning).toBe(0);
      expect(result.globalCounts.review).toBe(0);
      expect(result.globalCounts.new).toBe(50);
    });

    it('should classify status correctly based on best score', () => {
      const attempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 90,
          accuracyScore: 95,
          fluencyScore: 85,
          completenessScore: 90,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent3',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 50,
          accuracyScore: 55,
          fluencyScore: 45,
          completenessScore: 50,
        },
      ];

      const result = buildSentenceProgress(attempts, 100);
      expect(result.perSentence['sent1'].status).toBe('known'); // >= 85
      expect(result.perSentence['sent2'].status).toBe('learning'); // >= 60 but < 85
      expect(result.perSentence['sent3'].status).toBe('review'); // < 60
    });
  });

  describe('buildWordProgress', () => {
    it('should build progress for words with multiple attempts', () => {
      const attempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(5),
          overallScore: 75,
          accuracyScore: 80,
          passed: true,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(3),
          overallScore: 90,
          accuracyScore: 95,
          passed: true,
        },
      ];

      const result = buildWordProgress(attempts, 200);

      expect(result.perWord['word1']).toBeDefined();
      expect(result.perWord['word1'].attempts).toBe(2);
      expect(result.perWord['word1'].successfulAttempts).toBe(2);
      expect(result.perWord['word1'].bestOverallScore).toBe(90);
      expect(result.perWord['word1'].avgOverallScore).toBe(82.5);
      expect(result.perWord['word1'].status).toBe('known');
    });
  });

  describe('computeUserGlobalStats', () => {
    it('should compute global stats with sessions and attempts', () => {
      const sessions: PracticeSession[] = [
        {
          sessionId: 'session1',
          userId: 'test-user',
          startedAt: createDate(10),
          endedAt: createDate(10),
          durationSeconds: 300, // 5 minutes
          mode: 'sentences',
          totalAttempts: 5,
          sentenceAttempts: 5,
          wordAttempts: 0,
        },
        {
          sessionId: 'session2',
          userId: 'test-user',
          startedAt: createDate(5),
          endedAt: createDate(5),
          durationSeconds: 600, // 10 minutes
          mode: 'words',
          totalAttempts: 10,
          sentenceAttempts: 0,
          wordAttempts: 10,
        },
        {
          sessionId: 'session3',
          userId: 'test-user',
          startedAt: createDate(1),
          endedAt: createDate(1),
          durationSeconds: 180, // 3 minutes
          mode: 'mixed',
          totalAttempts: 3,
          sentenceAttempts: 2,
          wordAttempts: 1,
        },
      ];

      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(10),
          overallScore: 85,
          accuracyScore: 90,
          fluencyScore: 80,
          completenessScore: 85,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(10),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session3',
          sentenceId: 'sent3',
          difficulty: 3,
          category: 'travel',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        },
      ];

      const wordAttempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt4',
          userId: 'test-user',
          sessionId: 'session2',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(5),
          overallScore: 90,
          accuracyScore: 95,
        },
      ];

      const stats = computeUserGlobalStats(
        sessions,
        sentenceAttempts,
        wordAttempts,
        100,
        200
      );

      expect(stats.totalPracticeSessions).toBe(3);
      expect(stats.totalPracticeSeconds).toBe(1080); // 300 + 600 + 180
      expect(stats.totalSentenceAttempts).toBe(3);
      expect(stats.totalWordAttempts).toBe(1);
      expect(stats.sentencesPracticedCount).toBe(3);
      expect(stats.wordsPracticedCount).toBe(1);
    });

    it('should calculate streaks correctly', () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date(today);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const fiveDaysAgo = new Date(today);
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const sessions: PracticeSession[] = [
        {
          sessionId: 'session1',
          userId: 'test-user',
          startedAt: today.toISOString(),
          endedAt: today.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
        {
          sessionId: 'session2',
          userId: 'test-user',
          startedAt: yesterday.toISOString(),
          endedAt: yesterday.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
        {
          sessionId: 'session3',
          userId: 'test-user',
          startedAt: twoDaysAgo.toISOString(),
          endedAt: twoDaysAgo.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
        {
          sessionId: 'session4',
          userId: 'test-user',
          startedAt: threeDaysAgo.toISOString(),
          endedAt: threeDaysAgo.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
        // Gap here (4 days ago)
        {
          sessionId: 'session5',
          userId: 'test-user',
          startedAt: fiveDaysAgo.toISOString(),
          endedAt: fiveDaysAgo.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
      ];

      const stats = computeUserGlobalStats(sessions, [], [], 100, 200);

      // Current streak should be 4 (today, yesterday, 2 days ago, 3 days ago)
      expect(stats.currentDailyStreak).toBeGreaterThanOrEqual(3);
      // Longest streak should be at least 4
      expect(stats.longestDailyStreak).toBeGreaterThanOrEqual(3);
    });

    it('should calculate rolling averages correctly', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now);
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const sessions: PracticeSession[] = [
        {
          sessionId: 'session1',
          userId: 'test-user',
          startedAt: now.toISOString(),
          endedAt: now.toISOString(),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 0,
          sentenceAttempts: 0,
          wordAttempts: 0,
        },
      ];

      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: now.toISOString(),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'food',
          createdAt: threeDaysAgo.toISOString(),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent3',
          difficulty: 2,
          category: 'food',
          createdAt: tenDaysAgo.toISOString(),
          overallScore: 60,
          accuracyScore: 65,
          fluencyScore: 55,
          completenessScore: 60,
        },
      ];

      const stats = computeUserGlobalStats(sessions, sentenceAttempts, [], 100, 200);

      // 7-day average should include attempts from now and 3 days ago (75 average)
      expect(stats.rolling7DayAvgOverallScore).toBeDefined();
      expect(stats.rolling7DayAvgOverallScore).toBeCloseTo(75, 1); // (80 + 70) / 2

      // 30-day average should include all attempts (70 average)
      expect(stats.rolling30DayAvgOverallScore).toBeDefined();
      expect(stats.rolling30DayAvgOverallScore).toBeCloseTo(70, 1); // (80 + 70 + 60) / 3
    });
  });

  describe('computeDifficultyStats', () => {
    it('should group stats by difficulty level', () => {
      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 90,
          accuracyScore: 95,
          fluencyScore: 85,
          completenessScore: 90,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 3,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent3',
          difficulty: 3,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        },
      ];

      const wordAttempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt4',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 85,
          accuracyScore: 90,
        },
      ];

      const sentenceProgress = buildSentenceProgress(sentenceAttempts, 100);
      const wordProgress = buildWordProgress(wordAttempts, 200);

      const stats = computeDifficultyStats(
        sentenceAttempts,
        wordAttempts,
        sentenceProgress.perSentence,
        wordProgress.perWord
      );

      expect(stats).toHaveLength(3); // One for each difficulty level 2-4

      const difficulty2 = stats.find((s) => s.difficulty === 2);
      expect(difficulty2).toBeDefined();
      expect(difficulty2?.sentenceAttempts).toBe(1);
      expect(difficulty2?.wordAttempts).toBe(1);
      expect(difficulty2?.avgOverallScore).toBeCloseTo(87.5, 1); // (90 + 85) / 2

      const difficulty3 = stats.find((s) => s.difficulty === 3);
      expect(difficulty3).toBeDefined();
      expect(difficulty3?.sentenceAttempts).toBe(2);
      expect(difficulty3?.wordAttempts).toBe(0);
      expect(difficulty3?.avgOverallScore).toBe(75); // (80 + 70) / 2
    });
  });

  describe('computeCategoryStats', () => {
    it('should group stats by category', () => {
      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'travel',
          createdAt: createDate(1),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
        },
      ];

      const sentenceProgress = buildSentenceProgress(sentenceAttempts, 100);

      const stats = computeCategoryStats(
        sentenceAttempts,
        [],
        sentenceProgress.perSentence,
        undefined
      );

      expect(stats.length).toBeGreaterThanOrEqual(2);
      const foodStats = stats.find((s) => s.category === 'food');
      const travelStats = stats.find((s) => s.category === 'travel');

      expect(foodStats).toBeDefined();
      expect(foodStats?.sentenceAttempts).toBe(1);
      expect(foodStats?.avgOverallScore).toBe(80);

      expect(travelStats).toBeDefined();
      expect(travelStats?.sentenceAttempts).toBe(1);
      expect(travelStats?.avgOverallScore).toBe(70);
    });
  });

  describe('computePhonemeStats', () => {
    it('should extract and aggregate phoneme scores from attempts', () => {
      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
          wordScores: [
            {
              token: 'pão',
              overallScore: 85,
              accuracyScore: 90,
              phonemeScores: [
                { phonemeId: 'p', overallScore: 90 },
                { phonemeId: 'ao', overallScore: 80 },
              ],
            },
          ],
        },
      ];

      const wordAttempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 75,
          accuracyScore: 80,
          phonemeScores: [
            { phonemeId: 'p', overallScore: 85 },
            { phonemeId: 'ao', overallScore: 70 },
          ],
        },
      ];

      const stats = computePhonemeStats(sentenceAttempts, wordAttempts);

      expect(stats.length).toBeGreaterThanOrEqual(2);

      const phonemeP = stats.find((s) => s.phonemeId === 'p');
      expect(phonemeP).toBeDefined();
      expect(phonemeP?.attempts).toBe(2);
      expect(phonemeP?.avgOverallScore).toBeCloseTo(87.5, 1); // (90 + 85) / 2
      expect(phonemeP?.bestOverallScore).toBe(90);
      expect(phonemeP?.weaknessLabel).toBe('strong'); // avg >= 85

      const phonemeAO = stats.find((s) => s.phonemeId === 'ao');
      expect(phonemeAO).toBeDefined();
      expect(phonemeAO?.attempts).toBe(2);
      expect(phonemeAO?.avgOverallScore).toBe(75); // (80 + 70) / 2
      expect(phonemeAO?.weaknessLabel).toBe('ok'); // 60 <= avg < 85
    });

    it('should assign weakness labels correctly', () => {
      const wordAttempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 50,
          accuracyScore: 55,
          phonemeScores: [{ phonemeId: 'weak', overallScore: 50 }],
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word2',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 75,
          accuracyScore: 80,
          phonemeScores: [{ phonemeId: 'ok', overallScore: 75 }],
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session1',
          wordId: 'word3',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 90,
          accuracyScore: 95,
          phonemeScores: [{ phonemeId: 'strong', overallScore: 90 }],
        },
      ];

      const stats = computePhonemeStats([], wordAttempts);

      const weakPhoneme = stats.find((s) => s.phonemeId === 'weak');
      expect(weakPhoneme?.weaknessLabel).toBe('weak'); // < 60

      const okPhoneme = stats.find((s) => s.phonemeId === 'ok');
      expect(okPhoneme?.weaknessLabel).toBe('ok'); // 60-85

      const strongPhoneme = stats.find((s) => s.phonemeId === 'strong');
      expect(strongPhoneme?.weaknessLabel).toBe('strong'); // > 85
    });
  });

  describe('computeUxDiagnostics', () => {
    it('should compute UX metrics correctly', () => {
      const sessions: PracticeSession[] = [
        {
          sessionId: 'session1',
          userId: 'test-user',
          startedAt: createDate(1),
          endedAt: createDate(1),
          durationSeconds: 100,
          mode: 'sentences',
          totalAttempts: 2,
          sentenceAttempts: 2,
          wordAttempts: 0,
        },
        {
          sessionId: 'session2',
          userId: 'test-user',
          startedAt: createDate(1),
          endedAt: createDate(1),
          durationSeconds: 100,
          mode: 'words',
          totalAttempts: 1,
          sentenceAttempts: 0,
          wordAttempts: 1,
        },
        {
          sessionId: 'session3',
          userId: 'test-user',
          startedAt: createDate(1),
          endedAt: createDate(1),
          durationSeconds: 100,
          mode: 'mixed',
          totalAttempts: 1,
          sentenceAttempts: 1,
          wordAttempts: 0,
        },
      ];

      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
          usedHint: true,
          slowedAudioPlayback: false,
          listenedToNativeModelCount: 2,
          retriesInThisSession: 1,
        },
        {
          attemptId: 'attempt2',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent2',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 70,
          accuracyScore: 75,
          fluencyScore: 65,
          completenessScore: 70,
          usedHint: false,
          slowedAudioPlayback: true,
          listenedToNativeModelCount: 1,
          retriesInThisSession: 0,
        },
        {
          attemptId: 'attempt3',
          userId: 'test-user',
          sessionId: 'session3',
          sentenceId: 'sent3',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 75,
          accuracyScore: 80,
          fluencyScore: 70,
          completenessScore: 75,
          usedHint: true,
          slowedAudioPlayback: true,
          listenedToNativeModelCount: 3,
          retriesInThisSession: 2,
        },
      ];

      const wordAttempts: WordPracticeAttempt[] = [
        {
          attemptId: 'attempt4',
          userId: 'test-user',
          sessionId: 'session2',
          wordId: 'word1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 85,
          accuracyScore: 90,
          usedHint: false,
          slowedAudioPlayback: false,
          listenedToNativeModelCount: 0,
          retriesInThisSession: 0,
        },
      ];

      const diagnostics = computeUxDiagnostics(sentenceAttempts, wordAttempts, sessions);

      // Hint usage: 2 out of 4 attempts used hints
      expect(diagnostics.hintsUsedCount).toBe(2);
      expect(diagnostics.hintsUsageRate).toBeCloseTo(0.5, 2); // 2/4

      // Slowed playback: 2 out of 4 attempts
      expect(diagnostics.slowedPlaybackUsageRate).toBeCloseTo(0.5, 2); // 2/4

      // Average listens: (2 + 1 + 3 + 0) / 4 = 1.5
      expect(diagnostics.averageListensToNativeModel).toBeCloseTo(1.5, 1);

      // Average retries for sentences: (1 + 0 + 2) / 3 = 1
      expect(diagnostics.averageRetriesPerSentenceAttempt).toBeCloseTo(1, 1);

      // Average retries for words: 0 / 1 = 0
      expect(diagnostics.averageRetriesPerWordAttempt).toBe(0);

      // Mode distribution
      expect(diagnostics.modeDistribution.sentences).toBe(1);
      expect(diagnostics.modeDistribution.words).toBe(1);
      expect(diagnostics.modeDistribution.mixed).toBe(1);
      expect(diagnostics.modeDistribution.assessment).toBe(0);
    });

    it('should handle undefined UX fields gracefully', () => {
      const sentenceAttempts: SentencePracticeAttempt[] = [
        {
          attemptId: 'attempt1',
          userId: 'test-user',
          sessionId: 'session1',
          sentenceId: 'sent1',
          difficulty: 2,
          category: 'food',
          createdAt: createDate(1),
          overallScore: 80,
          accuracyScore: 85,
          fluencyScore: 75,
          completenessScore: 80,
          // No UX fields defined
        },
      ];

      const diagnostics = computeUxDiagnostics(sentenceAttempts, [], []);

      expect(diagnostics.hintsUsedCount).toBe(0);
      expect(diagnostics.hintsUsageRate).toBe(0);
      expect(diagnostics.averageListensToNativeModel).toBe(0);
      expect(diagnostics.averageRetriesPerSentenceAttempt).toBe(0);
    });
  });
});

