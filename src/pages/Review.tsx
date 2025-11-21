import { useEffect, useState, useMemo, useCallback } from 'react';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords } from '@/lib/data';
import type { Sentence, Word } from '@/lib/types';
import SentenceCard from '@/components/practice/SentenceCard';
import WordCard from '@/components/practice/WordCard';
import NavigationButtons from '@/components/practice/NavigationButtons';
import DifficultyButtons, { type DifficultyRating } from '@/components/practice/DifficultyButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';
import { stopAllAudio } from '@/hooks/useAudioPlayer';

export default function Review() {
  const { getDueItems, rateSentence, rateWord, entries } = useProgressStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Get due items (recalculate when entries change)
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

  // Combine all due items
  const allDueItems = useMemo(() => {
    const items: Array<{ type: 'sentence' | 'word'; item: Sentence | Word }> = [];
    dueSentences.forEach(s => items.push({ type: 'sentence', item: s }));
    dueWords.forEach(w => items.push({ type: 'word', item: w }));
    // Shuffle for variety
    return items.sort(() => Math.random() - 0.5);
  }, [dueSentences, dueWords]);

  // Reset index if it's out of bounds (e.g., items were reviewed and removed)
  useEffect(() => {
    if (currentIndex >= allDueItems.length && allDueItems.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, allDueItems.length]);

  const currentItem = useMemo(() => {
    return allDueItems[currentIndex];
  }, [allDueItems, currentIndex]);

  const totalDue = useMemo(() => allDueItems.length, [allDueItems.length]);
  const reviewedCount = currentIndex;


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
      // Auto-advance
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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && currentIndex < allDueItems.length - 1) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, allDueItems.length, handlePrevious, handleNext]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading review queue..." />
      </div>
    );
  }

  if (totalDue === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Review Queue</h2>
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">🎉 All caught up!</p>
          <p className="text-gray-500 dark:text-gray-500">No items due for review right now.</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Review Queue</h2>

      {/* Progress bar */}
      <div className="card mb-6">
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
      </div>
    </PageTransition>
  );
}
