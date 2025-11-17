import { memo } from 'react';

export type DifficultyRating = 'easy' | 'good' | 'hard';

interface DifficultyButtonsProps {
  onSelect: (rating: DifficultyRating) => void;
  disabled?: boolean;
}

function DifficultyButtons({ onSelect, disabled = false }: DifficultyButtonsProps) {
  const buttons: { rating: DifficultyRating; label: string; icon: string; color: string }[] = [
    { rating: 'easy', label: 'Easy', icon: '😊', color: 'bg-green-500 hover:bg-green-600' },
    { rating: 'good', label: 'Good', icon: '👍', color: 'bg-blue-500 hover:bg-blue-600' },
    { rating: 'hard', label: 'Hard', icon: '😓', color: 'bg-orange-500 hover:bg-orange-600' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      {buttons.map((button) => (
        <button
          key={button.rating}
          onClick={() => onSelect(button.rating)}
          disabled={disabled}
          className={`btn flex-1 ${button.color} text-white btn-lg shadow-md transform hover:scale-105 active:scale-95 focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2`}
        >
          <span className="text-2xl">{button.icon}</span>
          <span>{button.label}</span>
        </button>
      ))}
    </div>
  );
}

export default memo(DifficultyButtons);

