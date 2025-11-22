import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  loadAllSentences,
  loadAllCategories,
  filterSentencesByCategory,
  filterSentencesByDifficulty,
} from '@/lib/data';
import { preloadAudioIndex } from '@/utils/audioRouting';
import type { Sentence, Category, Difficulty } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import { getDifficultyLabel } from '@/utils/difficultyLabels';
import LivePracticeSection from '@/components/practice/LivePracticeSection';
import ScoringPanel from '@/components/pronunciation/ScoringPanel';
import ScoreHistory from '@/components/practice/ScoreHistory';
import FilterControls from '@/components/practice/FilterControls';
import NavigationButtons from '@/components/practice/NavigationButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';

/**
 * Feat 15: Sentence difficulty ratings ('Easy/Good/Hard') were removed.
 * Progress is tracked by pronunciation attempts and scores instead.
 */
export default function SentencePractice() {
  const { startSession, endSession, getAttemptsBySentenceId } = usePracticeLogStore();
  const sessionIdRef = useRef<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [livePracticeCurrentAttempt, setLivePracticeCurrentAttempt] = useState<AttemptScore | null>(null);
  const [latestRecordingUrlForCurrentSentence, setLatestRecordingUrlForCurrentSentence] = useState<string | null>(null);

  useEffect(() => {
    setLastPracticeMode('sentence');
  }, []);

  // Start practice session when component mounts
  useEffect(() => {
    const sessionId = startSession('sentences');
    sessionIdRef.current = sessionId;

    // End session when component unmounts
    return () => {
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current);
        sessionIdRef.current = null;
      }
    };
  }, [startSession, endSession]);

  useEffect(() => {
    async function loadData() {
      try {
        // Feat 15: Preload audio index for word-by-word audio playback
        await preloadAudioIndex();
        
        const [sentencesData, categoriesData] = await Promise.all([
          loadAllSentences(),
          loadAllCategories(),
        ]);
        setSentences(sentencesData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading sentence practice data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter sentences based on selected categories and difficulties
  const filteredSentences = useMemo(() => {
    let filtered = sentences;

    if (selectedCategories.length > 0) {
      filtered = filterSentencesByCategory(filtered, selectedCategories);
    }

    if (selectedDifficulties.length > 0) {
      // Filter by multiple specific difficulties
      filtered = filtered.filter(s => selectedDifficulties.includes(s.difficulty));
    }

    return filtered;
  }, [sentences, selectedCategories, selectedDifficulties]);

  // Get current filter summary labels (used in both empty and normal states)
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

  // Reset to first sentence when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategories, selectedDifficulties]);

  // Stop any playing audio when sentence changes (e.g., via filter change)
  useEffect(() => {
    stopAllAudio();
  }, [selectedCategories, selectedDifficulties]);

  const currentSentence = useMemo(() => {
    return filteredSentences[currentIndex];
  }, [filteredSentences, currentIndex]);

  // Get attempt history for current sentence
  const sentenceAttempts = useMemo(() => {
    if (!currentSentence) return [];
    return getAttemptsBySentenceId(currentSentence.id);
  }, [currentSentence?.id, getAttemptsBySentenceId]);

  // Reset live practice attempt and recording URL when sentence changes
  useEffect(() => {
    setLivePracticeCurrentAttempt(null);
    setLatestRecordingUrlForCurrentSentence(null);
  }, [currentSentence?.id]);

  // Handle recording URL changes from LivePracticeSection
  const handleRecordingUrlChange = useCallback((url: string | null) => {
    setLatestRecordingUrlForCurrentSentence(url);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopAllAudio();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredSentences.length - 1) {
      stopAllAudio();
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, filteredSentences.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        stopAllAudio();
        setCurrentIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < filteredSentences.length - 1) {
        stopAllAudio();
        setCurrentIndex(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, filteredSentences.length]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading sentences..." />
      </div>
    );
  }

  if (filteredSentences.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Sentence Practice</h2>
        <FilterControls
          categories={categories}
          selectedCategories={selectedCategories}
          selectedDifficulties={selectedDifficulties}
          onCategoryChange={setSelectedCategories}
          onDifficultyChange={setSelectedDifficulties}
        />
        {/* Current filters summary header */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Category: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.categoryLabel}</span>
            {' · '}
            Difficulty: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.difficultyLabel}</span>
          </p>
        </div>
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No sentences found matching your filters.
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
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Sentence Practice</h2>

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

        {/* Main content area - Two column layout */}
        {currentSentence ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Main panel - takes 2 columns */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {currentIndex + 1} of {filteredSentences.length}
                  </span>
                </div>
                <LivePracticeSection
                  sentence={currentSentence}
                  sessionId={sessionIdRef.current}
                  onCurrentAttemptChange={setLivePracticeCurrentAttempt}
                  onRecordingUrlChange={handleRecordingUrlChange}
                />
              </div>
            </div>

            {/* Scoring panel - takes 1 column */}
            <div className="lg:col-span-1 space-y-4">
              <ScoringPanel currentAttempt={livePracticeCurrentAttempt} />
              
              {/* Score History */}
              <ScoreHistory attempts={sentenceAttempts} />
              
              {/* My Latest Recording card */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  My Latest Recording for this Sentence
                </h3>
                {latestRecordingUrlForCurrentSentence ? (
                  <div className="space-y-2">
                    <audio
                      controls
                      src={latestRecordingUrlForCurrentSentence}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      This is your last attempt on this sentence.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      Record this sentence to play back your pronunciation here.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Progress explanation */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Your pronunciation scores and history now track your progress on this sentence.
              </p>
            </div>
          </div>
        ) : null}

        {/* Navigation buttons */}
        {currentSentence && (
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="btn btn-secondary btn-md flex-1 flex items-center justify-center gap-2"
            >
              <span>←</span>
              <span>Previous sentence</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= filteredSentences.length - 1}
              className="btn btn-primary btn-md flex-1 flex items-center justify-center gap-2"
            >
              <span>Next sentence</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
