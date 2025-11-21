import { memo } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface AudioPlayerButtonProps {
  audioUrl: string | null | undefined;
  label: string;
  icon: string;
  variant?: 'male' | 'female';
  compact?: boolean; // For smaller buttons in word cards
}

function AudioPlayerButton({ audioUrl, label, icon, variant = 'male', compact = false }: AudioPlayerButtonProps) {
  const { play, pause, isPlaying, currentTime, duration, isLoading, error } = useAudioPlayer(audioUrl);

  const variantStyles = {
    male: 'bg-blue-500 hover:bg-blue-600 text-white',
    female: 'bg-pink-500 hover:bg-pink-600 text-white',
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioUrl) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-400 cursor-not-allowed"
      >
        <span>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs">(No audio)</span>
      </button>
    );
  }

  if (error) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-600 cursor-not-allowed"
        title={error.message}
      >
        <span>⚠️</span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs">(Error)</span>
      </button>
    );
  }

  const buttonClasses = compact
    ? `flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
        variantStyles[variant]
      } ${isLoading ? 'opacity-50 cursor-wait' : ''} ${isPlaying ? 'ring-2 ring-offset-1 ring-white' : ''}`
    : `w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
        variantStyles[variant]
      } ${isLoading ? 'opacity-50 cursor-wait' : ''} ${isPlaying ? 'ring-2 ring-offset-2 ring-white' : ''}`;

  return (
    <div className={compact ? '' : 'flex-1'}>
      <button
        onClick={isPlaying ? pause : play}
        disabled={isLoading}
        className={buttonClasses}
      >
        {isLoading ? (
          <>
            <span className="animate-spin">⏳</span>
            {!compact && <span className="text-sm">Loading...</span>}
          </>
        ) : isPlaying ? (
          <>
            <span>⏸️</span>
            {!compact && <span className="text-sm">{label}</span>}
          </>
        ) : (
          <>
            <span>{compact ? '▶' : icon}</span>
            {!compact && <span className="text-sm">{label}</span>}
          </>
        )}
      </button>
      {/* Progress bar */}
      {isPlaying && duration > 0 && (
        <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
          <div
            className={`h-1 rounded-full transition-all ${
              variant === 'male' ? 'bg-blue-400' : 'bg-pink-400'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(AudioPlayerButton);

