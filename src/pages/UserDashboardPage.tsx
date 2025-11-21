import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { loadAllSentences, loadAllWords, loadAllCategories } from '@/lib/data';
import {
  buildSentenceProgress,
  buildWordProgress,
  computeUserGlobalStats,
  computeDifficultyStats,
  computeCategoryStats,
  computePhonemeStats,
} from '@/lib/practiceAnalytics';
import { getWordStats } from '@/lib/wordStats';
import SummaryCard from '@/components/dashboard/SummaryCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import type { CategoryStats } from '@/lib/types';
import type { Category } from '@/lib/types';

// Chart components (will be created)
import Rolling7DayChart from '@/components/dashboard/Rolling7DayChart';
import CategoryBreakdownTable from '@/components/dashboard/CategoryBreakdownTable';
import PhraseDifficultyPerformancePlot from '@/components/pronunciation/PhraseDifficultyPerformancePlot';
import DifficultyScoreBarChart from '@/components/pronunciation/DifficultyScoreBarChart';
import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import type { DifficultyAverage } from '@/lib/pronunciationAggregationUtils';

export default function UserDashboardPage() {
  const { sessions, sentenceAttempts, wordAttempts, storageError } = usePracticeLogStore();
  const [sentences, setSentences] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDifficultyTab, setActiveDifficultyTab] = useState<'bar' | 'scatter'>('bar');

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const [sentencesData, wordsData, categoriesData] = await Promise.all([
          loadAllSentences(),
          loadAllWords(),
          loadAllCategories(),
        ]);
        setSentences(sentencesData);
        setWords(wordsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        const message = error instanceof Error 
          ? error.message 
          : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Calculate word statistics
  const wordStats = useMemo(() => {
    return getWordStats(words);
  }, [words]);

  // Generate dummy data for Performance by Difficulty chart
  const dummyPhrasesForChart = useMemo(() => {
    const dummyPhrases: PracticePhraseFromFixture[] = [];
    const difficulties = [1, 2, 3, 4, 5];
    
    // Generate 3-5 phrases per difficulty level
    difficulties.forEach((difficulty) => {
      const count = 3 + Math.floor(Math.random() * 3); // 3-5 phrases
      for (let i = 0; i < count; i++) {
        // Generate score that varies by difficulty (higher difficulty = lower average score)
        const baseScore = 100 - (difficulty - 1) * 15;
        const score = Math.max(40, Math.min(100, baseScore + (Math.random() - 0.5) * 20));
        
        dummyPhrases.push({
          id: `dummy_${difficulty}_${i}`,
          text: `Sample phrase ${difficulty}-${i + 1}`,
          difficulty,
          audioUrl: '',
          attempt: {
            attemptId: `dummy_attempt_${difficulty}_${i}`,
            sentenceId: `dummy_sentence_${difficulty}_${i}`,
            overallAccuracy: score,
            fluency: score + (Math.random() - 0.5) * 10,
            completeness: score + (Math.random() - 0.5) * 10,
            prosody: score + (Math.random() - 0.5) * 10,
            wordScores: [],
            createdAt: new Date().toISOString(),
          },
          sentenceAudio: [],
        });
      }
    });
    
    return dummyPhrases;
  }, []);

  // Compute all analytics
  const analytics = useMemo(() => {
    if (loading || sentences.length === 0 || words.length === 0) {
      return null;
    }

    const sentenceProgress = buildSentenceProgress(sentenceAttempts, sentences.length);
    const wordProgress = buildWordProgress(wordAttempts, words.length);
    const userStats = computeUserGlobalStats(
      sessions,
      sentenceAttempts,
      wordAttempts,
      sentences.length,
      words.length
    );
    const difficultyStats = computeDifficultyStats(
      sentenceAttempts,
      wordAttempts,
      sentenceProgress.perSentence,
      wordProgress.perWord
    );
    const categoryStatsFromAttempts = computeCategoryStats(
      sentenceAttempts,
      wordAttempts,
      sentenceProgress.perSentence,
      wordProgress.perWord
    );
    
    // Merge practice stats with all categories from static data
    // This ensures we show all categories even if there's no practice data
    const categoryStatsMap = new Map(categoryStatsFromAttempts.map(stat => [stat.category, stat]));
    const allCategoryStats: CategoryStats[] = categories.map(category => {
      const practiceStats = categoryStatsMap.get(category.id);
      
      if (practiceStats) {
        // Category has practice data
        return practiceStats;
      } else {
        // Category has no practice data, create empty stats
        return {
          userId: 'local_user',
          category: category.id,
          sentenceAttempts: 0,
          wordAttempts: 0,
          avgOverallScore: undefined,
          avgAccuracyScore: undefined,
          sentencesKnownCount: 0,
          wordsKnownCount: 0,
        };
      }
    });
    
    const phonemeStats = computePhonemeStats(sentenceAttempts, wordAttempts);

    return {
      sentenceProgress,
      wordProgress,
      userStats,
      difficultyStats,
      categoryStats: allCategoryStats,
      phonemeStats,
    };
  }, [sessions, sentenceAttempts, wordAttempts, sentences.length, words.length, loading, categories, wordStats]);

  // Convert DifficultyStats to DifficultyAverage format for DifficultyScoreBarChart
  // Include all difficulty levels (1-5) even if they have no data
  const difficultyAveragesForBarChart = useMemo((): DifficultyAverage[] => {
    const allDifficulties: DifficultyAverage[] = [];
    
    // Always show all 5 difficulty levels
    for (let d = 1; d <= 5; d++) {
      const stat = analytics?.difficultyStats?.find(s => s.difficulty === d);
      
      if (stat && stat.avgOverallScore !== undefined && (stat.sentenceAttempts > 0 || stat.wordAttempts > 0)) {
        // Has data
        allDifficulties.push({
          difficulty: d,
          averageScore: stat.avgOverallScore,
          count: stat.sentenceAttempts + stat.wordAttempts,
        });
      } else {
        // No data, but still show the difficulty level with 0
        allDifficulties.push({
          difficulty: d,
          averageScore: 0,
          count: 0,
        });
      }
    }
    
    return allDifficulties;
  }, [analytics?.difficultyStats]);

  // Calculate today's stats
  const todayStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const todaySessions = sessions.filter(s => {
      const sessionDate = new Date(s.startedAt).toISOString().split('T')[0];
      return sessionDate === todayStr;
    });

    const todayAttempts = [
      ...sentenceAttempts.filter(a => {
        const attemptDate = new Date(a.createdAt).toISOString().split('T')[0];
        return attemptDate === todayStr;
      }),
      ...wordAttempts.filter(a => {
        const attemptDate = new Date(a.createdAt).toISOString().split('T')[0];
        return attemptDate === todayStr;
      }),
    ];

    const todayMinutes = Math.round(
      todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60
    );

    return {
      minutes: todayMinutes,
      attempts: todayAttempts.length,
    };
  }, [sessions, sentenceAttempts, wordAttempts]);

  // Get sentences/words needing review
  const itemsNeedingReview = useMemo(() => {
    if (!analytics) return { sentences: [], words: [] };

    const sentencesNeedingReview = Object.values(analytics.sentenceProgress.perSentence)
      .filter(p => p.status === 'review')
      .sort((a, b) => {
        const aDate = a.lastPracticedAt ? new Date(a.lastPracticedAt).getTime() : 0;
        const bDate = b.lastPracticedAt ? new Date(b.lastPracticedAt).getTime() : 0;
        return aDate - bDate;
      })
      .slice(0, 5)
      .map(p => p.sentenceId);

    const wordsNeedingReview = Object.values(analytics.wordProgress.perWord)
      .filter(p => p.status === 'review')
      .sort((a, b) => {
        const aDate = a.lastPracticedAt ? new Date(a.lastPracticedAt).getTime() : 0;
        const bDate = b.lastPracticedAt ? new Date(b.lastPracticedAt).getTime() : 0;
        return aDate - bDate;
      })
      .slice(0, 5)
      .map(p => p.wordId);

    return { sentences: sentencesNeedingReview, words: wordsNeedingReview };
  }, [analytics]);

  // Get weak phonemes (top 3)
  const weakPhonemes = useMemo(() => {
    if (!analytics) return [];
    return [...analytics.phonemeStats]
      .filter(p => p.weaknessLabel === 'weak')
      .sort((a, b) => (a.avgOverallScore || 0) - (b.avgOverallScore || 0))
      .slice(0, 3);
  }, [analytics]);


  // Prepare rolling 7-day data for charts
  const rolling7DayData = useMemo(() => {
    if (!analytics) return null;

    const now = new Date();
    const days: { date: string; overall: number[]; accuracy: number[]; fluency: number[] }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const dayAttempts = [
        ...sentenceAttempts.filter(a => {
          const attemptDate = new Date(a.createdAt).toISOString().split('T')[0];
          return attemptDate === dateStr;
        }),
        ...wordAttempts.filter(a => {
          const attemptDate = new Date(a.createdAt).toISOString().split('T')[0];
          return attemptDate === dateStr;
        }),
      ];

      const overallScores = dayAttempts.map(a => a.overallScore);
      const accuracyScores = dayAttempts.map(a => a.accuracyScore);
      const fluencyScores = dayAttempts
        .filter(a => 'fluencyScore' in a && a.fluencyScore !== undefined)
        .map(a => (a as any).fluencyScore as number);

      days.push({
        date: dateStr,
        overall: overallScores,
        accuracy: accuracyScores,
        fluency: fluencyScores,
      });
    }

    return days;
  }, [analytics, sentenceAttempts, wordAttempts]);

  if (loading) {
    return (
      <div className="w-full px-8">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full px-8">
        <ErrorMessage
          title="Failed to Load Data"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            Promise.all([
              loadAllSentences(),
              loadAllWords(),
              loadAllCategories(),
            ])
              .then(([sentencesData, wordsData, categoriesData]) => {
                setSentences(sentencesData);
                setWords(wordsData);
                setCategories(categoriesData);
                setLoading(false);
              })
              .catch((err) => {
                console.error('Error reloading dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to reload data');
                setLoading(false);
              });
          }}
        />
      </div>
    );
  }

  const hasData = sessions.length > 0 || sentenceAttempts.length > 0 || wordAttempts.length > 0;

  return (
    <div className="w-full px-8 py-6 space-y-8">
      {/* Storage Error Banner */}
      {storageError && (
        <ErrorMessage
          title="Storage Full"
          message="Unable to save progress. Your browser's storage is full. Please free up space to continue saving your progress."
        />
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Dashboard
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Overview of your Portuguese pronunciation practice
        </p>
      </div>

      {!hasData ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📊</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No practice data yet
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Start practicing sentences or words to see your progress here.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/practice/sentence"
              className="btn btn-primary btn-lg"
            >
              Practice Sentences
            </Link>
            <Link
              to="/practice/word"
              className="btn btn-primary btn-lg"
            >
              Practice Words
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Section A: At a Glance */}
          <section className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              At a Glance
            </h2>
            <div className="grid grid-cols-4 gap-3">
              <SummaryCard
                title="Today's Minutes"
                value={todayStats.minutes}
                icon="⏱️"
                description="Practice time today"
              />
              <SummaryCard
                title="Today's Attempts"
                value={todayStats.attempts}
                icon="🎯"
                description="Attempts today"
              />
              <SummaryCard
                title="Current Streak"
                value={analytics?.userStats.currentDailyStreak || 0}
                icon="🔥"
                description="Days in a row"
              />
              <SummaryCard
                title="Lifetime Practice"
                value={`${Math.round((analytics?.userStats.totalPracticeSeconds || 0) / 60)} min`}
                icon="📅"
                description="Total time"
              />
            </div>
          </section>

          {/* Section B: Performance Metrics */}
          <section className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Performance Metrics (Rolling 7-Day)
            </h2>
            {rolling7DayData && (
              <div className="grid grid-cols-3 gap-4">
                <Rolling7DayChart
                  title="Overall Score"
                  data={rolling7DayData.map(d => ({
                    date: d.date,
                    values: d.overall,
                  }))}
                />
                <Rolling7DayChart
                  title="Accuracy"
                  data={rolling7DayData.map(d => ({
                    date: d.date,
                    values: d.accuracy,
                  }))}
                />
                <Rolling7DayChart
                  title="Fluency"
                  data={rolling7DayData.map(d => ({
                    date: d.date,
                    values: d.fluency,
                  }))}
                />
              </div>
            )}
          </section>

          {/* Section B3: Sentence & Word Coverage */}
          <section className="grid grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Sentence Coverage
              </h2>
              {analytics?.sentenceProgress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Practiced</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {analytics.userStats.sentencesPracticedCount} / {sentences.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 dark:bg-primary-600 transition-all"
                      style={{
                        width: `${(analytics.userStats.sentencesPracticedCount / sentences.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Known</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">
                        {analytics.sentenceProgress.globalCounts.known}
                      </p>
                    </div>
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Learning</p>
                      <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {analytics.sentenceProgress.globalCounts.learning}
                      </p>
                    </div>
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Review</p>
                      <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                        {analytics.sentenceProgress.globalCounts.review}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">New</p>
                      <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                        {analytics.sentenceProgress.globalCounts.new}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No sentence progress data
                </p>
              )}
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Word Coverage
              </h2>
              {analytics?.wordProgress ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Practiced</span>
                    <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {analytics.userStats.wordsPracticedCount} / {words.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 dark:bg-primary-600 transition-all"
                      style={{
                        width: `${(analytics.userStats.wordsPracticedCount / words.length) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Known</p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">
                        {analytics.wordProgress.globalCounts.known}
                      </p>
                    </div>
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Learning</p>
                      <p className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
                        {analytics.wordProgress.globalCounts.learning}
                      </p>
                    </div>
                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Review</p>
                      <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                        {analytics.wordProgress.globalCounts.review}
                      </p>
                    </div>
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <p className="text-xs text-gray-600 dark:text-gray-400">New</p>
                      <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                        {analytics.wordProgress.globalCounts.new}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No word progress data
                </p>
              )}
            </div>
          </section>

          {/* Section C: Weaknesses & Recommendations */}
          <section className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Weaknesses & Recommendations
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {/* Weak Phonemes */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Weak Phonemes (Top 3)
                </h3>
                {weakPhonemes.length > 0 ? (
                  <div className="space-y-1.5">
                    {weakPhonemes.map((phoneme) => (
                      <div
                        key={phoneme.phonemeId}
                        className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer group"
                        title={`${phoneme.phonemeId}: ${phoneme.avgOverallScore?.toFixed(1) || 'N/A'} avg score from ${phoneme.attempts} attempts`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-mono text-xs font-medium text-gray-900 dark:text-gray-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                            {phoneme.phonemeId}
                          </span>
                          <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {phoneme.avgOverallScore?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {phoneme.attempts} attempts
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No weak phonemes identified
                  </p>
                )}
              </div>

              {/* Sentences Needing Review */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Sentences Needing Review
                </h3>
                {itemsNeedingReview.sentences.length > 0 ? (
                  <div className="space-y-1.5">
                    {itemsNeedingReview.sentences.slice(0, 5).map((sentenceId) => {
                      const sentence = sentences.find(s => s.id === sentenceId);
                      const progress = analytics?.sentenceProgress.perSentence[sentenceId];
                      return (
                        <div
                          key={sentenceId}
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer group"
                          title={sentence?.translationEn || sentenceId}
                        >
                          <div className="text-xs text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {sentence?.textPt || sentenceId}
                          </div>
                          {progress && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {progress.attempts} attempts, last: {progress.lastPracticedAt ? new Date(progress.lastPracticedAt).toLocaleDateString() : 'never'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No sentences need review
                  </p>
                )}
              </div>

              {/* Words Needing Review */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2">
                  Words Needing Review
                </h3>
                {itemsNeedingReview.words.length > 0 ? (
                  <div className="space-y-1.5">
                    {itemsNeedingReview.words.slice(0, 5).map((wordId) => {
                      const word = words.find(w => w.id === wordId);
                      const progress = analytics?.wordProgress.perWord[wordId];
                      return (
                        <div
                          key={wordId}
                          className="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all cursor-pointer group"
                          title={word?.translationEn || wordId}
                        >
                          <div className="text-xs text-gray-900 dark:text-gray-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {word?.textPt || wordId}
                          </div>
                          {progress && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {progress.attempts} attempts, last: {progress.lastPracticedAt ? new Date(progress.lastPracticedAt).toLocaleDateString() : 'never'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No words need review
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section D: Category Breakdown */}
          <section className="card">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Category Breakdown
            </h2>
            {analytics?.categoryStats && (
              <CategoryBreakdownTable
                data={analytics.categoryStats}
                categories={categories}
                wordStats={wordStats}
              />
            )}
          </section>

          {/* Section E: Difficulty Analysis (Tabbed) */}
          <section className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Difficulty Analysis
              </h2>
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveDifficultyTab('bar')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeDifficultyTab === 'bar'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Bar Chart
              </button>
              <button
                onClick={() => setActiveDifficultyTab('scatter')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeDifficultyTab === 'scatter'
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Scatter Plot
              </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[300px]">
              {activeDifficultyTab === 'bar' ? (
                difficultyAveragesForBarChart.length > 0 ? (
                  <div className="-m-4">
                    <DifficultyScoreBarChart data={difficultyAveragesForBarChart} />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No difficulty data available. Start practicing to see your performance by difficulty level.
                  </p>
                )
              ) : (
                <div className="overflow-hidden">
                  <div style={{ transform: 'scale(0.7)', transformOrigin: 'top left', width: '142.86%' }}>
                    <PhraseDifficultyPerformancePlot
                      phrases={dummyPhrasesForChart}
                      selectedPhraseId={null}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

