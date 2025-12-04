import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  loadAllWords,
  loadAllCategories,
  filterWordsByCategory,
} from '@/lib/data';
import type { Word, Category, Difficulty, WordProgress, WordId } from '@/lib/types';
import { buildWordProgress, getWeakWordIds } from '@/lib/practiceAnalytics';
import WordStudyCard from '@/components/practice/WordStudyCard';
import WordCard from '@/components/practice/WordCard';
import WordMcqCard from '@/components/practice/WordMcqCard';
import WordListeningMcqCard from '@/components/practice/WordListeningMcqCard';
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
const PRACTICE_MODE_STORAGE_KEY = 'lusopronounce_practice_mode';
const DIRECTION_MODE_STORAGE_KEY = 'lusopronounce_direction_mode';

type PracticeMode = 'pronunciation' | 'text-mcq' | 'listening-mcq';
type DirectionMode = 'pt-to-en' | 'en-to-pt' | 'mixed';

export default function WordPractice() {
  const { startSession, endSession, logWordAttempt, wordAttempts } = usePracticeLogStore();
  const sessionIdRef = useRef<string | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [displayedCount, setDisplayedCount] = useState(WORDS_PER_PAGE);
  const [viewMode, setViewMode] = useState<ViewMode>('drill');
  const [drillIndex, setDrillIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('pronunciation');
  const [directionMode, setDirectionMode] = useState<DirectionMode>('pt-to-en');
  
  // Build word progress from practice attempts (reactive to wordAttempts changes)
  const wordProgress = useMemo(() => {
    if (words.length === 0) return {};
    const { perWord } = buildWordProgress(wordAttempts, words.length);
    return perWord;
  }, [wordAttempts, words.length]);
  
  // Get weak word IDs
  const weakWordIds = useMemo(() => {
    return new Set(getWeakWordIds(wordProgress, 50));
  }, [wordProgress]);

  // Compute global status counts
  const statusCounts = useMemo(() => {
    const counts = {
      new: 0,
      learning: 0,
      review: 0,
      known: 0,
    };
    
    // Count words by status from wordProgress
    Object.values(wordProgress).forEach((progress) => {
      counts[progress.status]++;
    });
    
    // Count "new" words (words not in wordProgress)
    const practicedWordIds = new Set(Object.keys(wordProgress));
    const newCount = words.filter(w => !practicedWordIds.has(w.id)).length;
    counts.new = newCount;
    
    return counts;
  }, [wordProgress, words]);

  useEffect(() => {
    setLastPracticeMode('word');
  }, []);

  // Start practice session when component mounts
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      const sessionId = await startSession('words');
      if (mounted) {
        sessionIdRef.current = sessionId;
      }
    })();

    // End session when component unmounts
    return () => {
      mounted = false;
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current).catch((error) => {
          console.warn('Failed to end session:', error);
        });
        sessionIdRef.current = null;
      }
    };
  }, [startSession, endSession]);

  // Load preferences from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedTranslation = window.localStorage.getItem(TRANSLATION_TOGGLE_STORAGE_KEY);
      if (storedTranslation === 'true') {
        setShowTranslation(true);
      }
      
      const storedPracticeMode = window.localStorage.getItem(PRACTICE_MODE_STORAGE_KEY);
      if (storedPracticeMode && ['pronunciation', 'text-mcq', 'listening-mcq'].includes(storedPracticeMode)) {
        setPracticeMode(storedPracticeMode as PracticeMode);
      }
      
      const storedDirectionMode = window.localStorage.getItem(DIRECTION_MODE_STORAGE_KEY);
      if (storedDirectionMode && ['pt-to-en', 'en-to-pt', 'mixed'].includes(storedDirectionMode)) {
        setDirectionMode(storedDirectionMode as DirectionMode);
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
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

  // Filter words based on selected categories, difficulties, and weak words filter
  const filteredWords = useMemo(() => {
    let filtered = words;

    if (selectedCategories.length > 0) {
      filtered = filterWordsByCategory(filtered, selectedCategories);
    }

    if (selectedDifficulties.length > 0) {
      // Filter by multiple specific difficulties
      filtered = filtered.filter(w => selectedDifficulties.includes(w.difficulty));
    }

    // Apply weak words filter if view mode is 'weak-words'
    if (viewMode === 'weak-words') {
      filtered = filtered.filter(w => weakWordIds.has(w.id));
      
      // Dev feedback: log if weak words set is empty
      if (import.meta.env.DEV && filtered.length === 0) {
        console.warn('Weak words filter is active but no weak words found. Total words:', words.length, 'Weak word IDs:', Array.from(weakWordIds));
      }
    }

    return filtered;
  }, [words, selectedCategories, selectedDifficulties, viewMode, weakWordIds]);

  // Reset displayed count when filters change
  useEffect(() => {
    setDisplayedCount(WORDS_PER_PAGE);
  }, [selectedCategories, selectedDifficulties]);

  // Reset drill index when filters change, view mode changes, or practice mode changes
  useEffect(() => {
    setDrillIndex(0);
    stopAllAudio();
  }, [selectedCategories, selectedDifficulties, viewMode, practiceMode]);
  
  // Determine if we're in a drill-like mode (drill or weak-words)
  const isDrillMode = viewMode === 'drill' || viewMode === 'weak-words';

  // Words to display (pagination)
  const displayedWords = useMemo(() => {
    return filteredWords.slice(0, displayedCount);
  }, [filteredWords, displayedCount]);

  // Debug: verify component is loading with new code
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[WordPractice] Component state:', {
        practiceMode,
        directionMode,
        viewMode,
        wordProgressCount: Object.keys(wordProgress).length,
        weakWordCount: weakWordIds.size,
        filteredWordsCount: filteredWords.length,
      });
    }
  }, [practiceMode, directionMode, viewMode, wordProgress, weakWordIds, filteredWords.length]);

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

  // Handle practice mode change
  const handlePracticeModeChange = useCallback((mode: PracticeMode) => {
    setPracticeMode(mode);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PRACTICE_MODE_STORAGE_KEY, mode);
      }
    } catch (error) {
      console.warn('Failed to save practice mode preference:', error);
    }
  }, []);

  // Handle direction mode change
  const handleDirectionModeChange = useCallback((mode: DirectionMode) => {
    setDirectionMode(mode);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(DIRECTION_MODE_STORAGE_KEY, mode);
      }
    } catch (error) {
      console.warn('Failed to save direction mode preference:', error);
    }
  }, []);

  // Handle "Know it" action in drill mode
  const handleDrillKnowIt = useCallback(() => {
    if (!currentDrillWord) return;

    // Log self-rating attempt
    if (sessionIdRef.current) {
      try {
        logWordAttempt({
          sessionId: sessionIdRef.current,
          wordId: currentDrillWord.id,
          difficulty: currentDrillWord.difficulty,
          category: currentDrillWord.categoryId,
          overallScore: 0, // Neutral value for self-rating
          accuracyScore: 0, // Neutral value for self-rating
          practiceMode: 'self-rating',
          selfRating: 'know',
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to log self-rating attempt:', error);
        }
      }
    }

    // Create log entry (legacy drill log)
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
  }, [currentDrillWord, drillIndex, filteredWords.length, logWordAttempt]);

  // Handle "Don't know it" action in drill mode
  const handleDrillDontKnowIt = useCallback(() => {
    if (!currentDrillWord) return;

    // Log self-rating attempt
    if (sessionIdRef.current) {
      try {
        logWordAttempt({
          sessionId: sessionIdRef.current,
          wordId: currentDrillWord.id,
          difficulty: currentDrillWord.difficulty,
          category: currentDrillWord.categoryId,
          overallScore: 0, // Neutral value for self-rating
          accuracyScore: 0, // Neutral value for self-rating
          practiceMode: 'self-rating',
          selfRating: 'dont_know',
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to log self-rating attempt:', error);
        }
      }
    }

    // Create log entry (legacy drill log)
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
  }, [currentDrillWord, drillIndex, filteredWords.length, logWordAttempt]);


  // Keyboard navigation for drill mode
  useEffect(() => {
    if (!isDrillMode) return;

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
  }, [isDrillMode, drillIndex, filteredWords.length]);

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
        <div className="flex flex-wrap items-center gap-3">
          <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
        </div>
      </div>

      {/* Global status summary */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">Progress: </span>
        <span>New: {statusCounts.new}</span>
        <span className="mx-1">•</span>
        <span>Learning: {statusCounts.learning}</span>
        <span className="mx-1">•</span>
        <span>Review: {statusCounts.review}</span>
        <span className="mx-1">•</span>
        <span>Mastered: {statusCounts.known}</span>
      </div>

      {/* Practice Mode Selector */}
      {isDrillMode && (
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Practice Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePracticeModeChange('pronunciation')}
                  className={`btn btn-sm ${
                    practiceMode === 'pronunciation' 
                      ? 'btn-primary' 
                      : 'btn-outline'
                  }`}
                >
                  Pronunciation
                </button>
                <button
                  onClick={() => handlePracticeModeChange('text-mcq')}
                  className={`btn btn-sm ${
                    practiceMode === 'text-mcq' 
                      ? 'btn-primary' 
                      : 'btn-outline'
                  }`}
                >
                  Text Multiple Choice
                </button>
                <button
                  onClick={() => handlePracticeModeChange('listening-mcq')}
                  className={`btn btn-sm ${
                    practiceMode === 'listening-mcq' 
                      ? 'btn-primary' 
                      : 'btn-outline'
                  }`}
                >
                  Listening Multiple Choice
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Filter controls */}
      <div className="mb-6">
        <FilterControls
          categories={categories}
          selectedCategories={selectedCategories}
          selectedDifficulties={selectedDifficulties}
          onCategoryChange={setSelectedCategories}
          onDifficultyChange={setSelectedDifficulties}
          directionMode={practiceMode === 'text-mcq' || practiceMode === 'listening-mcq' ? directionMode : undefined}
          onDirectionModeChange={handleDirectionModeChange}
        />
      </div>

      {/* Results count - only show for list mode */}
      {viewMode === 'list' && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {displayedWords.length} of {filteredWords.length} words
        </div>
      )}

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
      ) : isDrillMode ? (
        /* Drill Mode or Weak Words Mode - Single card view with recording/assessment */
        <div className="max-w-2xl mx-auto">
          {viewMode === 'weak-words' && (
            <div className="mb-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Focusing on {filteredWords.length} weak word{filteredWords.length !== 1 ? 's' : ''} out of {weakWordIds.size} total
              </p>
            </div>
          )}
          {currentDrillWord && (
            <>
              {practiceMode === 'pronunciation' ? (
                <WordCard
                  word={currentDrillWord}
                  sessionId={sessionIdRef.current}
                  status={wordProgress[currentDrillWord.id]?.status || 'new'}
                  showTranslation={showTranslation}
                  onToggleTranslation={handleTranslationToggle}
                  onKnowIt={handleDrillKnowIt}
                  onReviewLater={handleDrillDontKnowIt}
                />
              ) : practiceMode === 'text-mcq' ? (
                <WordMcqCard
                  word={currentDrillWord}
                  sessionId={sessionIdRef.current}
                  directionMode={directionMode}
                  allWords={filteredWords}
                  status={wordProgress[currentDrillWord.id]?.status || 'new'}
                  onKnowIt={handleDrillKnowIt}
                  onReviewLater={handleDrillDontKnowIt}
                />
              ) : practiceMode === 'listening-mcq' ? (
                <WordListeningMcqCard
                  word={currentDrillWord}
                  sessionId={sessionIdRef.current}
                  directionMode={directionMode}
                  allWords={filteredWords}
                  status={wordProgress[currentDrillWord.id]?.status || 'new'}
                  onAttemptLogged={(attempt) => {
                    // Log the attempt using practiceLogStore
                    // attempt already has sessionId from WordListeningMcqCard
                    logWordAttempt(attempt);
                  }}
                  onKnowIt={handleDrillKnowIt}
                  onReviewLater={handleDrillDontKnowIt}
                />
              ) : (
                <div className="card text-center p-8">
                  <p className="text-gray-600 dark:text-gray-400">
                    Unknown practice mode
                  </p>
                </div>
              )}
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
                status={wordProgress[word.id]?.status || 'new'}
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
