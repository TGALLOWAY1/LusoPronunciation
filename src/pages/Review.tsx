import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '@/state/progressStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { loadAllSentences, loadAllWords } from '@/lib/data';
import type { Sentence, Word } from '@/lib/types';
import SentenceCard from '@/components/practice/SentenceCard';
import WordCard from '@/components/practice/WordCard';
import NavigationButtons from '@/components/practice/NavigationButtons';
import DifficultyButtons, { type DifficultyRating } from '@/components/practice/DifficultyButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';
import PageScaffold from '@/components/common/PageScaffold';
import CompletionMoment from '@/components/common/CompletionMoment';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import { buildAttemptSummaries } from '@/lib/practiceAnalytics';

type ReviewTab = 'queue' | 'recent';
type RecentFilter = 'all' | 'word' | 'sentence';
type RecentSort = 'recent' | 'needs-work' | 'most-practiced';

const STATUS_META: Record<
  'review' | 'learning' | 'known',
  { label: string; className: string }
> = {
  known: {
    label: 'Strong',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  },
  learning: {
    label: 'Learning',
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  },
  review: {
    label: 'Needs work',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  },
};

function scoreColorClass(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Minimal inline SVG sparkline of an item's score history (oldest → newest). */
function MiniSparkline({
  scores,
  width = 72,
  height = 24,
}: {
  scores: number[];
  width?: number;
  height?: number;
}) {
  if (scores.length < 2) return null;
  const pad = 3;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * innerW;
    const y = pad + innerH - ((s - min) / range) * innerH;
    return { x, y };
  });
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  return (
    <svg
      width={width}
      height={height}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-500 dark:text-primary-400"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r="2"
        className="fill-primary-500 dark:fill-primary-400"
      />
    </svg>
  );
}

export default function Review() {
  const { getDueItems, getDueCount, rateSentence, rateWord, entries } = useProgressStore();
  const { sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ReviewTab>('queue');
  const [recentFilter, setRecentFilter] = useState<RecentFilter>('all');
  const [recentSort, setRecentSort] = useState<RecentSort>('recent');

  useEffect(() => {
    async function loadData() {
      try {
        const [sentencesData, wordsData] = await Promise.all([
          loadAllSentences(),
          loadAllWords(),
        ]);
        setSentences(sentencesData);
        setWords(wordsData);
      } catch (error) {
        console.error('Error loading review data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // ----- Queue tab data -----
  const dueSentences = useMemo(() => {
    const dueEntries = getDueItems('sentence');
    const sentenceIds = new Set(dueEntries.map(e => e.itemId));
    return sentences.filter(s => sentenceIds.has(s.id));
  }, [getDueItems, sentences, entries]);

  const dueWords = useMemo(() => {
    const dueEntries = getDueItems('word');
    const wordIds = new Set(dueEntries.map(e => e.itemId));
    return words.filter(w => wordIds.has(w.id));
  }, [getDueItems, words, entries]);

  const allDueItems = useMemo(() => {
    const items: Array<{ type: 'sentence' | 'word'; item: Sentence | Word }> = [];
    dueSentences.forEach(s => items.push({ type: 'sentence', item: s }));
    dueWords.forEach(w => items.push({ type: 'word', item: w }));
    return items.sort(() => Math.random() - 0.5);
  }, [dueSentences, dueWords]);

  useEffect(() => {
    if (currentIndex >= allDueItems.length && allDueItems.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, allDueItems.length]);

  const currentItem = allDueItems[currentIndex];
  const totalDue = allDueItems.length;
  const reviewedCount = currentIndex;

  // ----- Recent attempts tab data -----
  // Consolidate the flat attempt log into one summary per unique item, with a
  // resolved display label from the loaded content.
  const attemptSummaries = useMemo(() => {
    const sentenceMap = new Map(sentences.map(s => [s.id, s]));
    const wordMap = new Map(words.map(w => [w.id, w]));
    return buildAttemptSummaries(sentenceAttempts, wordAttempts).map(summary => ({
      ...summary,
      label:
        summary.itemType === 'sentence'
          ? sentenceMap.get(summary.itemId)?.textPt ?? summary.itemId
          : wordMap.get(summary.itemId)?.textPt ?? summary.itemId,
    }));
  }, [sentenceAttempts, wordAttempts, sentences, words]);

  const totalAttemptCount = sentenceAttempts.length + wordAttempts.length;

  const overallAvgScore = useMemo(() => {
    const all = [...sentenceAttempts, ...wordAttempts];
    if (all.length === 0) return 0;
    return all.reduce((sum, a) => sum + a.overallScore, 0) / all.length;
  }, [sentenceAttempts, wordAttempts]);

  const visibleSummaries = useMemo(() => {
    const filtered =
      recentFilter === 'all'
        ? attemptSummaries
        : attemptSummaries.filter(s => s.itemType === recentFilter);
    const sorted = [...filtered];
    if (recentSort === 'needs-work') {
      sorted.sort((a, b) => a.avgScore - b.avgScore);
    } else if (recentSort === 'most-practiced') {
      sorted.sort((a, b) => b.attempts - a.attempts);
    }
    // 'recent' preserves buildAttemptSummaries' last-practiced-descending order.
    return sorted;
  }, [attemptSummaries, recentFilter, recentSort]);

  // ----- Queue navigation handlers -----
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopAllAudio();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < allDueItems.length - 1) {
      stopAllAudio();
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, allDueItems.length]);

  const handleSentenceRating = useCallback((rating: DifficultyRating) => {
    if (currentItem?.type === 'sentence') {
      rateSentence(currentItem.item.id, rating);
      if (currentIndex < allDueItems.length - 1) {
        setTimeout(() => {
          stopAllAudio();
          setCurrentIndex(prev => prev + 1);
        }, 300);
      }
    }
  }, [currentItem, currentIndex, allDueItems, rateSentence]);

  const handleWordKnowIt = useCallback((wordId: string) => {
    rateWord(wordId, 'know');
    if (currentIndex < allDueItems.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setCurrentIndex(prev => prev + 1);
      }, 300);
    }
  }, [currentIndex, allDueItems.length, rateWord]);

  const handleWordReviewLater = useCallback((wordId: string) => {
    rateWord(wordId, 'review');
    if (currentIndex < allDueItems.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setCurrentIndex(prev => prev + 1);
      }, 300);
    }
  }, [currentIndex, allDueItems.length, rateWord]);

  // Keyboard navigation (queue tab only)
  useEffect(() => {
    if (activeTab !== 'queue') return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && currentIndex < allDueItems.length - 1) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, currentIndex, allDueItems.length, handlePrevious, handleNext]);

  const dueCount = getDueCount();

  const subtitle = loading
    ? 'Loading...'
    : dueCount > 0
      ? `${dueCount} item${dueCount === 1 ? '' : 's'} need${dueCount === 1 ? 's' : ''} review today`
      : 'All caught up — no items due for review';

  if (loading) {
    return (
      <PageScaffold title="Review" subtitle={subtitle}>
        <LoadingSpinner message="Loading review data..." />
      </PageScaffold>
    );
  }

  return (
    <PageTransition>
      <PageScaffold title="Review" subtitle={subtitle}>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'queue'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Review Queue
            {dueCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                {dueCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'recent'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Recent Attempts
          </button>
        </div>

        {/* Queue tab */}
        {activeTab === 'queue' && (
          <>
            {totalDue === 0 ? (
              <CompletionMoment
                message="All caught up!"
                metric="No items due for review right now."
                action={{ label: 'Practice New Items', to: '/' }}
              />
            ) : (
              <>
                {/* Progress bar */}
                <div className="card">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Progress: {reviewedCount} / {totalDue} reviewed
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {Math.round((reviewedCount / totalDue) * 100)}%
                    </span>
                  </div>
                  <div className="progress-bar h-3">
                    <div
                      className="progress-fill h-3"
                      style={{ width: `${(reviewedCount / totalDue) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current item */}
                {currentItem && (
                  <>
                    {currentItem.type === 'sentence' ? (
                      <>
                        <SentenceCard
                          sentence={currentItem.item as Sentence}
                          currentIndex={currentIndex}
                          totalCount={totalDue}
                          sessionId={null}
                        />
                        <NavigationButtons
                          onPrevious={handlePrevious}
                          onNext={handleNext}
                          canGoPrevious={currentIndex > 0}
                          canGoNext={currentIndex < allDueItems.length - 1}
                        />
                        <DifficultyButtons onSelect={handleSentenceRating} />
                      </>
                    ) : (
                      <>
                        <WordCard
                          word={currentItem.item as Word}
                          sessionId={null}
                          onKnowIt={handleWordKnowIt}
                          onReviewLater={handleWordReviewLater}
                        />
                        <NavigationButtons
                          onPrevious={handlePrevious}
                          onNext={handleNext}
                          canGoPrevious={currentIndex > 0}
                          canGoNext={currentIndex < allDueItems.length - 1}
                        />
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Recent Attempts tab */}
        {activeTab === 'recent' && (
          <>
            {attemptSummaries.length === 0 ? (
              <div className="card text-center py-10">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  No attempts yet
                </p>
                <p className="text-gray-500 dark:text-gray-500 mb-6">
                  Practice some sentences or words to see your history here.
                </p>
                <Link to="/" className="btn btn-primary">
                  Start Practicing
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Items practiced', value: attemptSummaries.length },
                    { label: 'Total attempts', value: totalAttemptCount },
                    { label: 'Avg score', value: Math.round(overallAvgScore) },
                  ].map((stat) => (
                    <div key={stat.label} className="card card-compact text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {stat.value}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Filter + sort controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-2" role="group" aria-label="Filter by type">
                    {([
                      { key: 'all', label: 'All' },
                      { key: 'word', label: 'Words' },
                      { key: 'sentence', label: 'Sentences' },
                    ] as const).map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setRecentFilter(option.key)}
                        aria-pressed={recentFilter === option.key}
                        className={`chip ${
                          recentFilter === option.key ? 'chip-active' : 'chip-inactive'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="shrink-0">Sort by</span>
                    <select
                      value={recentSort}
                      onChange={(e) => setRecentSort(e.target.value as RecentSort)}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="recent">Most recent</option>
                      <option value="needs-work">Needs work</option>
                      <option value="most-practiced">Most practiced</option>
                    </select>
                  </label>
                </div>

                {/* Consolidated item list */}
                {visibleSummaries.length === 0 ? (
                  <div className="card text-center py-8 text-gray-500 dark:text-gray-400">
                    No {recentFilter === 'word' ? 'words' : 'sentences'} practiced yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleSummaries.map((summary) => {
                      const status = STATUS_META[summary.status];
                      const delta =
                        summary.previousScore !== undefined
                          ? Math.round(summary.latestScore - summary.previousScore)
                          : undefined;
                      return (
                        <div
                          key={`${summary.itemType}:${summary.itemId}`}
                          className="card card-hover py-3"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                                    summary.itemType === 'sentence'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                  }`}
                                >
                                  {summary.itemType === 'sentence' ? 'Sentence' : 'Word'}
                                </span>
                                <span
                                  className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${status.className}`}
                                >
                                  {status.label}
                                </span>
                              </div>
                              <p className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                                {summary.label}
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <div className="flex items-baseline gap-1.5">
                                <span
                                  className={`text-2xl font-bold ${scoreColorClass(
                                    summary.latestScore,
                                  )}`}
                                >
                                  {Math.round(summary.latestScore)}
                                </span>
                                {delta !== undefined && delta !== 0 && (
                                  <span
                                    className={`text-xs font-semibold ${
                                      delta > 0
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}
                                    aria-label={`${
                                      delta > 0 ? 'up' : 'down'
                                    } ${Math.abs(delta)} from previous attempt`}
                                  >
                                    {delta > 0 ? '▲' : '▼'}
                                    {Math.abs(delta)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                                latest score
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 text-xs text-gray-500 dark:text-gray-400">
                              <MiniSparkline scores={summary.scores} />
                              <span className="truncate">
                                {summary.attempts} attempt
                                {summary.attempts === 1 ? '' : 's'} · best{' '}
                                {Math.round(summary.bestScore)} · avg{' '}
                                {Math.round(summary.avgScore)} ·{' '}
                                {formatRelativeTime(summary.lastPracticedAt)}
                              </span>
                            </div>
                            <Link
                              to={summary.itemType === 'sentence' ? '/' : '/?tab=words'}
                              className="shrink-0 inline-flex items-center gap-0.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                            >
                              Practice again
                              <span aria-hidden="true">›</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </PageScaffold>
    </PageTransition>
  );
}
