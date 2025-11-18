import { useRef, useState, useEffect } from 'react';
import type { WordFeedback, WordAudioVariant } from '@/types/pronunciationFixtures';
import WordScoreChip from './WordScoreChip';

interface InteractiveWordStripProps {
  words?: WordFeedback[];
  wordAudios?: WordAudioVariant[];
  activeWordIndex?: number | null;
  activeWordType?: 'native' | 'user' | null;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  onWordSelected?: (word: WordFeedback) => void;
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
  
  // Use external state if provided, otherwise manage internally
  const [internalActiveWordIndex, setInternalActiveWordIndex] = useState<number | null>(null);
  const [internalActiveWordType, setInternalActiveWordType] = useState<'native' | 'user' | null>(null);
  
  const activeWordIndex = externalActiveWordIndex !== undefined ? externalActiveWordIndex : internalActiveWordIndex;
  const activeWordType = externalActiveWordType !== undefined ? externalActiveWordType : internalActiveWordType;

  const handleWordClick = (word: WordFeedback) => {
    // Only trigger word selection, don't play audio
    if (onWordSelected) {
      onWordSelected(word);
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
    word: WordFeedback,
    type: 'native' | 'user'
  ) => {
    e.stopPropagation();
    
    if (!audioRef.current) return;

    // Find the audio variant
    const audioVariant = wordAudios?.find(
      a => a.type === type && a.wordIndex === word.index
    );
    
    if (!audioVariant) return;

    // Stop any currently playing audio
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Notify parent
    if (onWordStart) {
      onWordStart(word.index, type);
    } else {
      // Fallback to internal state if no parent callback
      setInternalActiveWordIndex(word.index);
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
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Word-by-Word Practice
      </h3>
      
      <div className="flex flex-wrap gap-2">
        {words.map((word) => {
          const nativeAudio = wordAudios?.find(
            a => a.type === 'native' && a.wordIndex === word.index
          );
          const userAudio = wordAudios?.find(
            a => a.type === 'user' && a.wordIndex === word.index
          );
          
          const isNativePlaying = activeWordIndex === word.index && activeWordType === 'native';
          const isUserPlaying = activeWordIndex === word.index && activeWordType === 'user';
          
          return (
            <div
              key={word.index}
              className="relative inline-flex items-center gap-1 group"
            >
              {/* Word chip - clickable for phoneme panel */}
              <button
                onClick={() => handleWordClick(word)}
                className={`transition-transform hover:scale-105 active:scale-95 ${
                  (isNativePlaying || isUserPlaying) ? 'ring-2 ring-offset-2 ring-emerald-400 dark:ring-emerald-500 rounded-full' : ''
                }`}
              >
                <WordScoreChip word={word} />
              </button>
              
              {/* Audio control buttons */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Native audio button */}
                {nativeAudio ? (
                  <button
                    onClick={(e) => handleAudioClick(e, word, 'native')}
                    className={`w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all ${
                      isNativePlaying
                        ? 'bg-emerald-500 text-white shadow-lg animate-pulse'
                        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                    }`}
                    title="Play native pronunciation of this word"
                  >
                    N
                  </button>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-xs flex items-center justify-center cursor-not-allowed opacity-50"
                    title="Native audio not available for this word"
                  >
                    N
                  </div>
                )}
                
                {/* User audio button */}
                {userAudio ? (
                  <button
                    onClick={(e) => handleAudioClick(e, word, 'user')}
                    className={`w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all ${
                      isUserPlaying
                        ? 'bg-blue-500 text-white shadow-lg animate-pulse'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                    }`}
                    title="Play your pronunciation of this word"
                  >
                    U
                  </button>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-xs flex items-center justify-center cursor-not-allowed opacity-50"
                    title="Your recording not available for this word"
                  >
                    U
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Click a word to see detailed phoneme analysis. Use N (native) and U (your recording) buttons to compare pronunciations.
      </p>

      {/* Shared audio element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPause={handleAudioPause}
        className="hidden"
      />
    </div>
  );
}

