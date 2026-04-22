import { memo, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Category, Difficulty } from '@/lib/types';
import { getDifficultyOptions } from '@/utils/difficultyLabels';
import MultiSelect, { type MultiSelectOption } from '@/components/common/MultiSelect';

interface FilterControlsProps {
  categories: Category[];
  selectedCategories: string[];
  selectedDifficulties: Difficulty[];
  onCategoryChange: (categoryIds: string[]) => void;
  onDifficultyChange: (difficulties: Difficulty[]) => void;
  currentIndex?: number;
  totalCount?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  directionMode?: 'pt-to-en' | 'en-to-pt' | 'mixed';
  onDirectionModeChange?: (mode: 'pt-to-en' | 'en-to-pt' | 'mixed') => void;
}

/**
 * FilterControls component for Category and Difficulty filtering.
 * 
 * This component provides multi-select dropdown filters for:
 * - Category: Multiple categories can be selected
 * - Difficulty: Multiple difficulty levels can be selected (Easy, Medium, Hard)
 * 
 * The "Current filters" header in SentencePractice displays a read-only summary
 * of the same state managed here.
 */
function FilterControls({
  categories,
  selectedCategories,
  selectedDifficulties,
  onCategoryChange,
  onDifficultyChange,
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  directionMode,
  onDirectionModeChange,
}: FilterControlsProps) {
  const difficulties = getDifficultyOptions();

  // Convert categories to MultiSelectOption format
  const categoryOptions: MultiSelectOption[] = useMemo(() => {
    return categories.map((category) => ({
      value: category.id,
      label: category.labelEn,
    }));
  }, [categories]);

  // Convert difficulties to MultiSelectOption format
  const difficultyOptions: MultiSelectOption[] = useMemo(() => {
    return difficulties.map((difficulty) => ({
      value: difficulty.value,
      label: difficulty.label,
    }));
  }, [difficulties]);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Direction Mode Selector (only for Multiple Choice modes) */}
      {directionMode && onDirectionModeChange && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Direction:</label>
          <div className="flex gap-1">
            <button
              onClick={() => onDirectionModeChange('pt-to-en')}
              className={`btn btn-sm ${
                directionMode === 'pt-to-en' 
                  ? 'btn-primary' 
                  : 'btn-outline'
              }`}
            >
              PT → EN
            </button>
            <button
              onClick={() => onDirectionModeChange('en-to-pt')}
              className={`btn btn-sm ${
                directionMode === 'en-to-pt' 
                  ? 'btn-primary' 
                  : 'btn-outline'
              }`}
            >
              EN → PT
            </button>
            <button
              onClick={() => onDirectionModeChange('mixed')}
              className={`btn btn-sm ${
                directionMode === 'mixed' 
                  ? 'btn-primary' 
                  : 'btn-outline'
              }`}
            >
              Mixed
            </button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <MultiSelect
        label="Category"
        options={categoryOptions}
        selectedValues={selectedCategories}
        onChange={(values) => onCategoryChange(values as string[])}
        placeholder="All categories"
      />

      {/* Difficulty filter */}
      <MultiSelect
        label="Difficulty"
        options={difficultyOptions}
        selectedValues={selectedDifficulties}
        onChange={(values) => onDifficultyChange(values as Difficulty[])}
        placeholder="All difficulties"
      />

      {currentIndex !== undefined && totalCount !== undefined && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Sentence {currentIndex + 1} of {totalCount}
          </span>
          {(onPrevious || onNext) && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onPrevious}
                disabled={!onPrevious || currentIndex === 0}
                aria-label="Previous sentence"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={!onNext || currentIndex >= totalCount - 1}
                aria-label="Next sentence"
                className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(FilterControls);

