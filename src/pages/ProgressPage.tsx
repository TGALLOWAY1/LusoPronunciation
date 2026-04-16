import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords } from '@/lib/data';
import { computeUserGlobalStats, computePhonemeStats } from '@/lib/practiceAnalytics';
import SummaryCard from '@/components/dashboard/SummaryCard';
import Rolling7DayChart from '@/components/dashboard/Rolling7DayChart';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

export default function ProgressPage() {
  const { sessions, sentenceAttempts, wordAttempts, storageError } = usePracticeLogStore();
  const { getDueCount } = useProgressStore();
  const [sentences, setSentences] = useState<{ id: string }[]>([]);
  const [words, setWords] = useState<{ id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const [sentencesData, wordsData] = await Promise.all([
          loadAllSentences(),
          loadAllWords(),
        ]);
        setSentences(sentencesData);
        setWords(wordsData);
      } catch (error) {
        console.error('Error loading progress data:', error);
        const message = error instanceof Error
          ? error.message
          : 'Failed to load progress data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const userStats = useMemo(() => {
    if (loading || sentences.length === 0 || words.length === 0) return null;
    return computeUserGlobalStats(
      sessions,
      sentenceAttempts,
      wordAttempts,
      sentences.length,
      words.length,
    );
  }, [sessions, sentenceAttempts, wordAttempts, sentences.length, words.length, loading]);

  const todayMinutes = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todaySessions = sessions.filter(
      (s) => new Date(s.startedAt).toISOString().split('T')[0] === todayStr,
    );
    return Math.round(
      todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60,
    );
  }, [sessions]);

  // Weak phonemes (top 3)
  const weakPhonemes = useMemo(() => {
    if (sentenceAttempts.length === 0 && wordAttempts.length === 0) return [];
    return computePhonemeStats(sentenceAttempts, wordAttempts)
      .filter((p) => p.weaknessLabel === 'weak')
      .sort((a, b) => (a.avgOverallScore ?? 0) - (b.avgOverallScore ?? 0))
      .slice(0, 3);
  }, [sentenceAttempts, wordAttempts]);

  // Rolling 7-day overall score data
  const rolling7DayData = useMemo(() => {
    const now = new Date();
    const days: Array<{ date: string; values: number[] }> = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const dateStr = date.toISOString().split('T')[0];

      const dayScores = [
        ...sentenceAttempts.filter(
          (a) => new Date(a.createdAt).toISOString().split('T')[0] === dateStr,
        ),
        ...wordAttempts.filter(
          (a) => new Date(a.createdAt).toISOString().split('T')[0] === dateStr,
        ),
      ].map((a) => a.overallScore);

      days.push({ date: dateStr, values: dayScores });
    }
    return days;
  }, [sentenceAttempts, wordAttempts]);

  const dueCount = getDueCount();
  const hasData = sessions.length > 0 || sentenceAttempts.length > 0 || wordAttempts.length > 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading progress..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <ErrorMessage
          title="Failed to Load Data"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            Promise.all([loadAllSentences(), loadAllWords()])
              .then(([s, w]) => { setSentences(s); setWords(w); setLoading(false); })
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to reload data');
                setLoading(false);
              });
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {storageError && (
        <ErrorMessage
          title="Storage Full"
          message="Unable to save progress. Your browser's storage is full."
        />
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          Progress
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your pronunciation practice at a glance
        </p>
      </div>

      {/* CTA Block */}
      <Link
        to="/"
        className="block bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        <div className="flex items-center justify-between gap-4 mb-2">
          <h3 className="text-xl font-bold">
            {hasData ? 'Continue Practicing' : 'Start Practicing'}
          </h3>
          <span className="text-3xl">&#9654;</span>
        </div>
        <p className="text-primary-50">
          {dueCount > 0
            ? `You have ${dueCount} item${dueCount === 1 ? '' : 's'} due for review.`
            : 'Keep improving your Brazilian Portuguese pronunciation.'}
        </p>
      </Link>

      {/* Hero Metrics */}
      {hasData && (
        <section className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            At a Glance
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              title="Today's Practice"
              value={`${todayMinutes} min`}
              icon="&#9201;"
              description="Practice time today"
            />
            <SummaryCard
              title="Current Streak"
              value={userStats?.currentDailyStreak ?? 0}
              icon="&#128293;"
              description="Days in a row"
            />
            <SummaryCard
              title="Items Due"
              value={dueCount}
              icon="&#128221;"
              description="Ready for review"
            />
          </div>
        </section>
      )}

      {/* Weekly Trend Chart */}
      {hasData && (
        <section className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Weekly Trend
          </h2>
          <Rolling7DayChart title="Overall Score" data={rolling7DayData} />
        </section>
      )}

      {/* Weak Phonemes */}
      {weakPhonemes.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Areas to Improve
            </h2>
            <Link to="/review" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
              Review weak items
            </Link>
          </div>
          <div className="space-y-2">
            {weakPhonemes.map((phoneme) => (
              <div
                key={phoneme.phonemeId}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div>
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                    {phoneme.phonemeId}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    {phoneme.attempts} attempts
                  </span>
                </div>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {phoneme.avgOverallScore?.toFixed(0) ?? 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
