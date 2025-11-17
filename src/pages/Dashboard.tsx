import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProgressStore } from '@/state/progressStore';
import { loadAllSentences, loadAllWords, loadAllCategories } from '@/lib/data';
import type { Sentence, Word, Category } from '@/lib/types';
import SummaryCard from '@/components/dashboard/SummaryCard';
import CategoryProgress from '@/components/dashboard/CategoryProgress';
import ContinuePracticeCard from '@/components/dashboard/ContinuePracticeCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { getLastPracticeMode } from '@/lib/storage';

export default function Dashboard() {
  const { getDueCount } = useProgressStore();
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [lastPracticeMode, setLastPracticeMode] = useState<'sentence' | 'word' | null>(null);
  const [loading, setLoading] = useState(true);

  const dueCount = getDueCount();

  useEffect(() => {
    async function loadData() {
      try {
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
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Calculate category progress (placeholder - will be replaced with real progress later)
  const getCategoryProgress = (categoryId: string) => {
    const categorySentences = sentences.filter(s => s.categoryId === categoryId);
    const categoryWords = words.filter(w => w.categoryId === categoryId);
    const totalItems = categorySentences.length + categoryWords.length;
    
    // Placeholder: return random progress between 0-100 for now
    // This will be replaced with real progress from LocalStorage later
    const placeholderProgress = Math.floor(Math.random() * 100);
    const completedItems = Math.floor((placeholderProgress / 100) * totalItems);
    
    return {
      progress: placeholderProgress,
      totalItems,
      completedItems,
    };
  };

  // Memoize category progress calculation
  const categoryProgressMap = useMemo(() => {
    const map = new Map<string, { progress: number; totalItems: number; completedItems: number }>();
    categories.forEach(category => {
      const { progress, totalItems, completedItems } = getCategoryProgress(category.id);
      map.set(category.id, { progress, totalItems, completedItems });
    });
    return map;
  }, [categories, sentences, words]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
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
          value={words.length}
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

      {/* Continue Practice Card */}
      <ContinuePracticeCard lastMode={lastPracticeMode} />

      {/* Review Queue Card */}
      {dueCount > 0 && (
        <Link
          to="/review"
          className="block bg-gradient-to-br from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-xl font-bold mb-1">Review Queue</h3>
              <p className="text-orange-50">
                {dueCount} {dueCount === 1 ? 'item' : 'items'} due for review
              </p>
            </div>
            <span className="text-4xl">🔄</span>
          </div>
          <div className="flex items-center text-sm font-medium">
            Start Review →
          </div>
        </Link>
      )}

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
