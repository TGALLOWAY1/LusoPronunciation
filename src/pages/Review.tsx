import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '@/state/progressStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useDueReviews } from '@/hooks/useDueReviews';
import { reviewFlashcard, type ReviewOutcome } from '@/api/flashcards';
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

/**
 * A single item in the review working queue. `cardId` is the server flashcard
 * id when the queue is sourced from the authoritative server SM-2 queue, or
 * null when we've fallen back to the local (offline) progressStore queue.
 */
interface QueueItem {
  key: string;
  cardId: string | null;
  type: 'sentence' | 'word';
  item: Sentence | Word;
}

export default function Review() {
  const { getDueItems, getDueCount, rateSentence, rateWord, entries } = useProgressStore();
  const { sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const {
    dueCards,
    dueCount: serverDueCount,
    error: dueError,
    initialized: dueInitialized,
    authenticated,
    refresh: refreshDue,
  } = useDueReviews();
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

  // The server SM-2 queue is authoritative whenever we're authenticated and the
  // fetch succeeded. Only when it errors do we fall back to the local queue.
  const useServerQueue = authenticated && !dueError;
  const showLocalFallbackNotice = authenticated && dueError;

  const sentenceById = useMemo(
    () => new Map(sentences.map(s => [s.id, s])),
    [sentences],
  );
  const wordById = useMemo(() => new Map(words.map(w => [w.id, w])), [words]);

  // ----- Server queue (authoritative) -----
  const serverQueue = useMemo<QueueItem[]>(() => {
    if (!useServerQueue) return [];
    const items: QueueItem[] = [];
    for (const card of dueCards) {
      if (card.contentType === 'sentence') {
        const s = sentenceById.get(card.contentId);
        if (s) items.push({ key: card.id, cardId: card.id, type: 'sentence', item: s });
      } else {
        const w = wordById.get(card.contentId);
        if (w) items.push({ key: card.id, cardId: card.id, type: 'word', item: w });
      }
    }
    return items;
  }, [useServerQueue, dueCards, sentenceById, wordById]);

  // ----- Local fallback queue (offline artifact; used only if the server is unreachable) -----
  const localQueue = useMemo<QueueItem[]>(() => {
    const sentenceIds = new Set(getDueItems('sentence').map(e => e.itemId));
    const wordIds = new Set(getDueItems('word').map(e => e.itemId));
    const items: QueueItem[] = [];
    sentences
      .filter(s => sentenceIds.has(s.id))
      .forEach(s => items.push({ key: `sentence:${s.id}`, cardId: null, type: 'sentence', item: s }));
    words
      .filter(w => wordIds.has(w.id))
      .forEach(w => items.push({ key: `word:${w.id}`, cardId: null, type: 'word', item: w }));
    return items.sort(() => Math.random() - 0.5);
    // `entries` is included so the memo recomputes when local ratings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getDueItems, sentences, words, entries]);

  const sourceQueue = useServerQueue ? serverQueue : localQueue;

  // Capture a stable working queue for the session once the source is ready, so
  // grading a card (which removes it from the live due list) doesn't reshuffle
  // the queue under the user's feet. Progress runs cleanly from 0 → N.
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    if (captured || loading) return;
    // For the server queue, wait until the first fetch has resolved so we don't
    // momentarily capture an empty list and flash "all caught up".
    if (useServerQueue && !dueInitialized) return;
    setQueue(sourceQueue);
    setCaptured(true);
  }, [captured, loading, useServerQueue, dueInitialized, sourceQueue]);

  const queueLoading = loading || (useServerQueue && !dueInitialized);

  const currentItem = queue[currentIndex];
  const totalDue = queue.length;
  const reviewedCount = Math.min(currentIndex, totalDue);

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

  // ----- Grading -----
  // The server SM-2 engine is the scheduling authority. When grading a card
  // from the server queue we call reviewFlashcard (which grows/shrinks the
  // interval per SM-2) and refresh the shared due count so badges stay in sync.
  // In local fallback we grade against the offline progressStore scheduler.
  //
  // Grade mapping (Review action → SM-2 ReviewOutcome):
  //   sentence Easy → 'easy', Good → 'good', Hard → 'hard' (1:1 on shared labels)
  //   word "Know it" → 'easy'   (confident: let the interval grow)
  //   word "Review later" → 'again' (unsure: reset to the relearning ladder)
  const gradeServerCard = useCallback(
    async (cardId: string, grade: ReviewOutcome) => {
      try {
        await reviewFlashcard({ cardId, grade });
      } catch (err) {
        console.warn('[Review] Failed to grade flashcard:', err);
      }
      // Keep the shared due count current for the Momentum strip / nudge.
      await refreshDue();
    },
    [refreshDue],
  );

  // ----- Queue navigation handlers -----
  const advance = useCallback(() => {
    setTimeout(() => {
      stopAllAudio();
      setCurrentIndex(prev => prev + 1);
    }, 300);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopAllAudio();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < totalDue - 1) {
      stopAllAudio();
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, totalDue]);

  const handleSentenceRating = useCallback((rating: DifficultyRating) => {
    if (currentItem?.type !== 'sentence') return;
    if (currentItem.cardId) {
      // DifficultyRating ('easy'|'good'|'hard') maps 1:1 onto ReviewOutcome.
      void gradeServerCard(currentItem.cardId, rating);
    } else {
      rateSentence(currentItem.item.id, rating);
    }
    advance();
  }, [currentItem, gradeServerCard, rateSentence, advance]);

  const handleWordKnowIt = useCallback((wordId: string) => {
    if (currentItem?.cardId) {
      void gradeServerCard(currentItem.cardId, 'easy');
    } else {
      rateWord(wordId, 'know');
    }
    advance();
  }, [currentItem, gradeServerCard, rateWord, advance]);

  const handleWordReviewLater = useCallback((wordId: string) => {
    if (currentItem?.cardId) {
      void gradeServerCard(currentItem.cardId, 'again');
    } else {
      rateWord(wordId, 'review');
    }
    advance();
  }, [currentItem, gradeServerCard, rateWord, advance]);

  // Keyboard navigation (queue tab only)
  useEffect(() => {
    if (activeTab !== 'queue') return;
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && currentIndex < totalDue - 1) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [activeTab, currentIndex, totalDue, handlePrevious, handleNext]);

  // Header count: prefer the authoritative server count; fall back to local.
  const dueCount = useServerQueue ? serverDueCount : getDueCount();

  const subtitle = queueLoading
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
            {queueLoading ? (
              <LoadingSpinner message="Loading your review queue..." />
            ) : totalDue === 0 || currentIndex >= totalDue ? (
              <CompletionMoment
                message="All caught up!"
                metric="No items due for review right now."
                action={{ label: 'Practice New Items', to: '/' }}
              />
            ) : (
              <>
                {/* Fallback notice — only when the server queue couldn't be reached */}
                {showLocalFallbackNotice && (
                  <div className="rounded-lg border border-yellow-200 dark:border-yellow-900/50 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
                    Showing your local review queue — we couldn't reach the review
                    server just now. Your progress still saves and syncs later.
                  </div>
                )}

                {/* Honest scheduling note — true only for the server SM-2 queue */}
                {useServerQueue && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Scheduled with SM-2-inspired intervals that grow with each success.
                  </p>
                )}

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
                          canGoNext={currentIndex < totalDue - 1}
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
                          canGoNext={currentIndex < totalDue - 1}
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
