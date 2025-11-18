import { useState, useRef } from 'react';
import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import type { WordFeedback } from '@/types/pronunciationFixtures';
import SentenceAudioControls from './SentenceAudioControls';
import PhraseScoreOverview from './PhraseScoreOverview';
import InteractiveWordStrip from './InteractiveWordStrip';
import PhonemePanel from './PhonemePanel';

interface PronunciationFeedbackPanelProps {
  phrase: PracticePhraseFromFixture;
}

/**
 * Main composite component for displaying pronunciation feedback.
 * Shows overall scores, audio playback, and word-by-word feedback.
 * Manages centralized audio state to ensure only one audio source plays at a time.
 */
export default function PronunciationFeedbackPanel({
  phrase,
}: PronunciationFeedbackPanelProps) {
  const [selectedWord, setSelectedWord] = useState<WordFeedback | null>(null);
  
  // Centralized audio state
  const [activeSentenceType, setActiveSentenceType] = useState<'native' | 'user' | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [activeWordType, setActiveWordType] = useState<'native' | 'user' | null>(null);
  
  // Refs for audio elements to enable stopping from parent
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);
  const wordAudioRef = useRef<HTMLAudioElement>(null);
  
  const currentAttemptScore = phrase.attempt;

  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1:
        return 'badge-success';
      case 2:
        return 'badge-primary';
      case 3:
        return 'badge-warning';
      case 4:
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  const handleWordSelected = (word: WordFeedback) => {
    setSelectedWord(word);
  };

  const handleClosePhonemePanel = () => {
    setSelectedWord(null);
  };

  // Sentence audio callbacks
  const handleSentenceStart = (type: 'native' | 'user') => {
    // Stop word audio if playing
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current.currentTime = 0;
    }
    // Clear word state
    setActiveWordIndex(null);
    setActiveWordType(null);
    // Set sentence state
    setActiveSentenceType(type);
  };

  const handleSentenceStop = () => {
    setActiveSentenceType(null);
  };

  // Word audio callbacks
  const handleWordStart = (wordIndex: number, type: 'native' | 'user') => {
    // Stop sentence audio if playing
    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.pause();
      sentenceAudioRef.current.currentTime = 0;
    }
    // Clear sentence state
    setActiveSentenceType(null);
    // Set word state
    setActiveWordIndex(wordIndex);
    setActiveWordType(type);
  };

  const handleWordStop = () => {
    setActiveWordIndex(null);
    setActiveWordType(null);
  };

  // Practice word handler - highlights word and plays native audio
  const handlePracticeWord = (wordIndex: number) => {
    // Find the word
    const word = phrase.words?.find((w) => w.index === wordIndex);
    if (!word) return;

    // Check if native audio exists for this word
    const nativeAudio = phrase.wordAudios?.find(
      (a) => a.type === 'native' && a.wordIndex === wordIndex
    );

    if (!nativeAudio) {
      // If no native audio, just open the phoneme panel
      setSelectedWord(word);
      return;
    }

    // Stop sentence audio if playing
    if (sentenceAudioRef.current) {
      sentenceAudioRef.current.pause();
      sentenceAudioRef.current.currentTime = 0;
    }

    // Clear sentence state
    setActiveSentenceType(null);

    // Set word state and play native audio
    setActiveWordIndex(wordIndex);
    setActiveWordType('native');

    // Play the native audio
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current.currentTime = 0;
      wordAudioRef.current.src = nativeAudio.url;
      wordAudioRef.current.play().catch((error) => {
        console.error(`Failed to play native audio for word "${word.text}":`, error);
        setActiveWordIndex(null);
        setActiveWordType(null);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* How to use this lab */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          📚 How to use this lab
        </h3>
        <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
          <li>Listen to the native sentence to hear the target pronunciation.</li>
          <li>Compare with your recording to identify differences.</li>
          <li>Click words to hear native vs your pronunciation side-by-side.</li>
          <li>Open word details to fix difficult sounds and track your progress.</li>
        </ol>
      </div>

      {/* Phrase text and difficulty badge */}
      <div>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {phrase.text}
        </p>
        <span className={`badge ${getDifficultyColor(phrase.difficulty)}`}>
          Difficulty {phrase.difficulty}
        </span>
      </div>

      {/* Sentence audio controls */}
      <SentenceAudioControls
        sentenceAudio={phrase.sentenceAudio}
        activeType={activeSentenceType}
        audioRef={sentenceAudioRef}
        onStart={handleSentenceStart}
        onStop={handleSentenceStop}
      />

      {/* Graphical score overview */}
      <PhraseScoreOverview
        attemptScore={currentAttemptScore}
        words={phrase.words}
        onWordSelected={handleWordSelected}
        onPracticeWord={handlePracticeWord}
      />

      {/* Interactive word strip */}
      <InteractiveWordStrip
        words={phrase.words}
        wordAudios={phrase.wordAudios}
        activeWordIndex={activeWordIndex}
        activeWordType={activeWordType}
        audioRef={wordAudioRef}
        onWordSelected={handleWordSelected}
        onWordStart={handleWordStart}
        onWordStop={handleWordStop}
      />

      {/* Phoneme panel */}
      <PhonemePanel word={selectedWord} onClose={handleClosePhonemePanel} />
    </div>
  );
}

