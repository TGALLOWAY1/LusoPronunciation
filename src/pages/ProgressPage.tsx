import { useEffect, useState, useMemo } from 'react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords } from '@/lib/data';
import type { AnalyticsWindow, Sentence, Word } from '@/lib/types';
import {
  computeUserGlobalStats,
  computePhonemeStats,
  buildMultiMetricTrend,
  computeImprovement,
  generateInsights,
  buildRecommendations,
} from '@/lib/practiceAnalytics';
import PageScaffold from '@/components/common/PageScaffold';
import ActionPanel from '@/components/common/ActionPanel';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import AnalyticsTabs from '@/components/analytics/AnalyticsTabs';
import OverviewSection from '@/components/analytics/OverviewSection';
import ProgressTrendSection from '@/components/analytics/ProgressTrendSection';
import StrengthsSection from '@/components/analytics/StrengthsSection';
import FocusAreasSection, {
  type MispronouncedWord,
  type RetriedPhrase,
} from '@/components/analytics/FocusAreasSection';
import RecommendationsSection from '@/components/analytics/RecommendationsSection';
import LearningResourcesSection from '@/components/analytics/LearningResourcesSection';

const SECTION_IDS = [
  'overview',
  'progress',
  'strengths',
  'focus',
  'recommendations',
  'resources',
];

export default function ProgressPage() {
  const { sessions, sentenceAttempts, wordAttempts, storageError } = usePracticeLogStore();
  const { getDueCount } = useProgressStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState<AnalyticsWindow>('30d');

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
      } catch (err) {
        console.error('Error loading progress data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load progress data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Lookup maps for resolving ids to display text.
  const wordLabels = useMemo(
    () => new Map(words.map((w) => [w.id, w.textPt])),
    [words],
  );
  const sentenceLabels = useMemo(
    () => new Map(sentences.map((s) => [s.id, s.textPt])),
    [sentences],
  );

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
    return Math.round(todaySessions.reduce((sum, s) => sum + s.durationSeconds, 0) / 60);
  }, [sessions]);

  // All-time phoneme stats power strengths, focus, recommendations, and resources.
  const phonemeStats = useMemo(
    () => computePhonemeStats(sentenceAttempts, wordAttempts),
    [sentenceAttempts, wordAttempts],
  );

  const weakPhonemes = useMemo(
    () =>
      phonemeStats
        .filter((p) => p.weaknessLabel === 'weak')
        .sort((a, b) => (a.avgOverallScore ?? 0) - (b.avgOverallScore ?? 0))
        .slice(0, 5),
    [phonemeStats],
  );

  const strongPhonemes = useMemo(
    () =>
      phonemeStats
        .filter((p) => p.weaknessLabel === 'strong' && p.attempts >= 2)
        .sort((a, b) => (b.avgOverallScore ?? 0) - (a.avgOverallScore ?? 0))
        .slice(0, 5),
    [phonemeStats],
  );

  const trendData = useMemo(
    () => buildMultiMetricTrend(sentenceAttempts, wordAttempts, window),
    [sentenceAttempts, wordAttempts, window],
  );

  const { mostImproved, needsPractice } = useMemo(
    () => computeImprovement(sentenceAttempts, wordAttempts, window),
    [sentenceAttempts, wordAttempts, window],
  );

  const insights = useMemo(
    () => generateInsights(sentenceAttempts, wordAttempts, window),
    [sentenceAttempts, wordAttempts, window],
  );

  const recommendations = useMemo(() => {
    if (sentences.length === 0 || words.length === 0) return [];
    return buildRecommendations(sentenceAttempts, wordAttempts, words, sentences);
  }, [sentenceAttempts, wordAttempts, words, sentences]);

  // Frequently mispronounced words (from sentence word-level scores).
  const mispronouncedWords = useMemo<MispronouncedWord[]>(() => {
    const counts = new Map<string, number>();
    for (const attempt of sentenceAttempts) {
      for (const ws of attempt.wordScores ?? []) {
        const isWeak = ws.errorType === 'mispronounced' || ws.overallScore < 60;
        if (!isWeak) continue;
        const token = ws.token.trim();
        if (!token) continue;
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([token, count]) => ({ token, count }));
  }, [sentenceAttempts]);

  // Phrases that were repeatedly retried (in-session retries + repeated attempts).
  const retriedPhrases = useMemo<RetriedPhrase[]>(() => {
    const retriesById = new Map<string, number>();
    const attemptsById = new Map<string, number>();
    for (const attempt of sentenceAttempts) {
      retriesById.set(
        attempt.sentenceId,
        (retriesById.get(attempt.sentenceId) ?? 0) + (attempt.retriesInThisSession ?? 0),
      );
      attemptsById.set(
        attempt.sentenceId,
        (attemptsById.get(attempt.sentenceId) ?? 0) + 1,
      );
    }
    return [...attemptsById.keys()]
      .map((id) => ({
        id,
        label: sentenceLabels.get(id) ?? id,
        retries: (retriesById.get(id) ?? 0) + ((attemptsById.get(id) ?? 1) - 1),
      }))
      .filter((p) => p.retries > 0)
      .sort((a, b) => b.retries - a.retries || a.id.localeCompare(b.id))
      .slice(0, 5);
  }, [sentenceAttempts, sentenceLabels]);

  const focusWords = useMemo(
    () =>
      recommendations
        .filter((r) => r.kind === 'word')
        .slice(0, 4)
        .map((r) => ({ textPt: r.label })),
    [recommendations],
  );

  const weakPhonemeIds = useMemo(
    () => weakPhonemes.slice(0, 4).map((p) => p.phonemeId),
    [weakPhonemes],
  );

  const dueCount = getDueCount();
  const totalAttempts = sentenceAttempts.length + wordAttempts.length;
  const hasData = sessions.length > 0 || totalAttempts > 0;

  if (loading) {
    return (
      <PageScaffold title="Progress" subtitle="Your pronunciation analytics at a glance">
        <LoadingSpinner message="Loading progress..." />
      </PageScaffold>
    );
  }

  if (error) {
    return (
      <PageScaffold title="Progress" subtitle="Your pronunciation analytics at a glance">
        <ErrorMessage
          title="Failed to Load Data"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            Promise.all([loadAllSentences(), loadAllWords()])
              .then(([s, w]) => {
                setSentences(s);
                setWords(w);
                setLoading(false);
              })
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
    <PageScaffold title="Progress" subtitle="Am I improving, and what should I practice next?">
      {storageError && (
        <ErrorMessage
          title="Storage Full"
          message="Unable to save progress. Your browser's storage is full."
        />
      )}

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

      {!hasData ? (
        <OverviewSection
          userStats={userStats}
          totalAttempts={totalAttempts}
          todayMinutes={todayMinutes}
          dueCount={dueCount}
          insights={insights}
        />
      ) : (
        <>
          <AnalyticsTabs sections={SECTION_IDS} />
          <OverviewSection
            userStats={userStats}
            totalAttempts={totalAttempts}
            todayMinutes={todayMinutes}
            dueCount={dueCount}
            insights={insights}
          />
          <ProgressTrendSection data={trendData} window={window} onWindowChange={setWindow} />
          <StrengthsSection
            mostImproved={mostImproved}
            strongPhonemes={strongPhonemes}
            wordLabels={wordLabels}
            sentenceLabels={sentenceLabels}
          />
          <FocusAreasSection
            weakPhonemes={weakPhonemes}
            needsPractice={needsPractice}
            mispronouncedWords={mispronouncedWords}
            retriedPhrases={retriedPhrases}
            wordLabels={wordLabels}
            sentenceLabels={sentenceLabels}
          />
          <RecommendationsSection recommendations={recommendations} />
          <LearningResourcesSection
            weakPhonemeIds={weakPhonemeIds}
            focusWords={focusWords}
          />
        </>
      )}
    </PageScaffold>
  );
}
