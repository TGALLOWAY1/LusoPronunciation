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
      console.log(`[InteractiveWordStrip] Selecting word: "${wordToSelect.text}" (index ${wordToSelect.index ?? wordToSelect.id}, wordId: ${wordToSelect.wordId || 'none'})`);
      onWordSelected(wordToSelect);
    }
    
    // Then, play audio - prefer wordAudios array if available, then fall back to TTS
    const wordIdx = word.index ?? parseInt(word.id, 10);
    const nativeAudio = wordAudios?.find(
      a => a.type === 'native' && a.wordIndex === wordIdx
    );
    
    if (nativeAudio && audioRef.current) {
      // Prefer wordAudios when available (explicitly built for fixtures)
      console.log(`[InteractiveWordStrip] Playing native audio from wordAudios for "${word.text}" from ${nativeAudio.url}`);
      
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
        playPromise
          .then(() => {
            console.log(`[InteractiveWordStrip] Native audio started playing for "${word.text}"`);
          })
          .catch((error) => {
            console.error(`[InteractiveWordStrip] Failed to play native audio for word "${word.text}" from ${nativeAudio.url}:`, error);
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
      console.log(`[InteractiveWordStrip] No wordAudios entry found, falling back to TTS for "${word.text}" (wordId: ${word.wordId})`);
      handleTtsAudioClick(e, word);
    } else {
      console.warn(`[InteractiveWordStrip] No audio available for word "${word.text}" (index ${wordIdx}). wordId: ${word.wordId || 'none'}, wordAudios:`, wordAudios);
    }
  };

  // Sync with external state
  useEffect(() => {
    if (externalActiveWordIndex === null && internalActiveWordIndex !== null) {
      setInternalActiveWordIndex(null);
      setInternalActiveWordType(null);
    }
  }, [externalActiveWordIndex, internalActiveWordIndex]);

  const handleAudioClick = (
    e: React.MouseEvent,
    word: NormalizedWordFeedback,
    type: 'native' | 'user'
  ) => {
    e.stopPropagation();
    
    if (!audioRef.current) return;

    const wordIdx = word.index ?? parseInt(word.id, 10);
    // Find the audio variant
    const audioVariant = wordAudios?.find(
      a => a.type === type && a.wordIndex === wordIdx
    );
    
    if (!audioVariant) return;

    // Stop any currently playing audio
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Notify parent
    if (onWordStart) {
      onWordStart(wordIdx, type);
    } else {
      // Fallback to internal state if no parent callback
      setInternalActiveWordIndex(wordIdx);
      setInternalActiveWordType(type);
    }

    // Play the audio
    audioRef.current.src = audioVariant.url;
    audioRef.current.play().catch((error) => {
      console.error(`Failed to play ${type} audio for word "${word.text}":`, error);
      if (onWordStop) {
        onWordStop();
      } else {
        setInternalActiveWordIndex(null);
        setInternalActiveWordType(null);
      }
    });
  };

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
      console.log(`[InteractiveWordStrip] Word "${word.text}" has no wordId, trying native audio fallback`);
      // If no wordId, try to play native audio if available
      const wordIdx = word.index ?? parseInt(word.id, 10);
      const nativeAudio = wordAudios?.find(
        a => a.type === 'native' && a.wordIndex === wordIdx
      );
      if (nativeAudio && audioRef.current) {
        console.log(`[InteractiveWordStrip] Playing native audio for "${word.text}" from ${nativeAudio.url}`);
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
      } else {
        console.warn(`[InteractiveWordStrip] No native audio available for word "${word.text}"`);
      }
      return;
    }

    // Use global voice setting
    const audioPath = getAudioUrlForWordSync(word.wordId, selectedVoice);
    
    console.log(`[InteractiveWordStrip] Playing TTS audio for word "${word.text}" (${word.wordId}) with ${selectedVoice} voice from ${audioPath}`);

    // Stop any currently playing TTS audio
    if (ttsAudioRef.current) {
      if (activeTtsWordId === word.wordId && !ttsAudioRef.current.paused) {
        // If clicking the same word that's playing, stop it
        console.log(`[InteractiveWordStrip] Stopping currently playing audio for "${word.text}"`);
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
        console.log(`[InteractiveWordStrip] TTS audio finished`);
        setActiveTtsWordId(null);
      });
      
      ttsAudioRef.current.addEventListener('error', () => {
        const error = ttsAudioRef.current?.error;
        const errorMsg = error 
          ? `Error ${error.code}: ${error.message || 'Unknown error'}`
          : 'Unknown error';
        const currentSrc = ttsAudioRef.current?.src || 'unknown';
        console.error(`[InteractiveWordStrip] Failed to play TTS audio at path "${currentSrc}":`, errorMsg);
        setActiveTtsWordId(null);
      });
      
      ttsAudioRef.current.addEventListener('loadstart', () => {
        console.log(`[InteractiveWordStrip] TTS audio loading from ${ttsAudioRef.current?.src}`);
      });
      
      ttsAudioRef.current.addEventListener('canplay', () => {
        console.log(`[InteractiveWordStrip] TTS audio ready to play`);
      });
    }

    // Set source and load
    if (!audioPath) {
      console.error(`No audio path found for word "${word.wordId}" with voice "${selectedVoice}"`);
      return;
    }
    
    ttsAudioRef.current.src = audioPath;
    ttsAudioRef.current.load(); // Force reload the audio
    
    setActiveTtsWordId(word.wordId);
    
    // Use a function to handle the play promise with the correct word context
    const playAudio = () => {
      const playPromise = ttsAudioRef.current?.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`[InteractiveWordStrip] TTS audio started playing for "${word.text}" (${word.wordId})`);
          })
          .catch((error) => {
            console.error(`[InteractiveWordStrip] Failed to play TTS audio for word "${word.text}" (${word.wordId}):`, error);
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
          const nativeAudio = wordAudios?.find(
            a => a.type === 'native' && a.wordIndex === wordIdx
          );
          
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
                className={`transition-transform hover:scale-105 active:scale-95 ${
                  isPlaying ? 'ring-2 ring-offset-2 ring-emerald-400 dark:ring-emerald-500 rounded-full' : ''
                }`}
                title={word.wordId 
                  ? `Click to play ${selectedVoice} pronunciation and see phoneme breakdown for "${word.text}"`
                  : word.phonemes && word.phonemes.length > 0 
                    ? `Click to see phoneme breakdown for "${word.text}"`
                    : `Click to see details for "${word.text}"`
                }
              >
                <WordScoreChip word={chipWord} />
              </button>
              
              {/* Audio control buttons - only show native audio button if available */}
              {nativeAudio && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Native audio button (synthesized from phrase audio) */}
                  <button
                    onClick={(e) => handleAudioClick(e, word, 'native')}
                    className={`w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all ${
                      isNativePlaying
                        ? 'bg-emerald-500 text-white shadow-lg animate-pulse'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                    }`}
                    title="Play native pronunciation from phrase audio"
                  >
                    N
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Click a word to play its pronunciation and see detailed phoneme analysis. Use the N button (if available) to play native audio from the phrase.
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

