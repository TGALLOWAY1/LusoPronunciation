import { useEffect, useState, useMemo, useCallback } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { useProgressStore } from '@/state/progressStore';
import {
  loadAllWords,
  loadAllCategories,
  filterWordsByCategory,
} from '@/lib/data';
import type { Word, Category } from '@/lib/types';
import WordCard from '@/components/practice/WordCard';
import CategoryFilterChips from '@/components/practice/CategoryFilterChips';
import ViewModeToggle, { type ViewMode } from '@/components/practice/ViewModeToggle';
import NavigationButtons from '@/components/practice/NavigationButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';
import { stopAllAudio } from '@/hooks/useAudioPlayer';

const WORDS_PER_PAGE = 20;

export default function WordPractice() {
  const { rateWord } = useProgressStore();
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [displayedCount, setDisplayedCount] = useState(WORDS_PER_PAGE);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drillIndex, setDrillIndex] = useState(0);

  useEffect(() => {
    setLastPracticeMode('word');
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [wordsData, categoriesData] = await Promise.all([
          loadAllWords(),
          loadAllCategories(),
        ]);
        setWords(wordsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading word practice data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter words based on selected category
  const filteredWords = useMemo(() => {
    let filtered = words;

    if (selectedCategory) {
      filtered = filterWordsByCategory(filtered, selectedCategory);
    }

    return filtered;
  }, [words, selectedCategory]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(WORDS_PER_PAGE);
  }, [selectedCategory]);

  // Reset drill index when filters change or view mode changes
  useEffect(() => {
    setDrillIndex(0);
    stopAllAudio();
  }, [selectedCategory, viewMode]);

  // Words to display (pagination)
  const displayedWords = useMemo(() => {
    return filteredWords.slice(0, displayedCount);
  }, [filteredWords, displayedCount]);

  const hasMore = useMemo(() => {
    return displayedCount < filteredWords.length;
  }, [displayedCount, filteredWords.length]);

  const handleLoadMore = useCallback(() => {
    setDisplayedCount(prev => prev + WORDS_PER_PAGE);
  }, []);

  const handleKnowIt = useCallback((wordId: string) => {
    rateWord(wordId, 'know');
  }, [rateWord]);

  const handleReviewLater = useCallback((wordId: string) => {
    rateWord(wordId, 'review');
  }, [rateWord]);

  // Drill mode navigation
  const handleDrillPrevious = useCallback(() => {
    if (drillIndex > 0) {
      stopAllAudio();
      setDrillIndex(prev => prev - 1);
    }
  }, [drillIndex]);

  const handleDrillNext = useCallback(() => {
    if (drillIndex < filteredWords.length - 1) {
      stopAllAudio();
      setDrillIndex(prev => prev + 1);
    }
  }, [drillIndex, filteredWords.length]);

  // Auto-advance in drill mode after action
  const handleDrillKnowIt = useCallback((wordId: string) => {
    handleKnowIt(wordId);
    if (drillIndex < filteredWords.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setDrillIndex(prev => prev + 1);
      }, 300);
    }
  }, [handleKnowIt, drillIndex, filteredWords.length]);

  const handleDrillReviewLater = useCallback((wordId: string) => {
    handleReviewLater(wordId);
    if (drillIndex < filteredWords.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setDrillIndex(prev => prev + 1);
      }, 300);
    }
  }, [handleReviewLater, drillIndex, filteredWords.length]);

  // Current word in drill mode
  const currentDrillWord = useMemo(() => {
    return filteredWords[drillIndex];
  }, [filteredWords, drillIndex]);

  // Memoize category label lookup
  const selectedCategoryLabel = useMemo(() => {
    return categories.find(c => c.id === selectedCategory)?.labelEn;
  }, [categories, selectedCategory]);

  // Keyboard navigation for drill mode
  useEffect(() => {
    if (viewMode !== 'drill') return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && drillIndex > 0) {
        stopAllAudio();
        setDrillIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && drillIndex < filteredWords.length - 1) {
        stopAllAudio();
        setDrillIndex(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [viewMode, drillIndex, filteredWords.length]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading words..." />
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Word Practice</h2>
        <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
      </div>

      {/* Category filter chips */}
      <CategoryFilterChips
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {viewMode === 'list' ? (
          <>
            Showing {displayedWords.length} of {filteredWords.length} words
            {selectedCategory && selectedCategoryLabel && (
              <span className="ml-2">
                in <span className="font-medium">{selectedCategoryLabel}</span>
              </span>
            )}
          </>
        ) : (
          <>
            Word {drillIndex + 1} of {filteredWords.length}
            {selectedCategory && selectedCategoryLabel && (
              <span className="ml-2">
                in <span className="font-medium">{selectedCategoryLabel}</span>
              </span>
            )}
          </>
        )}
      </div>

      {/* Content based on view mode */}
      {filteredWords.length === 0 ? (
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No words found matching your filters.
          </p>
          <button
            onClick={() => setSelectedCategory(null)}
            className="btn btn-primary btn-sm mt-4"
          >
            Clear filters
          </button>
        </div>
      ) : viewMode === 'drill' ? (
        /* Drill Mode - Single card view */
        <div className="max-w-2xl mx-auto">
          {currentDrillWord && (
            <>
              <WordCard
                word={currentDrillWord}
                onKnowIt={handleDrillKnowIt}
                onReviewLater={handleDrillReviewLater}
              />
              <NavigationButtons
                onPrevious={handleDrillPrevious}
                onNext={handleDrillNext}
                canGoPrevious={drillIndex > 0}
                canGoNext={drillIndex < filteredWords.length - 1}
              />
            </>
          )}
        </div>
      ) : (
        /* List Mode - Grid view */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {displayedWords.map((word) => (
              <WordCard
                key={word.id}
                word={word}
                onKnowIt={handleKnowIt}
                onReviewLater={handleReviewLater}
              />
            ))}
          </div>

          {/* Load more button */}
          {hasMore && (
            <div className="text-center">
              <button
                onClick={handleLoadMore}
                className="btn btn-primary btn-md"
              >
                Load More ({filteredWords.length - displayedCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </PageTransition>
  );
}
