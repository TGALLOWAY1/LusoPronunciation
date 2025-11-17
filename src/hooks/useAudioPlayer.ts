import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAudioPlayerReturn {
  play: () => void;
  pause: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  error: Error | null;
}

// Global reference to currently playing audio (shared across all hook instances)
// This ensures only one audio plays at a time
const globalAudioRef = { current: null as HTMLAudioElement | null };

/**
 * Stop any currently playing audio globally.
 * Useful when navigating between sentences.
 */
export function stopAllAudio(): void {
  if (globalAudioRef.current) {
    globalAudioRef.current.pause();
    globalAudioRef.current.currentTime = 0;
    globalAudioRef.current = null;
  }
}

/**
 * Hook for managing audio playback with lazy loading.
 * Only one audio instance should be active at a time globally.
 */
export function useAudioPlayer(audioUrl: string | null | undefined): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element lazily - memoize handlers to prevent recreation
  const updateTime = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const updateDuration = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (globalAudioRef.current === audioRef.current) {
      globalAudioRef.current = null;
    }
  }, []);

  const handleError = useCallback((e: ErrorEvent | Event) => {
    const error = e instanceof ErrorEvent ? e.error : new Error('Audio playback error');
    setError(error);
    setIsPlaying(false);
    setIsLoading(false);
    console.error('Audio playback error:', error);
  }, []);

  // Initialize audio element lazily
  const getAudio = useCallback(() => {
    if (!audioUrl) return null;

    // If audio already exists and URL hasn't changed, reuse it
    if (audioRef.current) {
      const currentSrc = audioRef.current.src;
      const urlPath = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
      if (currentSrc.endsWith(audioUrl) || currentSrc.endsWith(urlPath)) {
        return audioRef.current;
      }
    }

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('timeupdate', updateTime);
      audioRef.current.removeEventListener('loadedmetadata', updateDuration);
      audioRef.current.removeEventListener('ended', handleEnded);
      audioRef.current.removeEventListener('error', handleError);
      audioRef.current = null;
    }

    // Create new audio element (lazy loading - only when needed)
    const audio = new Audio(audioUrl);
    audio.preload = 'none'; // Don't preload, load on demand

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', () => setIsLoading(true));
    audio.addEventListener('canplay', () => setIsLoading(false));

    audioRef.current = audio;
    return audio;
  }, [audioUrl, updateTime, updateDuration, handleEnded, handleError]);

  const play = useCallback(() => {
    if (!audioUrl) return;

    const audio = getAudio();
    if (!audio) return;

    // Stop any currently playing audio
    if (globalAudioRef.current && globalAudioRef.current !== audio) {
      globalAudioRef.current.pause();
      globalAudioRef.current.currentTime = 0;
    }

    // Set this as the global playing audio
    globalAudioRef.current = audio;

    // Play this audio
    audio.play().then(() => {
      setIsPlaying(true);
      setError(null);
    }).catch((err) => {
      setError(err);
      setIsPlaying(false);
      console.error('Failed to play audio:', err);
    });
  }, [audioUrl, getAudio]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (globalAudioRef.current === audioRef.current) {
        globalAudioRef.current = null;
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('timeupdate', updateTime);
        audioRef.current.removeEventListener('loadedmetadata', updateDuration);
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current = null;
      }
      if (globalAudioRef.current === audioRef.current) {
        globalAudioRef.current = null;
      }
    };
  }, [updateTime, updateDuration, handleEnded, handleError]);

  // Reset state when audio URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
    setIsLoading(false);
  }, [audioUrl]);

  return {
    play,
    pause,
    isPlaying,
    currentTime,
    duration,
    isLoading,
    error,
  };
}

