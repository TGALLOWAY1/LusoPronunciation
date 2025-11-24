import { memo, useMemo } from 'react';
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
}

/**
 * FilterControls component for Category and Difficulty filtering.
 * 
 * This component provides multi-select dropdown filters for:
 * - Category: Multiple categories can be selected
 * - Difficulty: Multiple difficulty levels can be selected (Very Easy - Very Hard)
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
    <div className="card card-compact mb-6 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      {/* Filters section header */}
      <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Filters
        </h3>
        {currentIndex !== undefined && totalCount !== undefined && (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Sentence {currentIndex + 1} of {totalCount}
          </span>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Category filter */}
        <div className="flex-1">
          <MultiSelect
            label="Category"
            options={categoryOptions}
            selectedValues={selectedCategories}
            onChange={(values) => onCategoryChange(values as string[])}
            placeholder="All categories"
          />
        </div>

        {/* Difficulty filter */}
        <div className="flex-1">
          <MultiSelect
            label="Difficulty"
            options={difficultyOptions}
            selectedValues={selectedDifficulties}
            onChange={(values) => onDifficultyChange(values as Difficulty[])}
            placeholder="All difficulties"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(FilterControls);

