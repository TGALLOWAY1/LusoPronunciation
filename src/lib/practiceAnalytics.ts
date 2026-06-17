/**
 * Practice Analytics Utilities
 *
 * Pure functions for computing aggregate statistics and analytics from practice log data.
 * These functions are designed to be used by dashboard components and analytics views.
 *
 * All functions are pure (no side effects) and tree-shakable.
 */

import type {
  SentencePracticeAttempt,
  WordPracticeAttempt,
  PracticeSession,
  SentenceProgress,
  WordProgress,
  UserGlobalStats,
  DifficultyStats,
  CategoryStats,
  PhonemeStats,
  SentenceId,
  WordId,
  PhonemeId,
  DifficultyLevel,
  ContentCategory,
  AnalyticsWindow,
  TrendMetric,
  TrendPoint,
  ImprovementItem,
  AnalyticsInsight,
  PracticeRecommendation,
  Word,
  Sentence,
} from './types';
import { getPhonemeById } from './phonemeMetadata';

/**
 * Determines the status of a sentence/word based on practice history.
 * Simple heuristic: known if best score >= 85, learning if >= 60, review if < 60, new if no attempts.
 * 
 * Can optionally consider weaknessScore to adjust status:
 * - Very low weaknessScore + strong scores → more often "known"
 * - High weaknessScore → more often "learning" or "review"
 */
function determineStatus(
  attempts: number,
  bestScore?: number,
  weaknessScore?: number
): 'new' | 'learning' | 'review' | 'known' {
  if (attempts === 0) return 'new';
  if (bestScore === undefined) return 'new';
  
  // Adjust thresholds based on weaknessScore if provided
  if (weaknessScore !== undefined) {
    // High weakness (>= 50) makes it harder to reach "known" status
    if (weaknessScore >= 50) {
      if (bestScore >= 90) return 'known'; // Higher bar for "known"
      if (bestScore >= 65) return 'learning';
      return 'review';
    }
    // Low weakness (< 30) makes it easier to reach "known" status
    if (weaknessScore < 30) {
      if (bestScore >= 80) return 'known'; // Lower bar for "known"
      if (bestScore >= 55) return 'learning';
      return 'review';
    }
  }
  
  // Default logic (unchanged for backward compatibility)
  if (bestScore >= 85) return 'known';
  if (bestScore >= 60) return 'learning';
  return 'review';
}

/**
 * Builds sentence progress records from practice attempts.
 *
 * Aggregates attempts by sentenceId to compute:
 * - Attempt counts and success rates
 * - Best and average scores
 * - First and last practice dates
 * - Status classification (new/learning/review/known)
 *
 * @param attempts - Array of sentence practice attempts
 * @param totalSentencesAvailable - Total number of sentences in the system
 * @returns Object with per-sentence progress records and global status counts
 */
export function buildSentenceProgress(
  attempts: SentencePracticeAttempt[],
  totalSentencesAvailable: number
): {
  perSentence: Record<SentenceId, SentenceProgress>;
  globalCounts: { known: number; learning: number; review: number; new: number };
} {
  const perSentence: Record<SentenceId, SentenceProgress> = {};
  const sentenceMap = new Map<SentenceId, SentencePracticeAttempt[]>();

  // Group attempts by sentenceId
  for (const attempt of attempts) {
    const existing = sentenceMap.get(attempt.sentenceId) || [];
    existing.push(attempt);
    sentenceMap.set(attempt.sentenceId, existing);
  }

  // Build progress for each sentence
  for (const [sentenceId, sentenceAttempts] of sentenceMap.entries()) {
    if (sentenceAttempts.length === 0) continue;

    const sortedByDate = sentenceAttempts.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const firstAttempt = sortedByDate[0];
    const lastAttempt = sortedByDate[sortedByDate.length - 1];

    const successfulAttempts = sentenceAttempts.filter((a) => a.passed === true).length;
    const overallScores = sentenceAttempts.map((a) => a.overallScore);
    const accuracyScores = sentenceAttempts.map((a) => a.accuracyScore);
    const fluencyScores = sentenceAttempts
      .map((a) => a.fluencyScore)
      .filter((s): s is number => s !== undefined);
    const completenessScores = sentenceAttempts
      .map((a) => a.completenessScore)
      .filter((s): s is number => s !== undefined);

    const bestOverallScore = Math.max(...overallScores);
    const bestAccuracyScore = Math.max(...accuracyScores);
    const avgOverallScore =
      overallScores.reduce((sum, s) => sum + s, 0) / overallScores.length;
    const avgAccuracyScore =
      accuracyScores.reduce((sum, s) => sum + s, 0) / accuracyScores.length;
    const avgFluencyScore =
      fluencyScores.length > 0
        ? fluencyScores.reduce((sum, s) => sum + s, 0) / fluencyScores.length
        : undefined;
    const avgCompletenessScore =
      completenessScores.length > 0
        ? completenessScores.reduce((sum, s) => sum + s, 0) / completenessScores.length
        : undefined;

    perSentence[sentenceId] = {
      userId: firstAttempt.userId,
      sentenceId,
      attempts: sentenceAttempts.length,
      successfulAttempts,
      lastPracticedAt: lastAttempt.createdAt,
      firstPracticedAt: firstAttempt.createdAt,
      bestOverallScore,
      bestAccuracyScore,
      avgOverallScore,
      avgAccuracyScore,
      avgFluencyScore,
      avgCompletenessScore,
      status: determineStatus(sentenceAttempts.length, bestOverallScore),
      difficulty: firstAttempt.difficulty,
      category: firstAttempt.category,
    };
  }

  // Compute global counts
  const globalCounts = {
    known: 0,
    learning: 0,
    review: 0,
    new: totalSentencesAvailable - Object.keys(perSentence).length,
  };

  for (const progress of Object.values(perSentence)) {
    if (progress.status === 'known') globalCounts.known++;
    else if (progress.status === 'learning') globalCounts.learning++;
    else if (progress.status === 'review') globalCounts.review++;
  }

  return { perSentence, globalCounts };
}

/**
 * Builds word progress records from practice attempts.
 *
 * Similar to buildSentenceProgress but for words.
 * Aggregates attempts by wordId to compute progress metrics.
 *
 * @param wordAttempts - Array of word practice attempts
 * @param totalWordsAvailable - Total number of words in the system
 * @returns Object with per-word progress records and global status counts
 */
export function buildWordProgress(
  wordAttempts: WordPracticeAttempt[],
  totalWordsAvailable: number
): {
  perWord: Record<WordId, WordProgress>;
  globalCounts: { known: number; learning: number; review: number; new: number };
} {
  const perWord: Record<WordId, WordProgress> = {};
  const wordMap = new Map<WordId, WordPracticeAttempt[]>();

  // Group attempts by wordId
  for (const attempt of wordAttempts) {
    const existing = wordMap.get(attempt.wordId) || [];
    existing.push(attempt);
    wordMap.set(attempt.wordId, existing);
  }

  // Build progress for each word
  for (const [wordId, attempts] of wordMap.entries()) {
    if (attempts.length === 0) continue;

    const sortedByDate = attempts.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const firstAttempt = sortedByDate[0];
    const lastAttempt = sortedByDate[attempts.length - 1];

    const successfulAttempts = attempts.filter((a) => a.passed === true).length;
    const overallScores = attempts.map((a) => a.overallScore);
    const accuracyScores = attempts.map((a) => a.accuracyScore);

    const bestOverallScore = Math.max(...overallScores);
    const avgOverallScore =
      overallScores.reduce((sum, s) => sum + s, 0) / overallScores.length;
    const avgAccuracyScore =
      accuracyScores.reduce((sum, s) => sum + s, 0) / accuracyScores.length;

    // Compute weaknessScore
    let weaknessScore = 0;
    
    // If avgOverallScore < 70 → +30
    if (avgOverallScore < 70) {
      weaknessScore += 30;
    }
    
    // If best overallScore < 80 → +10
    if (bestOverallScore < 80) {
      weaknessScore += 10;
    }
    
    // Add +10 for each incorrect MCQ attempt (isCorrect === false)
    const incorrectMCQAttempts = attempts.filter(
      (a) => a.practiceMode === 'text-mcq' || a.practiceMode === 'listening-mcq'
        ? a.isCorrect === false
        : false
    ).length;
    weaknessScore += incorrectMCQAttempts * 10;
    
    // Add +10 if there is at least one selfRating of 'dont_know'
    const hasDontKnowRating = attempts.some(
      (a) => a.practiceMode === 'self-rating' && a.selfRating === 'dont_know'
    );
    if (hasDontKnowRating) {
      weaknessScore += 10;
    }
    
    // Add +10 if avg overallScore for pronunciation attempts < 70
    const pronunciationAttempts = attempts.filter(
      (a) => a.practiceMode === 'pronunciation' || a.practiceMode === undefined
    );
    if (pronunciationAttempts.length > 0) {
      const pronunciationScores = pronunciationAttempts.map((a) => a.overallScore);
      const avgPronunciationScore =
        pronunciationScores.reduce((sum, s) => sum + s, 0) / pronunciationScores.length;
      if (avgPronunciationScore < 70) {
        weaknessScore += 10;
      }
    }
    
    // Clamp to 0-100
    weaknessScore = Math.max(0, Math.min(100, weaknessScore));

    perWord[wordId] = {
      userId: firstAttempt.userId,
      wordId,
      attempts: attempts.length,
      successfulAttempts,
      lastPracticedAt: lastAttempt.createdAt,
      firstPracticedAt: firstAttempt.createdAt,
      bestOverallScore,
      avgOverallScore,
      avgAccuracyScore,
      status: determineStatus(attempts.length, bestOverallScore, weaknessScore),
      difficulty: firstAttempt.difficulty,
      category: firstAttempt.category,
      weaknessScore,
    };
  }

  // Compute global counts
  const globalCounts = {
    known: 0,
    learning: 0,
    review: 0,
    new: totalWordsAvailable - Object.keys(perWord).length,
  };

  for (const progress of Object.values(perWord)) {
    if (progress.status === 'known') globalCounts.known++;
    else if (progress.status === 'learning') globalCounts.learning++;
    else if (progress.status === 'review') globalCounts.review++;
  }

  return { perWord, globalCounts };
}

/**
 * Gets word IDs that are considered "weak" based on weaknessScore.
 * 
 * Used by the Practice Words UI to implement "Weak words only" filter mode.
 * 
 * @param wordProgress - Record of word progress by wordId
 * @param weaknessThreshold - Minimum weaknessScore to be considered weak (default: 50)
 * @returns Array of wordIds that have weaknessScore >= threshold
 */
export function getWeakWordIds(
  wordProgress: Record<WordId, WordProgress>,
  weaknessThreshold: number = 50
): WordId[] {
  return Object.values(wordProgress)
    .filter(wp => wp.weaknessScore >= weaknessThreshold)
    .map(wp => wp.wordId);
}

/**
 * Calculates daily streak from practice sessions.
 *
 * Returns both current streak (from today backwards) and longest streak ever.
 * A "practiced day" is any calendar day that has at least one session.
 *
 * @param sessions - Array of practice sessions
 * @returns Object with currentDailyStreak and longestDailyStreak
 */
function calculateStreaks(sessions: PracticeSession[]): {
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastPracticeDate?: string;
} {
  if (sessions.length === 0) {
    return { currentDailyStreak: 0, longestDailyStreak: 0 };
  }

  // Extract unique practice dates (YYYY-MM-DD format)
  const practiceDates = new Set<string>();
  for (const session of sessions) {
    const date = new Date(session.startedAt);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    practiceDates.add(dateStr);
  }

  const sortedDates = Array.from(practiceDates).sort().reverse(); // Most recent first
  const lastPracticeDate = sortedDates[0];

  // Calculate current streak (from today backwards)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentStreak = 0;
  let checkDate = new Date(today);

  // Check if today was practiced
  const todayStr = today.toISOString().split('T')[0];
  const hasToday = sortedDates.includes(todayStr);
  
  // If today wasn't practiced, start from yesterday
  if (!hasToday && sortedDates.length > 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // Count consecutive days backwards
  for (const dateStr of sortedDates) {
    const practiceDate = new Date(dateStr + 'T00:00:00');
    const daysDiff = Math.floor(
      (checkDate.getTime() - practiceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // This date matches the expected date
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (daysDiff > 0) {
      // Gap in practice, streak broken
      break;
    }
    // If daysDiff < 0, we've gone past the expected date, continue
  }

  // Calculate longest streak (from sorted dates, oldest to newest)
  const sortedDatesAsc = Array.from(practiceDates).sort(); // Oldest first
  let longestStreak = sortedDatesAsc.length > 0 ? 1 : 0;
  let currentRun = 1;

  for (let i = 1; i < sortedDatesAsc.length; i++) {
    const prevDate = new Date(sortedDatesAsc[i - 1] + 'T00:00:00');
    const currDate = new Date(sortedDatesAsc[i] + 'T00:00:00');
    const daysDiff = Math.floor(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      // Consecutive days
      currentRun++;
      longestStreak = Math.max(longestStreak, currentRun);
    } else {
      // Gap in practice, reset run
      currentRun = 1;
    }
  }

  return {
    currentDailyStreak: currentStreak,
    longestDailyStreak: longestStreak,
    lastPracticeDate,
  };
}

/**
 * Computes global user statistics from all practice data.
 *
 * Aggregates sessions and attempts to compute:
 * - Total practice time and session counts
 * - Attempt counts and unique items practiced
 * - Status distributions (known/learning/review/new)
 * - Rolling averages (7-day and 30-day windows)
 * - Daily streak information
 *
 * @param sessions - Array of practice sessions
 * @param sentenceAttempts - Array of sentence practice attempts
 * @param wordAttempts - Array of word practice attempts
 * @param totalSentencesAvailable - Total sentences in system
 * @param totalWordsAvailable - Total words in system
 * @returns Complete UserGlobalStats object
 */
export function computeUserGlobalStats(
  sessions: PracticeSession[],
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  totalSentencesAvailable: number,
  totalWordsAvailable: number
): UserGlobalStats {
  const userId = sessions[0]?.userId || sentenceAttempts[0]?.userId || wordAttempts[0]?.userId || 'local_user';

  // Basic counts
  const totalPracticeSessions = sessions.length;
  const totalPracticeSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const totalSentenceAttempts = sentenceAttempts.length;
  const totalWordAttempts = wordAttempts.length;

  // Unique items practiced
  const uniqueSentenceIds = new Set(sentenceAttempts.map((a) => a.sentenceId));
  const uniqueWordIds = new Set(wordAttempts.map((a) => a.wordId));
  const sentencesPracticedCount = uniqueSentenceIds.size;
  const wordsPracticedCount = uniqueWordIds.size;

  // Status counts from progress
  const sentenceProgress = buildSentenceProgress(sentenceAttempts, totalSentencesAvailable);
  const wordProgress = buildWordProgress(wordAttempts, totalWordsAvailable);

  // Rolling averages (7-day and 30-day windows)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recent7DayAttempts = [
    ...sentenceAttempts.filter(
      (a) => new Date(a.createdAt).getTime() >= sevenDaysAgo.getTime()
    ),
    ...wordAttempts.filter(
      (a) => new Date(a.createdAt).getTime() >= sevenDaysAgo.getTime()
    ),
  ];

  const recent30DayAttempts = [
    ...sentenceAttempts.filter(
      (a) => new Date(a.createdAt).getTime() >= thirtyDaysAgo.getTime()
    ),
    ...wordAttempts.filter(
      (a) => new Date(a.createdAt).getTime() >= thirtyDaysAgo.getTime()
    ),
  ];

  const rolling7DayAvgOverallScore =
    recent7DayAttempts.length > 0
      ? recent7DayAttempts.reduce((sum, a) => sum + a.overallScore, 0) /
        recent7DayAttempts.length
      : undefined;

  const rolling30DayAvgOverallScore =
    recent30DayAttempts.length > 0
      ? recent30DayAttempts.reduce((sum, a) => sum + a.overallScore, 0) /
        recent30DayAttempts.length
      : undefined;

  // Rolling 7-day practice minutes
  const recent7DaySessions = sessions.filter(
    (s) => new Date(s.startedAt).getTime() >= sevenDaysAgo.getTime()
  );
  const rolling7DayPracticeMinutes =
    recent7DaySessions.length > 0
      ? Math.round(
          recent7DaySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
        )
      : undefined;

  // Streaks
  const streaks = calculateStreaks(sessions);

  // TODO: Implement CEFR estimation heuristic
  // Simple heuristic could be based on:
  // - Total practice time
  // - Average scores
  // - Number of items known
  // - Difficulty distribution
  const estimatedCEFR: UserGlobalStats['estimatedCEFR'] = undefined;

  return {
    userId,
    totalPracticeSessions,
    totalPracticeSeconds,
    totalSentenceAttempts,
    totalWordAttempts,
    totalSentencesAvailable,
    totalWordsAvailable,
    sentencesPracticedCount,
    wordsPracticedCount,
    sentencesKnownCount: sentenceProgress.globalCounts.known,
    sentencesLearningCount: sentenceProgress.globalCounts.learning,
    sentencesReviewCount: sentenceProgress.globalCounts.review,
    sentencesNewCount: sentenceProgress.globalCounts.new,
    wordsKnownCount: wordProgress.globalCounts.known,
    wordsLearningCount: wordProgress.globalCounts.learning,
    wordsReviewCount: wordProgress.globalCounts.review,
    wordsNewCount: wordProgress.globalCounts.new,
    rolling7DayAvgOverallScore,
    rolling30DayAvgOverallScore,
    rolling7DayPracticeMinutes,
    currentDailyStreak: streaks.currentDailyStreak,
    longestDailyStreak: streaks.longestDailyStreak,
    lastPracticeDate: streaks.lastPracticeDate,
    estimatedCEFR,
  };
}

/**
 * Computes statistics grouped by difficulty level.
 *
 * Aggregates attempts by difficulty to show:
 * - Attempt counts per difficulty
 * - Average scores per difficulty
 * - Known items count per difficulty (requires progress data)
 *
 * @param sentenceAttempts - Array of sentence practice attempts
 * @param wordAttempts - Array of word practice attempts
 * @param sentenceProgress - Optional sentence progress map for known counts
 * @param wordProgress - Optional word progress map for known counts
 * @returns Array of DifficultyStats, one per difficulty level (2-4)
 */
export function computeDifficultyStats(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  sentenceProgress?: Record<SentenceId, SentenceProgress>,
  wordProgress?: Record<WordId, WordProgress>
): DifficultyStats[] {
  const userId =
    sentenceAttempts[0]?.userId || wordAttempts[0]?.userId || 'local_user';
  const difficultyMap = new Map<DifficultyLevel, { sentences: SentencePracticeAttempt[]; words: WordPracticeAttempt[] }>();

  // Initialize all difficulty levels (2=Easy, 3=Medium, 4=Hard)
  for (let d = 2; d <= 4; d++) {
    difficultyMap.set(d as DifficultyLevel, { sentences: [], words: [] });
  }

  // Group by difficulty
  for (const attempt of sentenceAttempts) {
    const existing = difficultyMap.get(attempt.difficulty) || { sentences: [], words: [] };
    existing.sentences.push(attempt);
    difficultyMap.set(attempt.difficulty, existing);
  }

  for (const attempt of wordAttempts) {
    const existing = difficultyMap.get(attempt.difficulty) || { sentences: [], words: [] };
    existing.words.push(attempt);
    difficultyMap.set(attempt.difficulty, existing);
  }

  // Build stats for each difficulty
  const stats: DifficultyStats[] = [];

  for (let d = 2; d <= 4; d++) {
    const difficulty = d as DifficultyLevel;
    const { sentences, words } = difficultyMap.get(difficulty) || { sentences: [], words: [] };

    const sentenceAttemptsCount = sentences.length;
    const wordAttemptsCount = words.length;

    // Calculate averages
    const allAttempts = [...sentences, ...words];
    const avgOverallScore =
      allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.overallScore, 0) / allAttempts.length
        : undefined;

    const avgAccuracyScore =
      allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.accuracyScore, 0) / allAttempts.length
        : undefined;

    // Count known items (if progress data provided)
    let sentencesKnownCount = 0;
    let wordsKnownCount = 0;

    if (sentenceProgress) {
      for (const progress of Object.values(sentenceProgress)) {
        if (progress.difficulty === difficulty && progress.status === 'known') {
          sentencesKnownCount++;
        }
      }
    }

    if (wordProgress) {
      for (const progress of Object.values(wordProgress)) {
        if (progress.difficulty === difficulty && progress.status === 'known') {
          wordsKnownCount++;
        }
      }
    }

    stats.push({
      userId,
      difficulty,
      sentenceAttempts: sentenceAttemptsCount,
      wordAttempts: wordAttemptsCount,
      avgOverallScore,
      avgAccuracyScore,
      sentencesKnownCount,
      wordsKnownCount,
    });
  }

  return stats;
}

/**
 * Computes statistics grouped by content category.
 *
 * Similar to computeDifficultyStats but groups by category instead.
 * Shows attempt counts, averages, and known items per category.
 *
 * @param sentenceAttempts - Array of sentence practice attempts
 * @param wordAttempts - Array of word practice attempts
 * @param sentenceProgress - Optional sentence progress map for known counts
 * @param wordProgress - Optional word progress map for known counts
 * @returns Array of CategoryStats, one per unique category
 */
export function computeCategoryStats(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  sentenceProgress?: Record<SentenceId, SentenceProgress>,
  wordProgress?: Record<WordId, WordProgress>
): CategoryStats[] {
  const userId =
    sentenceAttempts[0]?.userId || wordAttempts[0]?.userId || 'local_user';
  const categoryMap = new Map<
    ContentCategory,
    { sentences: SentencePracticeAttempt[]; words: WordPracticeAttempt[] }
  >();

  // Group by category
  for (const attempt of sentenceAttempts) {
    const existing = categoryMap.get(attempt.category) || { sentences: [], words: [] };
    existing.sentences.push(attempt);
    categoryMap.set(attempt.category, existing);
  }

  for (const attempt of wordAttempts) {
    const existing = categoryMap.get(attempt.category) || { sentences: [], words: [] };
    existing.words.push(attempt);
    categoryMap.set(attempt.category, existing);
  }

  // Build stats for each category
  const stats: CategoryStats[] = [];

  for (const [category, { sentences, words }] of categoryMap.entries()) {
    const sentenceAttemptsCount = sentences.length;
    const wordAttemptsCount = words.length;

    // Calculate averages
    const allAttempts = [...sentences, ...words];
    const avgOverallScore =
      allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.overallScore, 0) / allAttempts.length
        : undefined;

    const avgAccuracyScore =
      allAttempts.length > 0
        ? allAttempts.reduce((sum, a) => sum + a.accuracyScore, 0) / allAttempts.length
        : undefined;

    // Count known items (if progress data provided)
    let sentencesKnownCount = 0;
    let wordsKnownCount = 0;

    if (sentenceProgress) {
      for (const progress of Object.values(sentenceProgress)) {
        if (progress.category === category && progress.status === 'known') {
          sentencesKnownCount++;
        }
      }
    }

    if (wordProgress) {
      for (const progress of Object.values(wordProgress)) {
        if (progress.category === category && progress.status === 'known') {
          wordsKnownCount++;
        }
      }
    }

    stats.push({
      userId,
      category,
      sentenceAttempts: sentenceAttemptsCount,
      wordAttempts: wordAttemptsCount,
      avgOverallScore,
      avgAccuracyScore,
      sentencesKnownCount,
      wordsKnownCount,
    });
  }

  return stats;
}

/**
 * Computes statistics aggregated by phoneme.
 *
 * Extracts phoneme-level scores from wordScores (in sentences) and phonemeScores (in words).
 * Aggregates to show:
 * - Total attempts per phoneme
 * - Average and best scores
 * - Last practice date
 * - Weakness label (weak/ok/strong based on average score)
 *
 * @param sentenceAttempts - Array of sentence practice attempts
 * @param wordAttempts - Array of word practice attempts
 * @returns Array of PhonemeStats, one per unique phoneme practiced
 */
export function computePhonemeStats(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[]
): PhonemeStats[] {
  const userId =
    sentenceAttempts[0]?.userId || wordAttempts[0]?.userId || 'local_user';
  const phonemeMap = new Map<
    PhonemeId,
    { scores: number[]; lastPracticedAt?: string }
  >();

  // Extract phoneme scores from sentence attempts (via wordScores)
  for (const attempt of sentenceAttempts) {
    if (attempt.wordScores) {
      for (const wordScore of attempt.wordScores) {
        if (wordScore.phonemeScores) {
          for (const phonemeScore of wordScore.phonemeScores) {
            const existing = phonemeMap.get(phonemeScore.phonemeId) || { scores: [] };
            existing.scores.push(phonemeScore.overallScore);
            if (!existing.lastPracticedAt || attempt.createdAt > existing.lastPracticedAt) {
              existing.lastPracticedAt = attempt.createdAt;
            }
            phonemeMap.set(phonemeScore.phonemeId, existing);
          }
        }
      }
    }
  }

  // Extract phoneme scores from word attempts
  for (const attempt of wordAttempts) {
    if (attempt.phonemeScores) {
      for (const phonemeScore of attempt.phonemeScores) {
        const existing = phonemeMap.get(phonemeScore.phonemeId) || { scores: [] };
        existing.scores.push(phonemeScore.overallScore);
        if (!existing.lastPracticedAt || attempt.createdAt > existing.lastPracticedAt) {
          existing.lastPracticedAt = attempt.createdAt;
        }
        phonemeMap.set(phonemeScore.phonemeId, existing);
      }
    }
  }

  // Build stats for each phoneme
  const stats: PhonemeStats[] = [];

  for (const [phonemeId, { scores, lastPracticedAt }] of phonemeMap.entries()) {
    const attempts = scores.length;
    const avgOverallScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const bestOverallScore = Math.max(...scores);

    // Determine weakness label
    let weaknessLabel: 'weak' | 'ok' | 'strong' | undefined;
    if (avgOverallScore < 60) {
      weaknessLabel = 'weak';
    } else if (avgOverallScore <= 85) {
      weaknessLabel = 'ok';
    } else {
      weaknessLabel = 'strong';
    }

    stats.push({
      userId,
      phonemeId,
      attempts,
      avgOverallScore,
      bestOverallScore,
      lastPracticedAt,
      weaknessLabel,
    });
  }

  return stats;
}

/**
 * Computes UX diagnostic metrics for development analytics.
 *
 * Analyzes user behavior patterns from practice attempts:
 * - Hint usage rates
 * - Audio playback behavior (slowed playback)
 * - Native model listening patterns
 * - Retry behavior
 * - Mode preferences
 *
 * Intended for use in Dev Dashboard to understand user interaction patterns.
 *
 * @param sentenceAttempts - Array of sentence practice attempts
 * @param wordAttempts - Array of word practice attempts
 * @param sessions - Array of practice sessions
 * @returns Object with various UX diagnostic metrics
 */
export function computeUxDiagnostics(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  sessions: PracticeSession[]
): {
  hintsUsedCount: number;
  hintsUsageRate: number;
  slowedPlaybackUsageRate: number;
  averageListensToNativeModel: number;
  averageRetriesPerSentenceAttempt: number;
  averageRetriesPerWordAttempt: number;
  modeDistribution: Record<PracticeSession['mode'], number>;
} {
  const allAttempts = [...sentenceAttempts, ...wordAttempts];
  const totalAttempts = allAttempts.length;

  // Hint usage
  const hintsUsedCount = allAttempts.filter((a) => a.usedHint === true).length;
  const hintsUsageRate = totalAttempts > 0 ? hintsUsedCount / totalAttempts : 0;

  // Slowed playback usage
  const slowedPlaybackCount = allAttempts.filter(
    (a) => a.slowedAudioPlayback === true
  ).length;
  const slowedPlaybackUsageRate =
    totalAttempts > 0 ? slowedPlaybackCount / totalAttempts : 0;

  // Average listens to native model
  const listensToNativeModel = allAttempts
    .map((a) => a.listenedToNativeModelCount || 0)
    .reduce((sum, count) => sum + count, 0);
  const averageListensToNativeModel =
    totalAttempts > 0 ? listensToNativeModel / totalAttempts : 0;

  // Retry patterns
  const sentenceRetries = sentenceAttempts
    .map((a) => a.retriesInThisSession || 0)
    .reduce((sum, r) => sum + r, 0);
  const averageRetriesPerSentenceAttempt =
    sentenceAttempts.length > 0 ? sentenceRetries / sentenceAttempts.length : 0;

  const wordRetries = wordAttempts
    .map((a) => a.retriesInThisSession || 0)
    .reduce((sum, r) => sum + r, 0);
  const averageRetriesPerWordAttempt =
    wordAttempts.length > 0 ? wordRetries / wordAttempts.length : 0;

  // Mode distribution (counts, not percentages)
  const modeDistribution: Record<PracticeSession['mode'], number> = {
    sentences: 0,
    words: 0,
    mixed: 0,
    assessment: 0,
  };

  for (const session of sessions) {
    modeDistribution[session.mode] = (modeDistribution[session.mode] || 0) + 1;
  }

  return {
    hintsUsedCount,
    hintsUsageRate,
    slowedPlaybackUsageRate,
    averageListensToNativeModel,
    averageRetriesPerSentenceAttempt,
    averageRetriesPerWordAttempt,
    modeDistribution,
  };
}

// ---- Review Queue ----

export interface ReviewQueueItem {
  itemId: string;
  itemType: 'sentence' | 'word';
  bestScore: number;
  lastAttemptAt: string;
  attemptCount: number;
  reviewPriority: number;
}

/**
 * Build a review queue from low-score attempts, weighted by recency.
 *
 * Algorithm:
 *  1. Group attempts by item (sentence / word).
 *  2. For each item keep the best score and most recent attempt date.
 *  3. Compute reviewPriority = (1 - bestScore/100) * recencyWeight,
 *     where recencyWeight decays logarithmically over `recencyWeightDays`.
 *  4. Filter to items whose best score < scoreThreshold.
 *  5. Return top `maxItems` sorted by reviewPriority descending.
 */
export function buildReviewQueue(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  options?: {
    maxItems?: number;
    recencyWeightDays?: number;
    scoreThreshold?: number;
  },
): ReviewQueueItem[] {
  const maxItems = options?.maxItems ?? 20;
  const recencyWeightDays = options?.recencyWeightDays ?? 7;
  const scoreThreshold = options?.scoreThreshold ?? 80;

  const now = Date.now();
  const decayMs = recencyWeightDays * 24 * 60 * 60 * 1000;

  // Accumulator keyed by "sentence:<id>" or "word:<id>"
  const items = new Map<
    string,
    { itemId: string; itemType: 'sentence' | 'word'; bestScore: number; lastAttemptAt: number; attemptCount: number }
  >();

  function ingest(
    itemId: string,
    itemType: 'sentence' | 'word',
    score: number,
    createdAt: string,
  ) {
    const key = `${itemType}:${itemId}`;
    const ts = new Date(createdAt).getTime();
    const existing = items.get(key);
    if (existing) {
      existing.bestScore = Math.max(existing.bestScore, score);
      existing.lastAttemptAt = Math.max(existing.lastAttemptAt, ts);
      existing.attemptCount += 1;
    } else {
      items.set(key, { itemId, itemType, bestScore: score, lastAttemptAt: ts, attemptCount: 1 });
    }
  }

  for (const a of sentenceAttempts) {
    ingest(a.sentenceId, 'sentence', a.overallScore, a.createdAt);
  }
  for (const a of wordAttempts) {
    ingest(a.wordId, 'word', a.overallScore, a.createdAt);
  }

  const queue: ReviewQueueItem[] = [];
  for (const item of items.values()) {
    if (item.bestScore >= scoreThreshold) continue;

    const ageFraction = Math.min((now - item.lastAttemptAt) / decayMs, 1);
    // Higher weight for more recent items (1 = just practiced, approaches 0 as age → decayMs)
    const recencyWeight = 1 - ageFraction * 0.5; // range [0.5, 1]
    const scoreFactor = 1 - item.bestScore / 100; // lower score → higher factor
    const reviewPriority = scoreFactor * recencyWeight;

    queue.push({
      itemId: item.itemId,
      itemType: item.itemType,
      bestScore: item.bestScore,
      lastAttemptAt: new Date(item.lastAttemptAt).toISOString(),
      attemptCount: item.attemptCount,
      reviewPriority,
    });
  }

  queue.sort((a, b) => b.reviewPriority - a.reviewPriority);
  return queue.slice(0, maxItems);
}

// ============================================================================
// Progress Analytics: time windows, trends, improvement, insights, recommendations
// ============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

/** All trend metrics, in stable display order. */
export const TREND_METRICS: TrendMetric[] = [
  'overall',
  'accuracy',
  'fluency',
  'completeness',
  'prosody',
];

const WINDOW_DAYS: Record<Exclude<AnalyticsWindow, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

type AnyAttempt = SentencePracticeAttempt | WordPracticeAttempt;

function startOfDayMs(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Filters any list of timestamped items to those within the given analytics window.
 *
 * The cutoff is inclusive (`>=`), matching the rolling-window convention used by
 * computeUserGlobalStats. `now` is injectable for deterministic tests.
 */
export function filterByWindow<T extends { createdAt: string }>(
  items: T[],
  window: AnalyticsWindow,
  now: Date = new Date(),
): T[] {
  if (window === 'all') return items;
  const cutoff = now.getTime() - WINDOW_DAYS[window] * DAY_MS;
  return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
}

/** Extracts a single metric value from an attempt, or undefined when not recorded. */
function metricValue(attempt: AnyAttempt, metric: TrendMetric): number | undefined {
  switch (metric) {
    case 'overall':
      return attempt.overallScore;
    case 'accuracy':
      return attempt.accuracyScore;
    case 'fluency':
      return attempt.fluencyScore;
    case 'completeness':
      // completenessScore is required on sentences, optional on words.
      return (attempt as SentencePracticeAttempt).completenessScore;
    case 'prosody':
      return attempt.prosodyScore;
  }
}

interface BucketSpec {
  bucketCount: number;
  bucketMs: number;
}

/** Resolves bucket sizing for a window. Daily for short windows, weekly/monthly for long. */
function resolveBuckets(
  window: AnalyticsWindow,
  attempts: AnyAttempt[],
  now: Date,
): BucketSpec {
  if (window === '7d') return { bucketCount: 7, bucketMs: DAY_MS };
  if (window === '30d') return { bucketCount: 30, bucketMs: DAY_MS };
  if (window === '90d') return { bucketCount: 13, bucketMs: 7 * DAY_MS };

  // 'all' — size buckets to the span of practice history.
  if (attempts.length === 0) return { bucketCount: 0, bucketMs: DAY_MS };
  const earliest = Math.min(
    ...attempts.map((a) => new Date(a.createdAt).getTime()),
  );
  const endOfToday = startOfDayMs(now) + DAY_MS;
  const spanDays = Math.max(1, Math.ceil((endOfToday - earliest) / DAY_MS));
  if (spanDays <= 14) return { bucketCount: spanDays, bucketMs: DAY_MS };
  const weeks = Math.ceil(spanDays / 7);
  if (weeks <= 26) return { bucketCount: weeks, bucketMs: 7 * DAY_MS };
  const months = Math.ceil(spanDays / 28);
  return { bucketCount: months, bucketMs: 28 * DAY_MS };
}

function formatBucketLabel(startMs: number): string {
  const d = new Date(startMs);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Builds a multi-metric trend series over the given window.
 *
 * Generalizes the rolling-7-day chart logic to all four (+prosody) metrics and to
 * 7/30/90/all windows. Buckets are anchored to the end of the current day and walk
 * backwards. Each bucket collects the raw scores recorded within it per metric;
 * optional metrics (fluency/completeness/prosody) only contribute when present.
 */
export function buildMultiMetricTrend(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  window: AnalyticsWindow,
  now: Date = new Date(),
): TrendPoint[] {
  const all: AnyAttempt[] = [
    ...filterByWindow(sentenceAttempts, window, now),
    ...filterByWindow(wordAttempts, window, now),
  ];

  const { bucketCount, bucketMs } = resolveBuckets(window, all, now);
  if (bucketCount === 0) return [];

  const rangeEnd = startOfDayMs(now) + DAY_MS; // end of today
  const rangeStart = rangeEnd - bucketCount * bucketMs;

  const points: TrendPoint[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = rangeStart + i * bucketMs;
    points.push({
      date: new Date(bucketStart).toISOString().split('T')[0],
      label: formatBucketLabel(bucketStart),
      values: { overall: [], accuracy: [], fluency: [], completeness: [], prosody: [] },
    });
  }

  for (const attempt of all) {
    const ts = new Date(attempt.createdAt).getTime();
    if (ts < rangeStart || ts >= rangeEnd) continue;
    let idx = Math.floor((ts - rangeStart) / bucketMs);
    if (idx < 0) idx = 0;
    if (idx >= bucketCount) idx = bucketCount - 1;
    const bucket = points[idx];
    for (const metric of TREND_METRICS) {
      const v = metricValue(attempt, metric);
      if (typeof v === 'number' && !Number.isNaN(v)) {
        bucket.values[metric].push(v);
      }
    }
  }

  return points;
}

export interface ImprovementOptions {
  /** Minimum number of attempts for an item to qualify (default 4). */
  minAttempts?: number;
  /** Minimum days between first and last attempt (default 0 = no span requirement). */
  minSpanDays?: number;
  /** Max items returned per list (default 6). */
  topN?: number;
  /** Minimum positive delta to be "most improved" (default 2). */
  minDeltaForImproved?: number;
  /** recentAvg below this counts as "needs practice" (default 70). */
  needsPracticeThreshold?: number;
}

interface ScoredEntry {
  score: number;
  createdAt: string;
}

function buildImprovementItem(
  id: string,
  kind: ImprovementItem['kind'],
  entries: ScoredEntry[],
  minAttempts: number,
  minSpanDays: number,
): ImprovementItem | null {
  const n = entries.length;
  if (n < minAttempts) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const firstAt = sorted[0].createdAt;
  const lastAt = sorted[n - 1].createdAt;
  const spanDays =
    (new Date(lastAt).getTime() - new Date(firstAt).getTime()) / DAY_MS;
  if (spanDays < minSpanDays) return null;

  const half = Math.ceil(n / 2);
  const earlyScores = sorted.slice(0, half).map((e) => e.score);
  const recentScores = sorted.slice(n - half).map((e) => e.score);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const earlyAvg = mean(earlyScores);
  const recentAvg = mean(recentScores);

  return {
    id,
    kind,
    label: id,
    earlyAvg,
    recentAvg,
    delta: recentAvg - earlyAvg,
    attempts: n,
    firstPracticedAt: firstAt,
    lastPracticedAt: lastAt,
    scores: sorted.map((e) => e.score),
  };
}

/**
 * Computes "most improved" and "needs more practice" items across words, sentences,
 * and phonemes, comparing the earlier half of attempts to the recent half.
 *
 * A noise guard requires at least `minAttempts` attempts (and optionally a minimum
 * day span); items below threshold appear in neither list.
 */
export function computeImprovement(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  window: AnalyticsWindow,
  options?: ImprovementOptions & { now?: Date },
): { mostImproved: ImprovementItem[]; needsPractice: ImprovementItem[] } {
  const minAttempts = options?.minAttempts ?? 4;
  const minSpanDays = options?.minSpanDays ?? 0;
  const topN = options?.topN ?? 6;
  const minDeltaForImproved = options?.minDeltaForImproved ?? 2;
  const needsPracticeThreshold = options?.needsPracticeThreshold ?? 70;
  const now = options?.now ?? new Date();

  const sentences = filterByWindow(sentenceAttempts, window, now);
  const words = filterByWindow(wordAttempts, window, now);

  // Group scored entries by item.
  const wordEntries = new Map<string, ScoredEntry[]>();
  const sentenceEntries = new Map<string, ScoredEntry[]>();
  const phonemeEntries = new Map<string, ScoredEntry[]>();

  const push = (map: Map<string, ScoredEntry[]>, key: string, entry: ScoredEntry) => {
    const arr = map.get(key);
    if (arr) arr.push(entry);
    else map.set(key, [entry]);
  };

  for (const a of sentences) {
    push(sentenceEntries, a.sentenceId, { score: a.overallScore, createdAt: a.createdAt });
    if (a.wordScores) {
      for (const ws of a.wordScores) {
        if (ws.phonemeScores) {
          for (const ps of ws.phonemeScores) {
            push(phonemeEntries, ps.phonemeId, {
              score: ps.overallScore,
              createdAt: a.createdAt,
            });
          }
        }
      }
    }
  }
  for (const a of words) {
    push(wordEntries, a.wordId, { score: a.overallScore, createdAt: a.createdAt });
    if (a.phonemeScores) {
      for (const ps of a.phonemeScores) {
        push(phonemeEntries, ps.phonemeId, {
          score: ps.overallScore,
          createdAt: a.createdAt,
        });
      }
    }
  }

  const items: ImprovementItem[] = [];
  const collect = (map: Map<string, ScoredEntry[]>, kind: ImprovementItem['kind']) => {
    for (const [id, entries] of map.entries()) {
      const item = buildImprovementItem(id, kind, entries, minAttempts, minSpanDays);
      if (item) items.push(item);
    }
  };
  collect(wordEntries, 'word');
  collect(sentenceEntries, 'sentence');
  collect(phonemeEntries, 'phoneme');

  const mostImproved = items
    .filter((it) => it.delta >= minDeltaForImproved)
    .sort((a, b) => b.delta - a.delta || a.id.localeCompare(b.id))
    .slice(0, topN);

  const needsPractice = items
    .filter((it) => it.recentAvg < needsPracticeThreshold || it.delta <= 0)
    .sort((a, b) => a.recentAvg - b.recentAvg || a.id.localeCompare(b.id))
    .slice(0, topN);

  return { mostImproved, needsPractice };
}

/** Average of a numeric array, or undefined when empty. */
function avg(xs: number[]): number | undefined {
  return xs.length > 0 ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined;
}

/**
 * Generates deterministic, data-grounded insights for the learner.
 *
 * Rules run in a fixed order and each is guarded by a minimum-sample check, so the
 * output is fully deterministic for a given input (no randomness; `now` injectable).
 */
export function generateInsights(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  window: AnalyticsWindow,
  now: Date = new Date(),
): AnalyticsInsight[] {
  const sentences = filterByWindow(sentenceAttempts, window, now);
  const words = filterByWindow(wordAttempts, window, now);
  const insights: AnalyticsInsight[] = [];

  const allOverall = [
    ...sentences.map((a) => a.overallScore),
    ...words.map((a) => a.overallScore),
  ];
  const overallMean = avg(allOverall);
  const MIN_TOTAL = 5;
  if (overallMean === undefined || allOverall.length < MIN_TOTAL) {
    return insights; // Not enough data for trustworthy insights.
  }

  // Rule 1: a phoneme category consistently below the user's overall average.
  const phonemeStats = computePhonemeStats(sentences, words);
  const categoryAgg = new Map<string, { sum: number; count: number }>();
  for (const ps of phonemeStats) {
    const meta = getPhonemeById(ps.phonemeId);
    if (!meta || ps.avgOverallScore === undefined) continue;
    const agg = categoryAgg.get(meta.category) ?? { sum: 0, count: 0 };
    agg.sum += ps.avgOverallScore * ps.attempts;
    agg.count += ps.attempts;
    categoryAgg.set(meta.category, agg);
  }
  const weakestCategory = [...categoryAgg.entries()]
    .filter(([, agg]) => agg.count >= 6)
    .map(([category, agg]) => ({ category, mean: agg.sum / agg.count }))
    .sort((a, b) => a.mean - b.mean || a.category.localeCompare(b.category))[0];
  if (weakestCategory && weakestCategory.mean <= overallMean - 8) {
    insights.push({
      id: 'phoneme-category-below-average',
      severity: 'attention',
      title: `${capitalize(weakestCategory.category)} sounds need attention`,
      detail: `Your ${weakestCategory.category} sounds average ${Math.round(
        weakestCategory.mean,
      )}, below your overall pronunciation average of ${Math.round(overallMean)}.`,
    });
  }

  // Rule 2: short vs long phrases.
  const shortScores: number[] = [];
  const longScores: number[] = [];
  for (const a of sentences) {
    const wordCount = a.wordScores?.length;
    if (!wordCount) continue;
    if (wordCount <= 4) shortScores.push(a.overallScore);
    else if (wordCount >= 8) longScores.push(a.overallScore);
  }
  const shortMean = avg(shortScores);
  const longMean = avg(longScores);
  if (
    shortMean !== undefined &&
    longMean !== undefined &&
    shortScores.length >= 3 &&
    longScores.length >= 3 &&
    shortMean - longMean >= 8
  ) {
    insights.push({
      id: 'short-vs-long-phrases',
      severity: 'neutral',
      title: 'You do better on short phrases',
      detail: `Short phrases average ${Math.round(
        shortMean,
      )} versus ${Math.round(longMean)} on longer ones — extra reps on longer phrases will close the gap.`,
    });
  }

  // Rule 3: scores improve with repeated attempts within the same session.
  const sessionItem = new Map<string, ScoredEntry[]>();
  for (const a of sentences) {
    const key = `${a.sessionId}::s::${a.sentenceId}`;
    const arr = sessionItem.get(key);
    if (arr) arr.push({ score: a.overallScore, createdAt: a.createdAt });
    else sessionItem.set(key, [{ score: a.overallScore, createdAt: a.createdAt }]);
  }
  for (const a of words) {
    const key = `${a.sessionId}::w::${a.wordId}`;
    const arr = sessionItem.get(key);
    if (arr) arr.push({ score: a.overallScore, createdAt: a.createdAt });
    else sessionItem.set(key, [{ score: a.overallScore, createdAt: a.createdAt }]);
  }
  const firstScores: number[] = [];
  const lastScores: number[] = [];
  for (const entries of sessionItem.values()) {
    if (entries.length < 2) continue;
    const sorted = [...entries].sort(
      (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
    );
    firstScores.push(sorted[0].score);
    lastScores.push(sorted[sorted.length - 1].score);
  }
  const firstMean = avg(firstScores);
  const lastMean = avg(lastScores);
  if (
    firstMean !== undefined &&
    lastMean !== undefined &&
    firstScores.length >= 3 &&
    lastMean - firstMean >= 3
  ) {
    insights.push({
      id: 'improves-with-repetition',
      severity: 'positive',
      title: 'Repetition is paying off',
      detail: `When you retry an item in a session, your score rises by about ${Math.round(
        lastMean - firstMean,
      )} points on average — keep using retries.`,
    });
  }

  // Rule 4: difficulty gradient.
  const diffStats = computeDifficultyStats(sentences, words);
  const easy = diffStats.find((d) => d.difficulty === 2);
  const hard = diffStats.find((d) => d.difficulty === 4);
  if (
    easy?.avgOverallScore !== undefined &&
    hard?.avgOverallScore !== undefined &&
    easy.sentenceAttempts + easy.wordAttempts >= 3 &&
    hard.sentenceAttempts + hard.wordAttempts >= 3 &&
    easy.avgOverallScore - hard.avgOverallScore >= 12
  ) {
    insights.push({
      id: 'difficulty-gradient',
      severity: 'neutral',
      title: 'Harder content is challenging you',
      detail: `You average ${Math.round(
        easy.avgOverallScore,
      )} on easy items but ${Math.round(
        hard.avgOverallScore,
      )} on hard ones. That gap is normal — it shows where to push next.`,
    });
  }

  // Rule 5: momentum over the window.
  const trend = buildMultiMetricTrend(sentenceAttempts, wordAttempts, window, now);
  const bucketMeans = trend
    .map((p) => avg(p.values.overall))
    .filter((m): m is number => m !== undefined);
  if (bucketMeans.length >= 4) {
    const third = Math.max(1, Math.floor(bucketMeans.length / 3));
    const firstThird = avg(bucketMeans.slice(0, third)) ?? 0;
    const lastThird = avg(bucketMeans.slice(bucketMeans.length - third)) ?? 0;
    const momentum = lastThird - firstThird;
    if (momentum >= 3) {
      insights.push({
        id: 'momentum-up',
        severity: 'positive',
        title: 'Your scores are trending up',
        detail: `Your overall pronunciation rose about ${Math.round(
          momentum,
        )} points across this period. Keep it going!`,
      });
    } else if (momentum <= -3) {
      insights.push({
        id: 'momentum-down',
        severity: 'attention',
        title: 'Your scores have dipped recently',
        detail: `Your overall pronunciation is down about ${Math.round(
          Math.abs(momentum),
        )} points across this period. A few focused sessions can turn it around.`,
      });
    }
  }

  return insights;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/** Resolves an Azure/dataset phoneme id to its canonical metadata id, for matching. */
function canonicalPhonemeId(id: string): string {
  return getPhonemeById(id)?.id ?? id.trim().toUpperCase();
}

export interface RecommendationOptions {
  /** Max recommendations per kind (default 5). */
  perKind?: number;
}

/**
 * Builds practice recommendations grounded in stored assessment data and real content.
 *
 * Returns a flat list spanning sounds, words, and phrases; every recommendation points
 * to an item that exists in the supplied content (or a practiced item). Reuses
 * computePhonemeStats, buildWordProgress/getWeakWordIds, and buildReviewQueue.
 */
export function buildRecommendations(
  sentenceAttempts: SentencePracticeAttempt[],
  wordAttempts: WordPracticeAttempt[],
  allWords: Word[],
  allSentences: Sentence[],
  options?: RecommendationOptions,
): PracticeRecommendation[] {
  const perKind = options?.perKind ?? 5;
  const recs: PracticeRecommendation[] = [];

  const wordById = new Map(allWords.map((w) => [w.id, w]));
  const sentenceById = new Map(allSentences.map((s) => [s.id, s]));

  // --- Weak sounds ---
  const phonemeStats = computePhonemeStats(sentenceAttempts, wordAttempts);
  const weakPhonemes = phonemeStats
    .filter((p) => p.weaknessLabel === 'weak' && p.avgOverallScore !== undefined)
    .sort((a, b) => (a.avgOverallScore ?? 0) - (b.avgOverallScore ?? 0))
    .slice(0, perKind);
  for (const p of weakPhonemes) {
    recs.push({
      kind: 'phoneme',
      id: p.phonemeId,
      label: getPhonemeById(p.phonemeId)?.ipa ?? p.phonemeId,
      reason: `Averaging ${Math.round(
        p.avgOverallScore ?? 0,
      )}% across ${p.attempts} reps — one of your weakest sounds.`,
      score: 100 - (p.avgOverallScore ?? 0),
      to: '/progress#resources',
    });
  }
  const weakCanonical = new Set(weakPhonemes.map((p) => canonicalPhonemeId(p.phonemeId)));

  // --- Weak words (grounded in practiced content, supplemented by content w/ weak sounds) ---
  const { perWord } = buildWordProgress(wordAttempts, allWords.length || 1);
  const weakWordIds = getWeakWordIds(perWord)
    .map((id) => ({ id, weakness: perWord[id]?.weaknessScore ?? 0 }))
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, perKind);
  for (const { id, weakness } of weakWordIds) {
    const word = wordById.get(id);
    recs.push({
      kind: 'word',
      id,
      label: word?.textPt ?? id,
      reason: `Practiced ${perWord[id]?.attempts ?? 0} times, still below target — worth another round.`,
      score: weakness,
      to: '/?tab=words',
    });
  }
  // Supplement with content words that contain a weak sound, if we have spare slots.
  if (weakWordIds.length < perKind && weakCanonical.size > 0) {
    const taken = new Set(weakWordIds.map((w) => w.id));
    for (const w of allWords) {
      if (recs.filter((r) => r.kind === 'word').length >= perKind) break;
      if (taken.has(w.id)) continue;
      const hasWeak = (w.phonemes ?? []).some((ph) => weakCanonical.has(canonicalPhonemeId(ph)));
      if (!hasWeak) continue;
      const weakSound = (w.phonemes ?? []).find((ph) => weakCanonical.has(canonicalPhonemeId(ph)));
      recs.push({
        kind: 'word',
        id: w.id,
        label: w.textPt,
        reason: `Practises your weak ${getPhonemeById(weakSound ?? '')?.ipa ?? weakSound} sound.`,
        score: 40,
        to: '/?tab=words',
      });
      taken.add(w.id);
    }
  }

  // --- Weak phrases (from review queue, supplemented by content w/ weak sounds) ---
  const lowSentences = buildReviewQueue(sentenceAttempts, [], { maxItems: perKind })
    .filter((q) => q.itemType === 'sentence');
  for (const q of lowSentences) {
    const sentence = sentenceById.get(q.itemId);
    recs.push({
      kind: 'sentence',
      id: q.itemId,
      label: sentence?.textPt ?? q.itemId,
      reason: `Best score ${Math.round(q.bestScore)} — revisit to push it higher.`,
      score: 100 - q.bestScore,
      to: '/',
    });
  }
  if (lowSentences.length < perKind && weakCanonical.size > 0) {
    const taken = new Set(lowSentences.map((q) => q.itemId));
    for (const s of allSentences) {
      if (recs.filter((r) => r.kind === 'sentence').length >= perKind) break;
      if (taken.has(s.id)) continue;
      const hasWeak = (s.phonemes ?? []).some((ph) => weakCanonical.has(canonicalPhonemeId(ph)));
      if (!hasWeak) continue;
      recs.push({
        kind: 'sentence',
        id: s.id,
        label: s.textPt,
        reason: 'Includes sounds you are working on.',
        score: 30,
        to: '/',
      });
      taken.add(s.id);
    }
  }

  return recs;
}

