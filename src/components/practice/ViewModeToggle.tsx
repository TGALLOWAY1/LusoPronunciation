import { memo, useCallback } from 'react';

export type ViewMode = 'list' | 'drill' | 'weak-words';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  const handleListClick = useCallback(() => onModeChange('list'), [onModeChange]);
  const handleDrillClick = useCallback(() => onModeChange('drill'), [onModeChange]);
  const handleWeakWordsClick = useCallback(() => onModeChange('weak-words'), [onModeChange]);
  return (
    <div className="card card-compact p-1 inline-flex">
      <button
        onClick={handleListClick}
        className={`chip rounded-md ${mode === 'list' ? 'chip-active' : 'chip-inactive'}`}
      >
        📋 Glossary
      </button>
      <button
        onClick={handleDrillClick}
        className={`chip rounded-md ${mode === 'drill' ? 'chip-active' : 'chip-inactive'}`}
      >
        🎯 Drill Mode
      </button>
      <button
        onClick={handleWeakWordsClick}
        className={`chip rounded-md ${mode === 'weak-words' ? 'chip-active' : 'chip-inactive'}`}
      >
        🎯 Focus on Weak Words
      </button>
    </div>
  );
}

export default memo(ViewModeToggle);

