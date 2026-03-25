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
} from './types';

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

