import { useState, useRef, useEffect, useMemo } from 'react';
import type { AttemptScore } from '@/types/pronunciation';
import {
  SentenceAudioControls,
  PhraseScoreOverview,
  InteractiveWordStrip,
  PhonemePanel,
  type NormalizedWordFeedback,
  type NormalizedAudioVariant,
  type NormalizedWordAudioVariant,
} from './shared';

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

/**
 * Generic props interface for PronunciationFeedbackPanel.
 * This component can be used by both:
 * - Dev "Pronunciation Lab" page (fixtures)
 * - SentencePractice flow (live Azure attempts)
 */
export interface PronunciationFeedbackPanelProps {
  // Core scoring
  attempts: AttemptScore[];
  currentAttempt: AttemptScore | null;

  // Sentence-level context
  sentenceText: string;
  translationText?: string;
  difficulty?: number; // Optional difficulty badge

  // Audio
  sentenceAudio?: NormalizedAudioVariant[]; // native/user variants
  wordAudios?: NormalizedWordAudioVariant[]; // optional per-word audio

  // Word-level feedback
  words?: NormalizedWordFeedback[];

  // Metadata (optional)
  title?: string; // e.g. "Pronunciation Lab" vs "Practice Feedback"
  showDevControls?: boolean; // raw JSON, extra toggles, etc.
  hideHeaderContent?: boolean; // If true, hide sentence text, translation, difficulty, and sentence audio (for use in Practice where these are shown above)
}

/**
 * Main composite component for displaying pronunciation feedback.
 * Shows overall scores, audio playback, and word-by-word feedback.
 * Manages centralized audio state to ensure only one audio source plays at a time.
 * 
 * This is a generic component that can be used by both:
 * - Dev "Pronunciation Lab" page (fixtures)
 * - SentencePractice flow (live Azure attempts)
 */
export default function PronunciationFeedbackPanel({
  attempts,
  currentAttempt,
  sentenceText,
  translationText,
  difficulty,
  sentenceAudio,
  wordAudios,
  words,
  title,
  showDevControls = false,
  hideHeaderContent = false,
}: PronunciationFeedbackPanelProps) {
  const [selectedWord, setSelectedWord] = useState<NormalizedWordFeedback | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('textOnly');
  
  // Centralized audio state
  const [activeSentenceType, setActiveSentenceType] = useState<'native' | 'user' | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [activeWordType, setActiveWordType] = useState<'native' | 'user' | null>(null);
  
  // Refs for audio elements to enable stopping from parent
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);
  const wordAudioRef = useRef<HTMLAudioElement>(null);

  // Compute trend scores from attempts array (for PhraseScoreOverview)
  const trendScores = useMemo(() => {
    if (!attempts || attempts.length === 0) {
      return undefined;
    }
    // Reverse to show oldest first (for chronological trend)
    return [...attempts].reverse().map(a => a.overallAccuracy);
  }, [attempts]);

  // Reset practice mode when sentence changes (use sentenceText as key)
  useEffect(() => {
    setPracticeMode('textOnly');
    setShowEnglish(false);
  }, [sentenceText]);

  // Log practice mode when it changes (for debugging and future scoring integration)
  useEffect(() => {
    if (import.meta.env.DEV && showDevControls) {
      console.log(`[PracticeMode] Current mode: ${practiceMode} for sentence "${sentenceText}"`);
    }
    // TODO: When scoring logic is implemented, pass practiceMode to the attempt creation
    // Example: createAttempt({ ...attemptData, practiceMode })
  }, [practiceMode, sentenceText, showDevControls]);

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

  const handleWordSelected = (word: NormalizedWordFeedback) => {
    if (showDevControls) {
      console.log(`[PronunciationFeedbackPanel] Word selected: "${word.text}" (index ${word.index ?? word.id}, wordId: ${word.wordId || 'none'})`);
    }
    // Find the actual word from the normalized words array to ensure we're using the correct reference
    const actualWord = words?.find(w => {
      const wIndex = w.index ?? parseInt(w.id, 10);
      const wordIndex = word.index ?? parseInt(word.id, 10);
      return wIndex === wordIndex && w.text === word.text;
    });
    setSelectedWord(actualWord || word);
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

  // Check if we have attempts
  const hasAttempts = attempts && attempts.length > 0 && currentAttempt !== null;

  return (
    <div className="space-y-6">
      {/* Optional title */}
      {title && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
      )}

      {/* Phrase text, translation, difficulty badge, and sentence audio - hide if hideHeaderContent is true */}
      {!hideHeaderContent && (
        <>
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {sentenceText}
                </p>
                {/* English translation toggle and display */}
                {translationText && (
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
                        {translationText}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {difficulty !== undefined && (
                <span className={`badge ${getDifficultyColor(difficulty)} flex-shrink-0`}>
                  Difficulty {difficulty}
                </span>
              )}
            </div>
          </div>

          {/* Sentence audio controls */}
          {sentenceAudio && sentenceAudio.length > 0 && (
            <SentenceAudioControls
              sentenceAudio={sentenceAudio}
              activeType={activeSentenceType}
              audioRef={sentenceAudioRef}
              onStart={handleSentenceStart}
              onStop={handleSentenceStop}
            />
          )}
        </>
      )}

      {/* Empty state - no attempts yet */}
      {!hasAttempts && (
        <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Record this sentence to see your pronunciation scores and word-by-word breakdown.
          </p>
        </div>
      )}

      {/* Graphical score overview - only show when we have attempts */}
      {hasAttempts && (
        <PhraseScoreOverview
          attemptScore={currentAttempt}
          words={words}
          trendScores={trendScores}
          onWordSelected={handleWordSelected}
        />
      )}

      {/* Interactive word strip - show whenever we have word data */}
      {words && words.length > 0 && (
        <InteractiveWordStrip
          words={words}
          wordAudios={wordAudios}
          activeWordIndex={activeWordIndex}
          activeWordType={activeWordType}
          audioRef={wordAudioRef}
          onWordSelected={handleWordSelected}
          onWordStart={handleWordStart}
          onWordStop={handleWordStop}
        />
      )}

      {/* Phoneme panel - show whenever a word is selected */}
      <PhonemePanel word={selectedWord} onClose={handleClosePhonemePanel} />

      {/* Dev controls (optional, gated behind showDevControls) */}
      {showDevControls && import.meta.env.DEV && (
        <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
              Dev: Raw Data
            </summary>
            <pre className="mt-2 text-xs overflow-auto max-h-64 bg-white dark:bg-gray-900 p-2 rounded">
              {JSON.stringify({ attempts, currentAttempt, words }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

