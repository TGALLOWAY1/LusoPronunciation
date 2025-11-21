import { useMemo } from 'react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  computeUxDiagnostics,
} from '@/lib/practiceAnalytics';
import type { PracticeSession } from '@/lib/types';

export default function DevAnalyticsPage() {
  const { sessions, sentenceAttempts, wordAttempts } = usePracticeLogStore();

  // Compute all analytics
  const analytics = useMemo(() => {
    const uxDiagnostics = computeUxDiagnostics(sentenceAttempts, wordAttempts, sessions);

    return {
      uxDiagnostics,
    };
  }, [sessions, sentenceAttempts, wordAttempts]);

  // Get last N sessions
  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 10);
  }, [sessions]);

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
          {/* Section A: UX Diagnostics */}
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

