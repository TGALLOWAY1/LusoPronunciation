import { useRef } from 'react';
import type { WordFeedback, WordAudioVariant } from '@/types/pronunciationFixtures';
import WordScoreChip from './WordScoreChip';

interface InteractiveWordStripProps {
  words?: WordFeedback[];
  wordAudios?: WordAudioVariant[];
  onWordSelected?: (word: WordFeedback) => void;
}

/**
 * Interactive word strip with clickable words that play audio and trigger selection.
 */
export default function InteractiveWordStrip({
  words,
  wordAudios,
  onWordSelected,
}: InteractiveWordStripProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleWordClick = (word: WordFeedback) => {
    // Play native word audio if available
    const nativeAudio = wordAudios?.find(
      a => a.type === 'native' && a.wordIndex === word.index
    );
    
    if (nativeAudio && audioRef.current) {
      audioRef.current.src = nativeAudio.url;
      audioRef.current.play().catch(console.error);
    }

    // Trigger word selection callback
    if (onWordSelected) {
      onWordSelected(word);
    }
  };

  const handleUserAudioClick = (e: React.MouseEvent, word: WordFeedback) => {
    e.stopPropagation();
    
    // Play user word audio if available
    const userAudio = wordAudios?.find(
      a => a.type === 'user' && a.wordIndex === word.index
    );
    
    if (userAudio && audioRef.current) {
      audioRef.current.src = userAudio.url;
      audioRef.current.play().catch(console.error);
    }
  };

  if (!words || words.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No word-level data available yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Interactive Word Strip
      </h3>
      
      <div className="flex flex-wrap gap-2">
        {words.map((word) => {
          const userAudio = wordAudios?.find(
            a => a.type === 'user' && a.wordIndex === word.index
          );
          
          return (
            <div key={word.index} className="relative group">
              <button
                onClick={() => handleWordClick(word)}
                className="transition-transform hover:scale-105 active:scale-95"
              >
                <WordScoreChip word={word} />
              </button>
              
              {userAudio && (
                <button
                  onClick={(e) => handleUserAudioClick(e, word)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-600"
                  title="Play your attempt"
                >
                  🎤
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Click a word to hear native pronunciation and see details. Hover for your attempt audio.
      </p>

      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

