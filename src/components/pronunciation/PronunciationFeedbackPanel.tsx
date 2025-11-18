import { useState, useRef, useEffect } from 'react';
import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import type { WordFeedback } from '@/types/pronunciationFixtures';
import SentenceAudioControls from './SentenceAudioControls';
import PhraseScoreOverview from './PhraseScoreOverview';
import InteractiveWordStrip from './InteractiveWordStrip';
import PhonemePanel from './PhonemePanel';

/**
 * Practice mode represents how the user is practicing pronunciation.
 * This is used by scoring logic to differentiate between practice approaches.
 * 
 * - 'textOnly': User is reading the sentence without hearing native audio
 * - 'audioPlusText': User has heard native audio while seeing the text
 * - 'audioOnly': User is practicing by listening only (no text visible)
 * 
 * TODO: When scoring logic is implemented, use this mode to adjust scoring
 * or provide different feedback based on the practice approach.
 */
export type PracticeMode = 'textOnly' | 'audioPlusText' | 'audioOnly';

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
  const [showEnglish, setShowEnglish] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('textOnly');
  
  // Centralized audio state
  const [activeSentenceType, setActiveSentenceType] = useState<'native' | 'user' | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [activeWordType, setActiveWordType] = useState<'native' | 'user' | null>(null);
  
  // Refs for audio elements to enable stopping from parent
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);
  const wordAudioRef = useRef<HTMLAudioElement>(null);
  
  const currentAttemptScore = phrase.attempt;

  // Reset practice mode when phrase changes
  useEffect(() => {
    setPracticeMode('textOnly');
    setShowEnglish(false);
  }, [phrase.id]);

  // Log practice mode when it changes (for debugging and future scoring integration)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log(`[PracticeMode] Current mode: ${practiceMode} for phrase "${phrase.id}"`);
    }
    // TODO: When scoring logic is implemented, pass practiceMode to the attempt creation
    // Example: createAttempt({ ...attemptData, practiceMode })
  }, [practiceMode, phrase.id]);

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
    
    // Update practice mode when native audio is played
    // If text is visible (which it always is in this view), mode becomes 'audioPlusText'
    if (type === 'native') {
      setPracticeMode('audioPlusText');
    }
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

  // Note: Practice word handler removed - practice functionality will be on
  // dedicated Practice Words page. See BACKLOG.md for future implementation.

  return (
    <div className="space-y-6">
      {/* Phrase text and difficulty badge */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div className="flex-1">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {phrase.text}
            </p>
            {/* English translation toggle and display */}
            {phrase.translationEn && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowEnglish(!showEnglish)}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                  aria-label={showEnglish ? 'Hide English translation' : 'Show English translation'}
                >
                  {showEnglish ? '▼' : '▶'} {showEnglish ? 'Hide English' : 'Show English'}
                </button>
                {showEnglish && (
                  <p className="text-lg text-gray-600 dark:text-gray-400 italic">
                    {phrase.translationEn}
                  </p>
                )}
              </div>
            )}
          </div>
          <span className={`badge ${getDifficultyColor(phrase.difficulty)} flex-shrink-0`}>
            Difficulty {phrase.difficulty}
          </span>
        </div>
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

