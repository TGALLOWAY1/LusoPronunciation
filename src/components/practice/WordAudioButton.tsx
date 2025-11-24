import { useState, useRef, useEffect } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';

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

  const displayLabel = label || 'Play';

  if (compact) {
    return (
      <PremiumPlayButton
        isPlaying={isPlaying}
        onClick={handlePlay}
        size="sm"
        className={className}
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PremiumPlayButton
        isPlaying={isPlaying}
        onClick={handlePlay}
        size="md"
      />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {displayLabel}
      </span>
    </div>
  );
}

