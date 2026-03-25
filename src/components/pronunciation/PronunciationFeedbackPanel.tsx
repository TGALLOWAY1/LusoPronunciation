import { useState, useRef, useEffect, useMemo } from 'react';
import type { AttemptScore } from '@/types/pronunciation';
import InteractiveSentenceDisplay from '@/components/practice/InteractiveSentenceDisplay';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  SentenceAudioControls,
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
  showDifficultyBadge?: boolean;
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
  words,
  title,
  showDevControls = false,
  hideHeaderContent = false,
  showDifficultyBadge = true,
}: PronunciationFeedbackPanelProps) {
  const [selectedWord, setSelectedWord] = useState<NormalizedWordFeedback | null>(null);
  const [showEnglish, setShowEnglish] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('textOnly');
  
  // Centralized audio state
  const [activeSentenceType, setActiveSentenceType] = useState<'native' | 'user' | null>(null);
  
  // Refs for audio elements to enable stopping from parent
  const sentenceAudioRef = useRef<HTMLAudioElement>(null);

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

  const handleInteractiveWordClick = (wordData: any, index: number) => {
    const normalizedWord: NormalizedWordFeedback | undefined =
      wordData?.normalizedWord ?? words?.[index];

    if (normalizedWord) {
      handleWordSelected(normalizedWord);
    }
  };

  // Note: Practice word handler removed - practice functionality will be on
  // dedicated Practice Words page. See BACKLOG.md for future implementation.

  // Check if we have attempts
  const hasAttempts = attempts && attempts.length > 0 && currentAttempt !== null;

  const tokenWordScores = useMemo(() => {
    const tokens = sentenceText.trim().split(/\s+/);
    return tokens.map((token, index) => {
      const normalizedWord =
        words?.find((w) => {
          if (w.index !== undefined) {
            return w.index === index;
          }
          const parsedIndex = Number.isFinite(Number(w.id)) ? Number(w.id) : undefined;
          return parsedIndex === index;
        }) ?? (words ? words[index] : undefined);

      return {
        word: token,
        overallScore: normalizedWord?.score ?? normalizedWord?.accuracyScore ?? 0,
        normalizedWord,
      };
    });
  }, [sentenceText, words]);

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
          <div className="mb-6">
            {/* Difficulty badge - positioned above sentence */}
            {showDifficultyBadge && difficulty !== undefined && (
              <div className="mb-4 flex justify-center">
                <span className={`badge ${getDifficultyColor(difficulty)}`}>
                  Difficulty {difficulty}
                </span>
              </div>
            )}

            <div className="flex flex-col items-center gap-y-2">
              <InteractiveSentenceDisplay
                sentenceText={sentenceText}
                wordScores={tokenWordScores}
                onWordClick={handleInteractiveWordClick}
              />

              {translationText && (
                <button
                  type="button"
                  onClick={() => setShowEnglish((prev) => !prev)}
                  className="text-gray-300 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 cursor-pointer transition-colors"
                  aria-pressed={showEnglish}
                  aria-label={showEnglish ? 'Hide translation' : 'Show translation'}
                >
                  {showEnglish ? (
                    <ChevronUp size={20} className="w-5 h-5" />
                  ) : (
                    <ChevronDown size={20} className="w-5 h-5" />
                  )}
                </button>
              )}

              {translationText && showEnglish && (
                <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 italic text-center">
                  {translationText}
                </p>
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

      {/* Sound Details / Phoneme panel - always shown with empty state when no word selected */}
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
