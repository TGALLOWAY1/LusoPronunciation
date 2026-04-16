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
import { stopAllAudio } from '@/hooks/useAudioPlayer';

type ReviewTab = 'queue' | 'recent';

export default function Review() {
  const { getDueItems, getDueCount, rateSentence, rateWord, entries } = useProgressStore();
  const { sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<ReviewTab>('queue');

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
  const recentAttempts = useMemo(() => {
    const combined: Array<{
      id: string;
      type: 'sentence' | 'word';
      itemId: string;
      label: string;
      score: number;
      createdAt: string;
    }> = [];

    const sentenceMap = new Map(sentences.map(s => [s.id, s]));
    const wordMap = new Map(words.map(w => [w.id, w]));

    for (const a of sentenceAttempts) {
      const s = sentenceMap.get(a.sentenceId);
      combined.push({
        id: a.attemptId,
        type: 'sentence',
        itemId: a.sentenceId,
        label: s?.textPt ?? a.sentenceId,
        score: a.overallScore,
        createdAt: a.createdAt,
      });
    }

    for (const a of wordAttempts) {
      const w = wordMap.get(a.wordId);
      combined.push({
        id: a.attemptId,
        type: 'word',
        itemId: a.wordId,
        label: w?.textPt ?? a.wordId,
        score: a.overallScore,
        createdAt: a.createdAt,
      });
    }

    return combined
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
  }, [sentenceAttempts, wordAttempts, sentences, words]);

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading review data..." />
      </div>
    );
  }

  const dueCount = getDueCount();

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page header with summary */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Review
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {dueCount > 0
              ? `${dueCount} item${dueCount === 1 ? '' : 's'} need${dueCount === 1 ? 's' : ''} review today`
              : 'All caught up — no items due for review'}
          </p>
        </div>

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
              <div className="card text-center py-10">
                <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">
                  All caught up!
                </p>
                <p className="text-gray-500 dark:text-gray-500 mb-6">
                  No items due for review right now.
                </p>
                <Link to="/" className="btn btn-primary">
                  Practice New Items
                </Link>
              </div>
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
            {recentAttempts.length === 0 ? (
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
              <div className="space-y-2">
                {recentAttempts.map((attempt) => {
                  const scoreColor =
                    attempt.score >= 80
                      ? 'text-green-600 dark:text-green-400'
                      : attempt.score >= 60
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400';

                  return (
                    <div
                      key={attempt.id}
                      className="card flex items-center justify-between gap-4 py-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-block text-xs font-medium px-1.5 py-0.5 rounded ${
                            attempt.type === 'sentence'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }`}>
                            {attempt.type === 'sentence' ? 'Sentence' : 'Word'}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(attempt.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {attempt.label}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-lg font-bold ${scoreColor}`}>
                          {attempt.score}
                        </span>
                        <Link
                          to={attempt.type === 'sentence' ? '/' : '/?tab=words'}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                        >
                          Practice again
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
