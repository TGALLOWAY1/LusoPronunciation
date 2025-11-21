import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';

interface WordAudioButtonProps {
  wordId: string;
  label?: string;
  compact?: boolean;
  className?: string;
}

/**
 * Button component for playing word audio.
 * Automatically uses the global voice setting from settings store.
 */
export default function WordAudioButton({
  wordId,
  label,
  compact = false,
  className = '',
}: WordAudioButtonProps) {
  const { selectedVoice } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Reset audio when wordId or voice changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      setIsPlaying(false);
    }
  }, [wordId, selectedVoice]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = () => {
    // Stop if already playing
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      audioRef.current.addEventListener('error', () => {
        const error = audioRef.current?.error;
        const errorMsg = error 
          ? `Error ${error.code}: ${error.message || 'Unknown error'}`
          : 'Unknown error';
        const audioPath = getAudioUrlForWordSync(wordId, selectedVoice);
        console.error(`Failed to play audio for word "${wordId}" (${selectedVoice}) at path "${audioPath}":`, errorMsg);
        setIsPlaying(false);
      });
    }

    // Set source and play using global voice setting
    const audioPath = getAudioUrlForWordSync(wordId, selectedVoice);
    
    if (!audioPath) {
      console.error(`No audio path found for word "${wordId}" with voice "${selectedVoice}"`);
      return;
    }
    
    try {
      audioRef.current.src = audioPath;
      
      // Use play() promise and handle errors
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Audio started playing successfully
            setIsPlaying(true);
          })
          .catch((error) => {
            // Auto-play was prevented or other error
            console.error(`Failed to play audio for word "${wordId}" (${selectedVoice}):`, error);
            setIsPlaying(false);
          });
      } else {
        // Fallback for older browsers
        setIsPlaying(true);
      }
    } catch (error) {
      console.error(`Error setting audio source for word "${wordId}" (${selectedVoice}):`, error);
      setIsPlaying(false);
    }
  };

  const icon = isPlaying ? '⏸' : '▶';
  const displayLabel = label || 'Play';

  if (compact) {
    return (
      <button
        onClick={handlePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
          isPlaying
            ? 'bg-primary-500 text-white shadow-lg animate-pulse'
            : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50'
        } ${className}`}
        title={`Play pronunciation`}
        aria-label={`Play pronunciation of word`}
      >
        {icon}
      </button>
    );
  }

  return (
    <button
      onClick={handlePlay}
      className={`btn btn-sm ${
        isPlaying ? 'btn-primary' : 'btn-outline-primary'
      } ${className}`}
      title={`Play pronunciation`}
    >
      <span className="mr-2">{icon}</span>
      {displayLabel}
    </button>
  );
}

