import { memo, useMemo, useCallback } from 'react';
import type { Category, Difficulty } from '@/lib/types';

interface FilterControlsProps {
  categories: Category[];
  selectedCategory: string | null;
  selectedDifficulty: Difficulty | null;
  onCategoryChange: (categoryId: string | null) => void;
  onDifficultyChange: (difficulty: Difficulty | null) => void;
}

function FilterControls({
  categories,
  selectedCategory,
  selectedDifficulty,
  onCategoryChange,
  onDifficultyChange,
}: FilterControlsProps) {
  const difficulties: { value: Difficulty; label: string }[] = useMemo(() => [
    { value: 1, label: 'Very Easy' },
    { value: 2, label: 'Easy' },
    { value: 3, label: 'Medium' },
    { value: 4, label: 'Hard' },
    { value: 5, label: 'Very Hard' },
  ], []);

  const handleCategoryClick = useCallback((categoryId: string | null) => {
    onCategoryChange(categoryId);
  }, [onCategoryChange]);

  const handleDifficultyClick = useCallback((difficulty: Difficulty | null) => {
    onDifficultyChange(difficulty);
  }, [onDifficultyChange]);

  return (
    <div className="card card-compact mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Category filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleCategoryClick(null)}
              className={`chip ${selectedCategory === null ? 'chip-active' : 'chip-inactive'}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={`chip ${selectedCategory === category.id ? 'chip-active' : 'chip-inactive'}`}
              >
                {category.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty filter */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Difficulty
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleDifficultyClick(null)}
              className={`chip ${selectedDifficulty === null ? 'chip-active' : 'chip-inactive'}`}
            >
              All
            </button>
            {difficulties.map((difficulty) => (
              <button
                key={difficulty.value}
                onClick={() => handleDifficultyClick(difficulty.value)}
                className={`chip ${selectedDifficulty === difficulty.value ? 'chip-active' : 'chip-inactive'}`}
              >
                {difficulty.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(FilterControls);

