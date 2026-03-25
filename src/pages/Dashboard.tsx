import { useEffect, useState, useMemo } from 'react';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords, loadAllCategories } from '@/lib/data';
import type { Sentence, Word, Category } from '@/lib/types';
import { getWordStats } from '@/lib/wordStats';
import SummaryCard from '@/components/dashboard/SummaryCard';
import CategoryProgress from '@/components/dashboard/CategoryProgress';
import ContinuePracticeCard from '@/components/dashboard/ContinuePracticeCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { getLastPracticeMode } from '@/lib/storage';

export default function Dashboard() {
  const { getProgressEntry, entries, storageError } = useProgressStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lastPracticeMode, setLastPracticeMode] = useState<'sentence' | 'word' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  useEffect(() => {
    async function loadData() {
      try {
        setError(null);
        const [sentencesData, wordsData, categoriesData] = await Promise.all([
          loadAllSentences(),
          loadAllWords(),
          loadAllCategories(),
        ]);

        setSentences(sentencesData);
        setWords(wordsData);
        setCategories(categoriesData);
        setLastPracticeMode(getLastPracticeMode());
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        const message = error instanceof Error 
          ? error.message 
          : 'Failed to load dashboard data';
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate word statistics
  const wordStats = useMemo(() => {
    return getWordStats(words);
  }, [words]);

  // Memoize category progress calculation
  // Include entries in dependencies to recalculate when progress changes
  const categoryProgressMap = useMemo(() => {
    // Helper function to check if an item is completed based on its progress entry
    const isItemCompleted = (itemId: string, itemType: 'sentence' | 'word'): boolean => {
      const progressEntry = getProgressEntry(itemId, itemType);
      if (!progressEntry || !progressEntry.lastRating) {
        return false;
      }

      // For sentences: 'easy' or 'good' ratings are considered completed (equivalent to >= 4 on 1-5 scale)
      if (itemType === 'sentence') {
        const rating = progressEntry.lastRating;
        return rating === 'easy' || rating === 'good';
      }

      // For words: 'know' action is considered completed
      if (itemType === 'word') {
        return progressEntry.lastRating === 'know';
      }

      return false;
    };

    // Calculate category progress based on real progress data
    const getCategoryProgress = (categoryId: string) => {
      const categorySentences = sentences.filter(s => s.categoryId === categoryId);
      const categoryWords = words.filter(w => w.categoryId === categoryId);
      const totalItems = categorySentences.length + categoryWords.length;
      
      // Count completed items by checking progress entries
      let completedItems = 0;
      
      // Check each sentence
      for (const sentence of categorySentences) {
        if (isItemCompleted(sentence.id, 'sentence')) {
          completedItems++;
        }
      }
      
      // Check each word
      for (const word of categoryWords) {
        if (isItemCompleted(word.id, 'word')) {
          completedItems++;
        }
      }
      
      // Calculate progress percentage
      const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      
      return {
        progress,
        totalItems,
        completedItems,
      };
    };

    const map = new Map<string, { progress: number; totalItems: number; completedItems: number }>();
    categories.forEach(category => {
      const { progress, totalItems, completedItems } = getCategoryProgress(category.id);
      map.set(category.id, { progress, totalItems, completedItems });
    });
    return map;
  }, [categories, sentences, words, entries, getProgressEntry]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
      {/* Storage Error Banner */}
      {storageError && (
        <ErrorMessage
          title="Storage Full"
          message="Unable to save progress. Your browser's storage is full. Please free up space to continue saving your progress."
        />
      )}

      {/* Data Loading Error */}
      {error && (
        <ErrorMessage
          title="Failed to Load Data"
          message={error}
          onRetry={() => {
            setLoading(true);
            setError(null);
            // Reload data
            Promise.all([
              loadAllSentences(),
              loadAllWords(),
              loadAllCategories(),
            ])
              .then(([sentencesData, wordsData, categoriesData]) => {
                setSentences(sentencesData);
                setWords(wordsData);
                setCategories(categoriesData);
                setLastPracticeMode(getLastPracticeMode());
                setLoading(false);
              })
              .catch((err) => {
                console.error('Error reloading dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to reload data');
                setLoading(false);
              });
          }}
        />
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-lg shadow-lg p-6 md:p-8 text-white">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Welcome to LusoPronounce</h1>
        <p className="text-base md:text-lg text-primary-50 max-w-2xl">
          Practice your Brazilian Portuguese pronunciation with sentences and words. 
          Get instant feedback on your pronunciation and improve through spaced repetition.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          title="Total Sentences"
          value={sentences.length}
          icon="💬"
          description="Available for practice"
        />
        <SummaryCard
          title="Total Words"
          value={wordStats.totalWords}
          icon="📝"
          description="Vocabulary items"
        />
        <SummaryCard
          title="Categories"
          value={categories.length}
          icon="📚"
          description="Learning topics"
        />
      </div>

      {/* Words by Category */}
      {Object.keys(wordStats.byCategory).length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Words by Category
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(() => {
              // Get all category IDs that have words from words.json data
              const categoryIdsWithWords = Object.keys(wordStats.byCategory)
                .filter(catId => wordStats.byCategory[catId] > 0)
                .sort();

              // Create a map of category ID to category info for quick lookup
              const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

              // Build list of all categories with words, using actual counts from words.json
              return categoryIdsWithWords.map(categoryId => {
                const wordCount = wordStats.byCategory[categoryId] || 0;
                const category = categoryMap.get(categoryId);
                
                // Use category label from categories array if available, otherwise format the ID
                const label = category?.labelEn || categoryId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                
                return (
                  <div
                    key={categoryId}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                    <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                      {wordCount}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Continue Practice Card */}
      <ContinuePracticeCard lastMode={lastPracticeMode} />

      {/* Categories Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Categories</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => {
            const progressData = categoryProgressMap.get(category.id) || { progress: 0, totalItems: 0, completedItems: 0 };
            return (
              <CategoryProgress
                key={category.id}
                category={category}
                progress={progressData.progress}
                totalItems={progressData.totalItems}
                completedItems={progressData.completedItems}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
