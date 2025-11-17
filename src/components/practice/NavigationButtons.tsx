import { memo } from 'react';

interface NavigationButtonsProps {
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

function NavigationButtons({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: NavigationButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="btn btn-secondary btn-md flex-1 flex items-center justify-center gap-2"
      >
        <span>←</span>
        <span>Previous</span>
      </button>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="btn btn-secondary btn-md flex-1 flex items-center justify-center gap-2"
      >
        <span>Next</span>
        <span>→</span>
      </button>
    </div>
  );
}

export default memo(NavigationButtons);

