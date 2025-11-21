import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { useProgressStore } from '@/state/progressStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  loadAllSentences,
  loadAllCategories,
  filterSentencesByCategory,
  filterSentencesByDifficulty,
} from '@/lib/data';
import type { Sentence, Category, Difficulty } from '@/lib/types';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import SentenceCard from '@/components/practice/SentenceCard';
import FilterControls from '@/components/practice/FilterControls';
import NavigationButtons from '@/components/practice/NavigationButtons';
import DifficultyButtons, { type DifficultyRating } from '@/components/practice/DifficultyButtons';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';

export default function SentencePractice() {
  const { rateSentence } = useProgressStore();
  const { startSession, endSession } = usePracticeLogStore();
  const sessionIdRef = useRef<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Filter sentences based on selected category and difficulty
  const filteredSentences = useMemo(() => {
    let filtered = sentences;

    if (selectedCategory) {
      filtered = filterSentencesByCategory(filtered, selectedCategory);
    }

    if (selectedDifficulty) {
      filtered = filterSentencesByDifficulty(filtered, selectedDifficulty, selectedDifficulty);
    }

    return filtered;
  }, [sentences, selectedCategory, selectedDifficulty]);

  // Reset to first sentence when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategory, selectedDifficulty]);

  // Stop any playing audio when sentence changes (e.g., via filter change)
  useEffect(() => {
    stopAllAudio();
  }, [selectedCategory, selectedDifficulty]);

  const currentSentence = useMemo(() => {
    return filteredSentences[currentIndex];
  }, [filteredSentences, currentIndex]);

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

  const handleDifficultySelect = useCallback((rating: DifficultyRating) => {
    if (!currentSentence) return;

    // Save rating to progress store
    rateSentence(currentSentence.id, rating);

    // Stop any playing audio
    stopAllAudio();

    // Auto-advance to next sentence after selection
    if (currentIndex < filteredSentences.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 300);
    }
  }, [currentSentence, currentIndex, filteredSentences.length, rateSentence]);

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
          selectedCategory={selectedCategory}
          selectedDifficulty={selectedDifficulty}
          onCategoryChange={setSelectedCategory}
          onDifficultyChange={setSelectedDifficulty}
        />
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No sentences found matching your filters.
          </p>
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedDifficulty(null);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Sentence Practice</h2>

        {/* Filter controls */}
        <FilterControls
          categories={categories}
          selectedCategory={selectedCategory}
          selectedDifficulty={selectedDifficulty}
          onCategoryChange={setSelectedCategory}
          onDifficultyChange={setSelectedDifficulty}
        />

        {/* Sentence card */}
        {currentSentence && (
          <>
            <SentenceCard
              sentence={currentSentence}
              currentIndex={currentIndex}
              totalCount={filteredSentences.length}
              sessionId={sessionIdRef.current}
            />

            {/* Navigation buttons */}
            <NavigationButtons
              onPrevious={handlePrevious}
              onNext={handleNext}
              canGoPrevious={currentIndex > 0}
              canGoNext={currentIndex < filteredSentences.length - 1}
            />

            {/* Difficulty rating buttons */}
            <DifficultyButtons onSelect={handleDifficultySelect} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
