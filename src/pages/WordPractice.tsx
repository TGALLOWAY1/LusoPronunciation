import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  loadAllWords,
  loadAllCategories,
  filterWordsByCategory,
} from '@/lib/data';
import type { Word, Category, Difficulty } from '@/lib/types';
import { getDifficultyLabel } from '@/utils/difficultyLabels';
import WordStudyCard from '@/components/practice/WordStudyCard';
import WordCard from '@/components/practice/WordCard';
import FilterControls from '@/components/practice/FilterControls';
import ViewModeToggle, { type ViewMode } from '@/components/practice/ViewModeToggle';
import NavigationButtons from '@/components/practice/NavigationButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import { appendWordDrillLog } from '@/utils/drillLog';
import type { WordDrillLogEntry } from '@/types/drill';

const WORDS_PER_PAGE = 20;
const TRANSLATION_TOGGLE_STORAGE_KEY = 'lusopronounce_word_drill_show_translation';

export default function WordPractice() {
  const { startSession, endSession } = usePracticeLogStore();
  const sessionIdRef = useRef<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [displayedCount, setDisplayedCount] = useState(WORDS_PER_PAGE);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [drillIndex, setDrillIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);

  useEffect(() => {
    setLastPracticeMode('word');
  }, []);

  // Start practice session when component mounts
  useEffect(() => {
    const sessionId = startSession('words');
    sessionIdRef.current = sessionId;

    // End session when component unmounts
    return () => {
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [startSession, endSession]);

  // Load translation toggle preference from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(TRANSLATION_TOGGLE_STORAGE_KEY);
      if (stored === 'true') {
        setShowTranslation(true);
      }
    } catch (error) {
      console.warn('Failed to load translation toggle preference:', error);
    }
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

  // Filter words based on selected categories and difficulties
  const filteredWords = useMemo(() => {
    let filtered = words;

    if (selectedCategories.length > 0) {
      filtered = filterWordsByCategory(filtered, selectedCategories);
    }

    if (selectedDifficulties.length > 0) {
      // Filter by multiple specific difficulties
      filtered = filtered.filter(w => selectedDifficulties.includes(w.difficulty));
    }

    return filtered;
  }, [words, selectedCategories, selectedDifficulties]);

  // Get current filter summary labels
  const currentFilterSummary = useMemo(() => {
    let categoryLabel: string;
    if (selectedCategories.length === 0) {
      categoryLabel = 'All categories';
    } else if (selectedCategories.length === 1) {
      const category = categories.find(cat => cat.id === selectedCategories[0]);
      categoryLabel = category?.labelEn || 'All categories';
    } else {
      const categoryNames = selectedCategories
        .map(id => categories.find(cat => cat.id === id)?.labelEn)
        .filter(Boolean) as string[];
      categoryLabel = categoryNames.join(', ');
    }
    
    let difficultyLabel: string;
    if (selectedDifficulties.length === 0) {
      difficultyLabel = 'All difficulties';
    } else if (selectedDifficulties.length === 1) {
      difficultyLabel = getDifficultyLabel(selectedDifficulties[0]) || 'All difficulties';
    } else {
      const difficultyNames = selectedDifficulties
        .map(d => getDifficultyLabel(d))
        .filter(Boolean) as string[];
      difficultyLabel = difficultyNames.join(', ');
    }

    return { categoryLabel, difficultyLabel };
  }, [selectedCategories, selectedDifficulties, categories]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(WORDS_PER_PAGE);
  }, [selectedCategories, selectedDifficulties]);

  // Reset drill index when filters change or view mode changes
  useEffect(() => {
    setDrillIndex(0);
    stopAllAudio();
  }, [selectedCategories, selectedDifficulties, viewMode]);

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

  // Current word in drill mode
  const currentDrillWord = useMemo(() => {
    return filteredWords[drillIndex];
  }, [filteredWords, drillIndex]);

  // Handle translation toggle
  const handleTranslationToggle = useCallback(() => {
    const newValue = !showTranslation;
    setShowTranslation(newValue);
    // Persist preference to localStorage
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TRANSLATION_TOGGLE_STORAGE_KEY, String(newValue));
      }
    } catch (error) {
      console.warn('Failed to save translation toggle preference:', error);
    }
  }, [showTranslation]);

  // Handle "Know it" action in drill mode
  const handleDrillKnowIt = useCallback(() => {
    if (!currentDrillWord) return;

    // Create log entry
    const logEntry: WordDrillLogEntry = {
      id: `${currentDrillWord.id}-${Date.now()}`,
      wordId: currentDrillWord.id,
      wordText: currentDrillWord.textPt,
      translation: currentDrillWord.translationEn,
      known: true,
      timestamp: new Date().toISOString(),
      mode: 'word-drill',
    };

    // Append to log
    appendWordDrillLog(logEntry);

    // Auto-advance to next word
    if (drillIndex < filteredWords.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setDrillIndex(prev => prev + 1);
      }, 300);
    }
  }, [currentDrillWord, drillIndex, filteredWords.length]);

  // Handle "Don't know it" action in drill mode
  const handleDrillDontKnowIt = useCallback(() => {
    if (!currentDrillWord) return;

    // Create log entry
    const logEntry: WordDrillLogEntry = {
      id: `${currentDrillWord.id}-${Date.now()}`,
      wordId: currentDrillWord.id,
      wordText: currentDrillWord.textPt,
      translation: currentDrillWord.translationEn,
      known: false,
      timestamp: new Date().toISOString(),
      mode: 'word-drill',
    };

    // Append to log
    appendWordDrillLog(logEntry);

    // Auto-advance to next word
    if (drillIndex < filteredWords.length - 1) {
      setTimeout(() => {
        stopAllAudio();
        setDrillIndex(prev => prev + 1);
      }, 300);
    }
  }, [currentDrillWord, drillIndex, filteredWords.length]);


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

      {/* Filter controls */}
      <div className="mb-6">
        <FilterControls
          categories={categories}
          selectedCategories={selectedCategories}
          selectedDifficulties={selectedDifficulties}
          onCategoryChange={setSelectedCategories}
          onDifficultyChange={setSelectedDifficulties}
        />
      </div>

      {/* Current filters summary header */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Category: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.categoryLabel}</span>
          {' · '}
          Difficulty: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.difficultyLabel}</span>
        </p>
      </div>

      {/* Results count */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {viewMode === 'list' ? (
          <>
            Showing {displayedWords.length} of {filteredWords.length} words
          </>
        ) : (
          <>
            Word {drillIndex + 1} of {filteredWords.length}
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
            onClick={() => {
              setSelectedCategories([]);
              setSelectedDifficulties([]);
            }}
            className="btn btn-primary btn-sm mt-4"
          >
            Clear filters
          </button>
        </div>
      ) : viewMode === 'drill' ? (
        /* Drill Mode - Single card view with recording/assessment */
        <div className="max-w-2xl mx-auto">
          {/* Translation toggle */}
          <div className="mb-4 flex items-center justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTranslation}
                onChange={handleTranslationToggle}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show translation
              </span>
            </label>
          </div>

          {currentDrillWord && (
            <>
              <WordCard
                word={currentDrillWord}
                sessionId={sessionIdRef.current}
                onKnowIt={handleDrillKnowIt}
                onReviewLater={handleDrillDontKnowIt}
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
        /* List Mode - Grid view (study-only) */
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {displayedWords.map((word) => (
              <WordStudyCard
                key={word.id}
                word={word}
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
