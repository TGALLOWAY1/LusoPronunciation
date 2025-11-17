import type { Category } from '@/lib/types';

interface CategoryProgressProps {
  category: Category;
  progress: number; // 0-100
  totalItems: number;
  completedItems: number;
}

export default function CategoryProgress({
  category,
  progress,
  totalItems,
  completedItems,
}: CategoryProgressProps) {
  return (
    <div className="card card-hover card-compact">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{category.labelEn}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{category.labelPt}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{Math.round(progress)}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{completedItems} / {totalItems}</p>
        </div>
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

