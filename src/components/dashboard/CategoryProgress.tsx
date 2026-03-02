import { Link } from 'react-router-dom';
import type { Category } from '@/lib/types';

interface CategoryProgressProps {
  category: Category;
  progress: number;
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
    <Link
      to={`/practice/sentences?category=${encodeURIComponent(category.id)}`}
      className="card card-hover p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{category.labelEn}</h3>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{progress}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-primary-500 h-2 rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {completedItems}/{totalItems} completed
      </p>
    </Link>
  );
}
