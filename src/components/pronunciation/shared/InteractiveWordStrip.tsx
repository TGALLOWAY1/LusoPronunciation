import { useRef, useState, useEffect } from 'react';
import type { NormalizedWordFeedback, NormalizedWordAudioVariant } from './types';
import { useSettingsStore } from '@/state/settingsStore';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';
import WordScoreChip from '../WordScoreChip';

interface InteractiveWordStripProps {
  words?: NormalizedWordFeedback[];
  wordAudios?: NormalizedWordAudioVariant[];
  activeWordIndex?: number | null;
  activeWordType?: 'native' | 'user' | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  onWordSelected?: (word: NormalizedWordFeedback) => void;
  onWordStart?: (wordIndex: number, type: 'native' | 'user') => void;
  onWordStop?: () => void;
}

/**
 * Interactive word strip with clickable words that play audio and trigger selection.
 * Each word has separate controls for native and user audio playback.
 * Coordinates with parent to ensure only one audio source plays at a time.
 */
export default function InteractiveWordStrip({
  words,
  wordAudios,
  activeWordIndex: externalActiveWordIndex = null,
  activeWordType: externalActiveWordType = null,
  audioRef: externalAudioRef,
  onWordSelected,
  onWordStart,
  onWordStop,
}: InteractiveWordStripProps) {
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  const audioRef = externalAudioRef || internalAudioRef;
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use external state if provided, otherwise manage internally
  const [internalActiveWordIndex, setInternalActiveWordIndex] = useState<number | null>(null);
  const [internalActiveWordType, setInternalActiveWordType] = useState<'native' | 'user' | null>(null);
  const [activeTtsWordId, setActiveTtsWordId] = useState<string | null>(null);
  
  const activeWordIndex = externalActiveWordIndex !== undefined ? externalActiveWordIndex : internalActiveWordIndex;
  const activeWordType = externalActiveWordType !== undefined ? externalActiveWordType : internalActiveWordType;

  // Use global voice setting
  const { selectedVoice } = useSettingsStore();

  const handleWordClick = (word: NormalizedWordFeedback, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // First, trigger word selection for phoneme panel (do this first to ensure correct word is selected)
    // Use the word object directly from the words array to ensure we're using the correct reference
    // Match by both index and text to ensure we get the exact word
    const wordIndex = word.index ?? parseInt(word.id, 10);
    const actualWord = words?.find(w => {
      const wIndex = w.index ?? parseInt(w.id, 10);
      return wIndex === wordIndex && w.text === word.text;
    });
    const wordToSelect = actualWord || word;
    
    if (onWordSelected) {
      onWordSelected(wordToSelect);
    }
    
    // Then, play audio - prefer wordAudios array if available, then fall back to TTS
    const wordIdx = word.index ?? parseInt(word.id, 10);
    const nativeAudio = wordAudios?.find(
      a => a.type === 'native' && a.wordIndex === wordIdx
    );
    
    // Guard against missing audio URL
    if (nativeAudio && nativeAudio.url && audioRef.current) {
      // Stop any currently playing audio (both TTS and native)
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
      }
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      
      // Clear TTS state
      setActiveTtsWordId(null);
      
      // Notify parent
      if (onWordStart) {
        onWordStart(wordIdx, 'native');
      } else {
        setInternalActiveWordIndex(wordIdx);
        setInternalActiveWordType('native');
      }
      
      // Set source and load
      audioRef.current.src = nativeAudio.url;
      audioRef.current.load();
      
      // Play the native audio
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error(`Failed to play audio for word "${word.text}":`, error);
          if (onWordStop) {
            onWordStop();
          } else {
            setInternalActiveWordIndex(null);
            setInternalActiveWordType(null);
          }
        });
      }
    } else if (word.wordId) {
      // Fall back to TTS audio if wordAudios not available but wordId exists
      handleTtsAudioClick(e, word);
    }
  };

  // Sync with external state
  useEffect(() => {
    if (externalActiveWordIndex === null && internalActiveWordIndex !== null) {
      setInternalActiveWordIndex(null);
      setInternalActiveWordType(null);
    }
  }, [externalActiveWordIndex, internalActiveWordIndex]);

  const handleAudioEnded = () => {
    if (onWordStop) {
      onWordStop();
    } else {
      setInternalActiveWordIndex(null);
      setInternalActiveWordType(null);
    }
  };

  const handleAudioPause = () => {
    if (onWordStop) {
      onWordStop();
    } else {
      setInternalActiveWordIndex(null);
      setInternalActiveWordType(null);
    }
  };

  // Handle TTS audio playback (synthesized word audio)
  const handleTtsAudioClick = (e: React.MouseEvent, word: NormalizedWordFeedback) => {
    e.stopPropagation();
    
    if (!word.wordId) {
      // If no wordId, try to play native audio if available
      const wordIdx = word.index ?? parseInt(word.id, 10);
      const nativeAudio = wordAudios?.find(
        a => a.type === 'native' && a.wordIndex === wordIdx
      );
      // Guard against missing audio URL
      if (nativeAudio && nativeAudio.url && audioRef.current) {
        // Stop any currently playing audio
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        // Notify parent
        if (onWordStart) {
          onWordStart(wordIdx, 'native');
        } else {
          setInternalActiveWordIndex(wordIdx);
          setInternalActiveWordType('native');
        }
        
        // Play the native audio
        audioRef.current.src = nativeAudio.url;
        audioRef.current.play().catch((error) => {
          console.error(`Failed to play native audio for word "${word.text}":`, error);
          if (onWordStop) {
            onWordStop();
          } else {
            setInternalActiveWordIndex(null);
            setInternalActiveWordType(null);
          }
        });
      }
      return;
    }

    // Use global voice setting
    const audioPath = getAudioUrlForWordSync(word.wordId, selectedVoice);
    
    // Guard against missing audio URL
    if (!audioPath) {
      return;
    }

    // Stop any currently playing TTS audio
    if (ttsAudioRef.current) {
      if (activeTtsWordId === word.wordId && !ttsAudioRef.current.paused) {
        // If clicking the same word that's playing, stop it
        ttsAudioRef.current.pause();
        ttsAudioRef.current.currentTime = 0;
        setActiveTtsWordId(null);
        return;
      }
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }

    // Also stop native/user audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (onWordStop) {
      onWordStop();
    } else {
      setInternalActiveWordIndex(null);
      setInternalActiveWordType(null);
    }

    // Create audio element if it doesn't exist
    if (!ttsAudioRef.current) {
      ttsAudioRef.current = new Audio();
      
      ttsAudioRef.current.addEventListener('ended', () => {
        setActiveTtsWordId(null);
      });
      
      ttsAudioRef.current.addEventListener('error', () => {
        const error = ttsAudioRef.current?.error;
        const errorMsg = error 
          ? `Error ${error.code}: ${error.message || 'Unknown error'}`
          : 'Unknown error';
        console.error(`Failed to play TTS audio:`, errorMsg);
        setActiveTtsWordId(null);
      });
    }

    // Set source and load (audioPath already validated above)
    ttsAudioRef.current.src = audioPath;
    ttsAudioRef.current.load(); // Force reload the audio
    
    setActiveTtsWordId(word.wordId);
    
    // Use a function to handle the play promise with the correct word context
    const playAudio = () => {
      const playPromise = ttsAudioRef.current?.play();
      
      if (playPromise !== undefined) {
        playPromise
          .catch((error) => {
            console.error(`Failed to play TTS audio for word "${word.text}":`, error);
            setActiveTtsWordId(null);
          });
      }
    };
    
    // Wait for audio to be ready, or play immediately if already ready
    if (ttsAudioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
      playAudio();
    } else {
      ttsAudioRef.current.addEventListener('canplay', playAudio, { once: true });
    }
  };

  // Cleanup TTS audio on unmount
  useEffect(() => {
    return () => {
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
    };
  }, []);

  if (!words || words.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Word-by-word analysis will appear here after you practice this sentence.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Word-by-Word Practice
        </h3>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {words.map((word) => {
          const wordIdx = word.index ?? parseInt(word.id, 10);
          const isNativePlaying = activeWordIndex === wordIdx && activeWordType === 'native';
          const isTtsPlaying = activeTtsWordId === word.wordId;
          const isPlaying = isNativePlaying || isTtsPlaying;
          
          // Convert NormalizedWordFeedback to WordFeedback format for WordScoreChip
          // WordScoreChip expects WordFeedback from pronunciationFixtures, so we adapt
          const chipWord: {
            index: number;
            text: string;
            score: number;
            level: 'excellent' | 'good' | 'ok' | 'practice';
            errorType?: string;
            phonemes?: Array<{
              symbol: string;
              score: number;
              exampleWord?: string;
              tip?: string;
              isProblem?: boolean;
            }>;
            wordId?: string;
          } = {
            index: wordIdx,
            text: word.text,
            score: word.accuracyScore,
            level: (word.level || (word.accuracyScore >= 90 ? 'excellent' : word.accuracyScore >= 80 ? 'good' : word.accuracyScore >= 70 ? 'ok' : 'practice')) as 'excellent' | 'good' | 'ok' | 'practice',
            errorType: word.errorType || undefined,
            phonemes: word.phonemes,
            wordId: word.wordId,
          };
          
          return (
            <div
              key={word.id}
              className="relative inline-flex items-center gap-1 group"
            >
              {/* Word chip - clickable to play audio and show phoneme panel */}
              <button
                onClick={(e) => handleWordClick(word, e)}
                className={`transition-all duration-200 hover:scale-105 active:scale-95 ${
                  isPlaying 
                    ? 'ring-2 ring-offset-2 ring-emerald-400 dark:ring-emerald-500 rounded-full bg-emerald-50 dark:bg-emerald-900/20 shadow-md' 
                    : ''
                }`}
                title={`Play pronunciation: ${word.text}`}
              >
                <WordScoreChip word={chipWord} />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Click a word to play its pronunciation and see detailed phoneme analysis.
      </p>

      {/* Shared audio element for native/user audio */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPause={handleAudioPause}
        className="hidden"
      />
      {/* TTS audio element */}
      <audio
        ref={ttsAudioRef}
        className="hidden"
      />
    </div>
  );
}
