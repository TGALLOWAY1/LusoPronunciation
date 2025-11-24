import { memo } from 'react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';

interface AudioPlayerButtonProps {
  audioUrl: string | null | undefined;
  label: string;
  icon: string;
  variant?: 'male' | 'female';
  compact?: boolean; // For smaller buttons in word cards
}

function AudioPlayerButton({ audioUrl, label, icon, variant = 'male', compact = false }: AudioPlayerButtonProps) {
  const { play, pause, isPlaying, currentTime, duration, isLoading, error } = useAudioPlayer(audioUrl);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioUrl) {
    return (
      <div className={compact ? '' : 'flex-1'}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-200 text-gray-400 cursor-not-allowed">
          <span>{icon}</span>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">(No audio)</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={compact ? '' : 'flex-1'}>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 text-red-600 cursor-not-allowed" title={error.message}>
          <span>⚠️</span>
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs">(Error)</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div>
        <PremiumPlayButton
          isPlaying={isPlaying}
          onClick={isPlaying ? pause : play}
          disabled={isLoading}
          size="sm"
        />
        {/* Progress bar */}
        {isPlaying && duration > 0 && (
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
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

  return (
    <div className="flex-1">
      <div className="flex items-center gap-3">
        <PremiumPlayButton
          isPlaying={isPlaying}
          onClick={isPlaying ? pause : play}
          disabled={isLoading}
          size="md"
        />
        <div className="flex-1">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </div>
          {/* Progress bar */}
          {isPlaying && duration > 0 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all ${
                  variant === 'male' ? 'bg-blue-400' : 'bg-pink-400'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(AudioPlayerButton);

