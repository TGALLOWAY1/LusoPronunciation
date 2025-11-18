import { useRef, useState } from 'react';
import type { AudioVariant } from '@/types/pronunciationFixtures';

interface SentenceAudioControlsProps {
  sentenceAudio: AudioVariant[];
}

/**
 * Interactive controls for playing native vs user sentence audio.
 */
export default function SentenceAudioControls({ sentenceAudio }: SentenceAudioControlsProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [activeType, setActiveType] = useState<'native' | 'user' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const nativeAudio = sentenceAudio.find(a => a.type === 'native');
  const userAudio = sentenceAudio.find(a => a.type === 'user');

  const handlePlay = (type: 'native' | 'user', url: string) => {
    if (!audioRef.current) return;

    // Stop current playback
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    // Set new source and play
    audioRef.current.src = url;
    setActiveType(type);
    setIsPlaying(true);
    audioRef.current.play().catch(console.error);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setActiveType(null);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Audio Comparison
      </h3>
      
      <div className="flex gap-3">
        {nativeAudio && (
          <button
            onClick={() => handlePlay('native', nativeAudio.url)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeType === 'native' && isPlaying
                ? 'bg-emerald-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            🔊 Native Sentence
          </button>
        )}
        
        {userAudio && (
          <button
            onClick={() => handlePlay('user', userAudio.url)}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeType === 'user' && isPlaying
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            🎤 Your Recording
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

