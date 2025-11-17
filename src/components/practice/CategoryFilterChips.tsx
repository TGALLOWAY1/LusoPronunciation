import { memo, useCallback } from 'react';
import type { Category } from '@/lib/types';

interface CategoryFilterChipsProps {
  categories: Category[];
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
}

function CategoryFilterChips({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryFilterChipsProps) {
  const handleCategoryClick = useCallback((categoryId: string | null) => {
    onCategoryChange(categoryId);
  }, [onCategoryChange]);
  return (
    <div className="card card-compact mb-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCategoryClick(null)}
          className={`chip rounded-full ${selectedCategory === null ? 'chip-active' : 'chip-inactive'}`}
        >
          All Categories
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category.id)}
            className={`chip rounded-full ${selectedCategory === category.id ? 'chip-active' : 'chip-inactive'}`}
          >
            {category.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
}

export default memo(CategoryFilterChips);

