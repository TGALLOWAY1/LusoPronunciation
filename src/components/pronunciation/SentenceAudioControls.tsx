import { useRef, useState, useEffect } from 'react';
import type { AudioVariant } from '@/types/pronunciationFixtures';

interface SentenceAudioControlsProps {
  sentenceAudio: AudioVariant[];
  activeType?: 'native' | 'user' | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  onStart?: (type: 'native' | 'user') => void;
  onStop?: () => void;
}

/**
 * Interactive controls for playing native vs user sentence audio.
 * Coordinates with parent to ensure only one audio source plays at a time.
 * Uses global voice setting to select the appropriate native audio variant.
 */
export default function SentenceAudioControls({
  sentenceAudio,
  activeType: externalActiveType = null,
  audioRef: externalAudioRef,
  onStart,
  onStop,
}: SentenceAudioControlsProps) {
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  const audioRef = externalAudioRef || internalAudioRef;
  const [isPlaying, setIsPlaying] = useState(false);

  // Get native and user audio
  // Note: Native audio selection by voice is handled at the data level in pronunciationFixtureAdapter
  const nativeAudio = sentenceAudio.find(a => a.type === 'native');
  const userAudio = sentenceAudio.find(a => a.type === 'user');

  // Sync with external active type
  useEffect(() => {
    if (externalActiveType === null && isPlaying) {
      setIsPlaying(false);
    }
  }, [externalActiveType, isPlaying]);

  const handlePlay = (type: 'native' | 'user', url: string) => {
    if (!audioRef.current) return;

    // Stop current playback
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Notify parent
    if (onStart) {
      onStart(type);
    }

    // Set new source and play
    audioRef.current.src = url;
    setIsPlaying(true);
    audioRef.current.play().catch((error) => {
      console.error(`Failed to play ${type} sentence audio:`, error);
      setIsPlaying(false);
      if (onStop) {
        onStop();
      }
    });
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (onStop) {
      onStop();
    }
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (onStop) {
      onStop();
    }
  };

  const activeType = externalActiveType;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Compare Pronunciations
      </h3>
      
      <div className="flex gap-3">
        {nativeAudio ? (
          <button
            onClick={() => handlePlay('native', nativeAudio.url)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeType === 'native' && isPlaying
                ? 'bg-emerald-500 text-white shadow-lg animate-pulse'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {activeType === 'native' && isPlaying ? (
              <>
                <span className="animate-pulse">🔊</span>
                <span>Playing...</span>
              </>
            ) : (
              <>
                <span>🔊</span>
                <span>Native Sentence</span>
              </>
            )}
          </button>
        ) : (
          <button
            disabled
            title="Native audio not available for this sentence."
            className="flex-1 px-4 py-3 rounded-lg font-medium bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60"
          >
            🔊 Native Sentence
          </button>
        )}
        
        {userAudio && (
          <button
            onClick={() => handlePlay('user', userAudio.url)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              activeType === 'user' && isPlaying
                ? 'bg-blue-500 text-white shadow-lg animate-pulse'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {activeType === 'user' && isPlaying ? (
              <>
                <span className="animate-pulse">🎤</span>
                <span>Playing...</span>
              </>
            ) : (
              <>
                <span>🎤</span>
                <span>Your Recording</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onPause={handlePause}
        className="hidden"
      />
    </div>
  );
}

