import { useRef, useState, useEffect } from 'react';
import type { NormalizedAudioVariant } from './types';

interface SentenceAudioControlsProps {
  sentenceAudio: NormalizedAudioVariant[];
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

    // If clicking the same button that's currently playing, pause it
    if (externalActiveType === type && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (onStop) {
        onStop();
      }
      return;
    }

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
  
  // Clear boolean states for playing
  const isNativePlaying = activeType === 'native' && isPlaying;
  const isUserPlaying = activeType === 'user' && isPlaying;

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
              isNativePlaying
                ? 'bg-blue-700 text-white shadow-md'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            }`}
          >
            {isNativePlaying ? (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
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
            <svg className="w-5 h-5 inline mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
            Native Sentence
          </button>
        )}
        
        {userAudio && (
          <button
            onClick={() => handlePlay('user', userAudio.url)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              isUserPlaying
                ? 'bg-gray-700 dark:bg-gray-600 text-white border-2 border-gray-700 dark:border-gray-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {isUserPlaying ? (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                <span>Pause</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
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

