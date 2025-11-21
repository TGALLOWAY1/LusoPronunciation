import { useEffect, useState, useMemo } from 'react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { loadAllSentences, loadAllWords, loadAllCategories } from '@/lib/data';
import {
  buildSentenceProgress,
  buildWordProgress,
  computeUserGlobalStats,
  computeDifficultyStats,
  computeCategoryStats,
  computePhonemeStats,
  computeUxDiagnostics,
} from '@/lib/practiceAnalytics';
import SummaryCard from '@/components/dashboard/SummaryCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { PracticeSession } from '@/lib/types';

export default function DevAnalyticsPage() {
  const { sessions, sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const [sentences, setSentences] = useState<any[]>([]);
  const [words, setWords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [sentencesData, wordsData, categoriesData] = await Promise.all([
          loadAllSentences(),
          loadAllWords(),
          loadAllCategories(),
        ]);
        setSentences(sentencesData);
        setWords(wordsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading data for analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
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
    const categoryStats = computeCategoryStats(
      sentenceAttempts,
      wordAttempts,
      sentenceProgress.perSentence,
      wordProgress.perWord
    );
    const phonemeStats = computePhonemeStats(sentenceAttempts, wordAttempts);
    const uxDiagnostics = computeUxDiagnostics(sentenceAttempts, wordAttempts, sessions);

    return {
      sentenceProgress,
      wordProgress,
      userStats,
      difficultyStats,
      categoryStats,
      phonemeStats,
      uxDiagnostics,
    };
  }, [sessions, sentenceAttempts, wordAttempts, sentences.length, words.length, loading]);

  // Get last N sessions
  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);
  }, [sessions]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading analytics..." />
      </div>
    );
  }

  const hasData = sessions.length > 0 || sentenceAttempts.length > 0 || wordAttempts.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6 py-6">
      {/* Dev-only banner */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 rounded">
        <div className="flex items-center gap-2">
          <span className="text-yellow-600 dark:text-yellow-400 font-semibold">⚠️</span>
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
            Dev Analytics – not for end users
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dev Analytics Dashboard</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Internal analytics for practice logs, aggregates, and UX diagnostics
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="card text-center py-12">
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">📊</p>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No practice data yet
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Start practicing sentences or words to see analytics here.
          </p>
        </div>
      ) : (
        <>
          {/* Section A: Global Overview */}
          <section className="card">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Global Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryCard
                title="Total Practice Sessions"
                value={analytics?.userStats.totalPracticeSessions || 0}
                icon="📅"
                description="All time"
              />
              <SummaryCard
                title="Total Practice Time"
                value={`${Math.round((analytics?.userStats.totalPracticeSeconds || 0) / 60)} min`}
                icon="⏱️"
                description="Cumulative"
              />
              <SummaryCard
                title="Sentence Attempts"
                value={analytics?.userStats.totalSentenceAttempts || 0}
                icon="💬"
                description="All time"
              />
              <SummaryCard
                title="Word Attempts"
                value={analytics?.userStats.totalWordAttempts || 0}
                icon="📝"
                description="All time"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <SummaryCard
                title="Current Streak"
                value={analytics?.userStats.currentDailyStreak || 0}
                icon="🔥"
                description="Days in a row"
              />
              <SummaryCard
                title="Longest Streak"
                value={analytics?.userStats.longestDailyStreak || 0}
                icon="⭐"
                description="Best ever"
              />
            </div>
            {analytics?.userStats.rolling7DayAvgOverallScore !== undefined && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">7-Day Avg Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.userStats.rolling7DayAvgOverallScore.toFixed(1)}
                    </p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">30-Day Avg Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.userStats.rolling30DayAvgOverallScore?.toFixed(1) || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section B: Difficulty & Category */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Performance by Difficulty
              </h2>
              {analytics?.difficultyStats && analytics.difficultyStats.length > 0 ? (
                <div className="space-y-3">
                  {analytics.difficultyStats.map((stat) => (
                    <div key={stat.difficulty} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Difficulty {stat.difficulty}
                        </span>
                        <div className="text-right">
                          {stat.avgOverallScore !== undefined ? (
                            <>
                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {stat.avgOverallScore.toFixed(1)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                ({stat.sentenceAttempts + stat.wordAttempts} attempts)
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">No data</span>
                          )}
                        </div>
                      </div>
                      {stat.avgOverallScore !== undefined && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full bg-primary-500 dark:bg-primary-600 transition-all"
                            style={{ width: `${stat.avgOverallScore}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No difficulty data available
                </p>
              )}
            </div>

            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Performance by Category
              </h2>
              {analytics?.categoryStats && analytics.categoryStats.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {analytics.categoryStats
                    .sort((a, b) => (b.avgOverallScore || 0) - (a.avgOverallScore || 0))
                    .map((stat) => {
                      const category = categories.find((c) => c.id === stat.category);
                      return (
                        <div key={stat.category} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {category?.labelEn || stat.category}
                            </span>
                            <div className="text-right">
                              {stat.avgOverallScore !== undefined ? (
                                <>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {stat.avgOverallScore.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                    ({stat.sentenceAttempts + stat.wordAttempts} attempts)
                                  </span>
                                </>
                              ) : (
                                <span className="text-xs text-gray-500 dark:text-gray-400">No data</span>
                              )}
                            </div>
                          </div>
                          {stat.avgOverallScore !== undefined && (
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                              <div
                                className="h-full bg-primary-500 dark:bg-primary-600 transition-all"
                                style={{ width: `${stat.avgOverallScore}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No category data available
                </p>
              )}
            </div>
          </section>

          {/* Section C: Phoneme Weaknesses */}
          <section className="card">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Phoneme Weaknesses
            </h2>
            {analytics?.phonemeStats && analytics.phonemeStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                        Phoneme ID
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                        Attempts
                      </th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                        Avg Score
                      </th>
                      <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.phonemeStats
                      .sort((a, b) => (a.avgOverallScore || 0) - (b.avgOverallScore || 0))
                      .map((stat) => (
                        <tr
                          key={stat.phonemeId}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="py-2 px-3 font-mono text-gray-900 dark:text-gray-100">
                            {stat.phonemeId}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                            {stat.attempts}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {stat.avgOverallScore !== undefined ? (
                              <span
                                className={`font-semibold ${
                                  stat.avgOverallScore >= 85
                                    ? 'text-green-600 dark:text-green-400'
                                    : stat.avgOverallScore >= 60
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {stat.avgOverallScore.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {stat.weaknessLabel && (
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  stat.weaknessLabel === 'strong'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : stat.weaknessLabel === 'ok'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}
                              >
                                {stat.weaknessLabel}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No phoneme data available
              </p>
            )}
          </section>

          {/* Section D: Sentence & Word Coverage */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

          {/* Section E: UX Diagnostics */}
          <section className="card">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              UX Diagnostics
            </h2>
            {analytics?.uxDiagnostics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Hints Used</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.uxDiagnostics.hintsUsedCount}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {((analytics.uxDiagnostics.hintsUsageRate || 0) * 100).toFixed(1)}% usage rate
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Slowed Playback</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {((analytics.uxDiagnostics.slowedPlaybackUsageRate || 0) * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Usage rate</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Native Listens</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.uxDiagnostics.averageListensToNativeModel.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per attempt</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Retries (Sentences)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.uxDiagnostics.averageRetriesPerSentenceAttempt.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per attempt</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Avg Retries (Words)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {analytics.uxDiagnostics.averageRetriesPerWordAttempt.toFixed(1)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Per attempt</p>
                  </div>
                </div>

                {/* Mode Distribution */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                    Mode Distribution
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(analytics.uxDiagnostics.modeDistribution).map(([mode, count]) => (
                      <div key={mode} className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                          {mode}
                        </p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {sessions.length > 0
                            ? `${((count / sessions.length) * 100).toFixed(1)}%`
                            : '0%'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Sessions */}
                {recentSessions.length > 0 && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Recent Sessions
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                              Started
                            </th>
                            <th className="text-left py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                              Mode
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                              Attempts
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                              Avg Score
                            </th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700 dark:text-gray-300">
                              Duration
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentSessions.map((session: PracticeSession) => (
                            <tr
                              key={session.sessionId}
                              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                {new Date(session.startedAt).toLocaleString()}
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200 capitalize">
                                  {session.mode}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                                {session.totalAttempts}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {session.avgOverallScore !== undefined ? (
                                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                                    {session.avgOverallScore.toFixed(1)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300">
                                {Math.round(session.durationSeconds / 60)} min
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No UX diagnostics data available
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

