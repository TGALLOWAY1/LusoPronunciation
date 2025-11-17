import { memo, useCallback } from 'react';

export type ViewMode = 'list' | 'drill';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  const handleListClick = useCallback(() => onModeChange('list'), [onModeChange]);
  const handleDrillClick = useCallback(() => onModeChange('drill'), [onModeChange]);
  return (
    <div className="card card-compact p-1 inline-flex">
      <button
        onClick={handleListClick}
        className={`chip rounded-md ${mode === 'list' ? 'chip-active' : 'chip-inactive'}`}
      >
        📋 List View
      </button>
      <button
        onClick={handleDrillClick}
        className={`chip rounded-md ${mode === 'drill' ? 'chip-active' : 'chip-inactive'}`}
      >
        🎯 Drill Mode
      </button>
    </div>
  );
}

export default memo(ViewModeToggle);

