import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Flame, ClipboardList } from 'lucide-react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords } from '@/lib/data';
import { computeUserGlobalStats, computePhonemeStats } from '@/lib/practiceAnalytics';
import Rolling7DayChart from '@/components/dashboard/Rolling7DayChart';
import PageScaffold from '@/components/common/PageScaffold';
import MetricTile from '@/components/common/MetricTile';
import ActionPanel from '@/components/common/ActionPanel';
import ChartContainer from '@/components/common/ChartContainer';
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

  const weakPhonemes = useMemo(() => {
    if (sentenceAttempts.length === 0 && wordAttempts.length === 0) return [];
    return computePhonemeStats(sentenceAttempts, wordAttempts)
      .filter((p) => p.weaknessLabel === 'weak')
      .sort((a, b) => (a.avgOverallScore ?? 0) - (b.avgOverallScore ?? 0))
      .slice(0, 3);
  }, [sentenceAttempts, wordAttempts]);

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
  const hasChartData = rolling7DayData.some((d) => d.values.length > 0);

  if (loading) {
    return (
      <PageScaffold title="Progress" subtitle="Your pronunciation practice at a glance">
        <LoadingSpinner message="Loading progress..." />
      </PageScaffold>
    );
  }

  if (error) {
    return (
      <PageScaffold title="Progress" subtitle="Your pronunciation practice at a glance">
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
      </PageScaffold>
    );
  }

  return (
    <PageScaffold title="Progress" subtitle="Your pronunciation practice at a glance">
      {storageError && (
        <ErrorMessage
          title="Storage Full"
          message="Unable to save progress. Your browser's storage is full."
        />
      )}

      {/* CTA */}
      <ActionPanel
        heading={hasData ? 'Continue Practicing' : 'Start Practicing'}
        description={
          dueCount > 0
            ? `You have ${dueCount} item${dueCount === 1 ? '' : 's'} due for review.`
            : 'Keep improving your Brazilian Portuguese pronunciation.'
        }
        primaryAction={{ label: 'Go to Practice', to: '/' }}
        secondaryAction={dueCount > 0 ? { label: 'Review Items', to: '/review' } : undefined}
      />

      {/* Hero Metrics */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricTile
            label="Today's Practice"
            value={`${todayMinutes} min`}
            icon={Clock}
            description="Practice time today"
          />
          <MetricTile
            label="Current Streak"
            value={userStats?.currentDailyStreak ?? 0}
            icon={Flame}
            description="Days in a row"
          />
          <MetricTile
            label="Items Due"
            value={dueCount}
            icon={ClipboardList}
            description="Ready for review"
            action={dueCount > 0 ? { label: 'Start review', to: '/review' } : undefined}
          />
        </div>
      )}

      {/* Weekly Trend Chart */}
      {hasData && (
        <ChartContainer
          title="Weekly Trend"
          isEmpty={!hasChartData}
          emptyMessage="Practice some sentences or words to see your weekly trend."
        >
          <Rolling7DayChart title="Overall Score" data={rolling7DayData} />
        </ChartContainer>
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
    </PageScaffold>
  );
}
