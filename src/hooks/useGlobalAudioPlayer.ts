import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/state/settingsStore';
import { getAudioUrlForSentenceSync, getAudioUrlForWordSync } from '@/utils/audioRouting';

/**
 * Global audio player hook that automatically uses the selected voice from settings.
 * 
 * This hook provides a simple interface for playing audio that:
 * - Automatically resolves audio URLs based on the global voice setting
 * - Handles cleanup and prevents overlapping playback
 * - Works with both sentences and words
 */

interface UseGlobalAudioPlayerReturn {
  playSentence: (sentenceId: string) => Promise<void>;
  playWord: (wordId: string) => Promise<void>;
  playUrl: (url: string) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  error: Error | null;
}

// Global reference to currently playing audio (shared across all hook instances)
const globalAudioRef = { current: null as HTMLAudioElement | null };

/**
 * Hook for playing audio with automatic voice routing.
 * 
 * @example
 * const { playSentence, playWord, stop, isPlaying } = useGlobalAudioPlayer();
 * 
 * // Play a sentence (uses global voice setting)
 * await playSentence("food_001");
 * 
 * // Play a word (uses global voice setting)
 * await playWord("food_word_001");
 * 
 * // Play a direct URL
 * await playUrl("/audio/custom.wav");
 */
export function useGlobalAudioPlayer(): UseGlobalAudioPlayerReturn {
  const { selectedVoice } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.removeEventListener('error', handleError);
        audioRef.current = null;
      }
      if (globalAudioRef.current === audioRef.current) {
        globalAudioRef.current = null;
      }
    };
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (globalAudioRef.current === audioRef.current) {
      globalAudioRef.current = null;
    }
  }, []);

  const handleError = useCallback((e: ErrorEvent | Event) => {
    const error = e instanceof ErrorEvent ? e.error : new Error('Audio playback error');
    setError(error);
    setIsPlaying(false);
    console.error('Audio playback error:', error);
  }, []);

  const createAudioElement = useCallback((url: string): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null; // SSR guard
    
    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('ended', handleEnded);
      audioRef.current.removeEventListener('error', handleError);
      audioRef.current = null;
    }

    // Stop any currently playing audio globally
    if (globalAudioRef.current && globalAudioRef.current !== audioRef.current) {
      globalAudioRef.current.pause();
      globalAudioRef.current.currentTime = 0;
    }

    // Create new audio element
    const audio = new Audio(url);
    audio.preload = 'none';
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    audioRef.current = audio;
    globalAudioRef.current = audio;
    return audio;
  }, [handleEnded, handleError]);

  const playSentence = useCallback(async (sentenceId: string) => {
    if (typeof window === 'undefined') return; // SSR guard
    
    try {
      setError(null);
      const url = getAudioUrlForSentenceSync(sentenceId, selectedVoice);
      
      if (!url) {
        throw new Error(`Audio not found for sentence "${sentenceId}" with voice "${selectedVoice}"`);
      }

      const audio = createAudioElement(url);
      if (!audio) return;
      
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to play sentence audio');
      setError(error);
      setIsPlaying(false);
      throw error;
    }
  }, [selectedVoice, createAudioElement]);

  const playWord = useCallback(async (wordId: string) => {
    if (typeof window === 'undefined') return; // SSR guard
    
    try {
      setError(null);
      const url = getAudioUrlForWordSync(wordId, selectedVoice);

      const audio = createAudioElement(url);
      if (!audio) return;
      
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to play word audio');
      setError(error);
      setIsPlaying(false);
      throw error;
    }
  }, [selectedVoice, createAudioElement]);

  const playUrl = useCallback(async (url: string) => {
    if (typeof window === 'undefined') return; // SSR guard
    
    try {
      setError(null);
      const audio = createAudioElement(url);
      if (!audio) return;
      
      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to play audio');
      setError(error);
      setIsPlaying(false);
      throw error;
    }
  }, [createAudioElement]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      if (globalAudioRef.current === audioRef.current) {
        globalAudioRef.current = null;
      }
    }
  }, []);

  // Reset playing state when voice changes (current audio should continue, but next play will use new voice)
  useEffect(() => {
    // Don't stop current playback, just ensure next play uses new voice
  }, [selectedVoice]);

  return {
    playSentence,
    playWord,
    playUrl,
    stop,
    isPlaying,
    error,
  };
}

