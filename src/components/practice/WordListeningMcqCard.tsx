import { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import type { Word } from '@/lib/types';
import { useSettingsStore } from '@/state/settingsStore';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import PremiumPlayButton from '@/components/common/PremiumPlayButton';
import WordStatusBar from './WordStatusBar';

interface WordListeningMcqCardProps {
  word: Word;
  sessionId: string | null;
  directionMode: 'pt-to-en' | 'en-to-pt' | 'mixed';
  allWords: Word[]; // All words in the current practice set for distractor generation
  status?: 'new' | 'learning' | 'review' | 'known';
  onAttemptLogged?: (attempt: any) => void; // WordPracticeAttempt (without attemptId, userId, createdAt)
  onKnowIt?: (wordId: string) => void;
  onReviewLater?: (wordId: string) => void;
}

/**
 * Listening-only multiple-choice question card for vocabulary practice.
 * 
 * User listens to audio and selects the correct word/translation from options.
 * 
 * Multiple Choice approach: User hears Portuguese audio and selects the correct Portuguese word (textPt)
 * from a list of Portuguese words. This tests listening comprehension.
 */
function WordListeningMcqCard({ 
  word, 
  sessionId, 
  directionMode,
  allWords,
  status,
  onAttemptLogged,
  onKnowIt,
  onReviewLater,
}: WordListeningMcqCardProps) {
  const { selectedVoice } = useSettingsStore();
  const { logWordAttempt } = usePracticeLogStore();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const cardStartTimeRef = useRef<number>(Date.now());
  const firstPlayTimeRef = useRef<number | null>(null);
  
  // Determine card direction (stable for this card instance)
  const mixedDirectionRef = useRef<'pt-to-en' | 'en-to-pt' | null>(null);
  
  const cardDirection = useMemo<'pt-to-en' | 'en-to-pt'>(() => {
    if (directionMode !== 'mixed') {
      return directionMode;
    }
    // For mixed mode, randomly choose direction but keep it stable for this word
    if (mixedDirectionRef.current === null) {
      mixedDirectionRef.current = Math.random() < 0.5 ? 'pt-to-en' : 'en-to-pt';
    }
    return mixedDirectionRef.current;
  }, [directionMode]);
  
  // Reset mixed direction ref when word changes
  useEffect(() => {
    if (directionMode === 'mixed') {
      mixedDirectionRef.current = null;
    }
  }, [word.id, directionMode]);

  // Get audio URL for the word
  const audioUrl = useMemo(() => {
    try {
      const voiceId = selectedVoice === 'male' ? 'male' : 'female';
      return getAudioUrlForWordSync(word.id, voiceId);
    } catch (error) {
      console.error('Error getting audio URL for word:', error);
      return null;
    }
  }, [word.id, selectedVoice]);

  // Check if audio is available
  const hasAudio = audioUrl !== null && audioUrl !== undefined;

  // Use audio player hook to track playback
  const { play, pause, isPlaying, isLoading, error: audioPlayerError } = useAudioPlayer(audioUrl);
  const prevIsPlayingRef = useRef(false);

  // Track when audio starts playing for latency measurement
  useEffect(() => {
    if (isPlaying && !prevIsPlayingRef.current && firstPlayTimeRef.current === null) {
      // Audio just started playing
      firstPlayTimeRef.current = Date.now();
    }
    prevIsPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Generate question and options
  // Approach: User hears Portuguese audio, selects correct Portuguese word (textPt) from options
  const { correctAnswer, options } = useMemo(() => {
    // Correct answer is the Portuguese word (textPt)
    const correct = word.textPt;
    
    // Generate distractors from other words in the same category
    let candidates = allWords.filter(w => 
      w.id !== word.id && 
      w.categoryId === word.categoryId &&
      Math.abs(w.difficulty - word.difficulty) <= 1
    );
    
    if (candidates.length < 3) {
      // Fall back to same category only
      candidates = allWords.filter(w => 
        w.id !== word.id && 
        w.categoryId === word.categoryId
      );
    }
    
    if (candidates.length < 3) {
      // Fall back to any word
      candidates = allWords.filter(w => w.id !== word.id);
    }
    
    // Shuffle and take up to 3 distractors (Portuguese words)
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const distractors = shuffled
      .slice(0, 3)
      .map(w => w.textPt)
      .filter((text): text is string => text !== undefined && text !== '' && text !== correct);
    
    // Combine correct answer with distractors
    const allOptions = [correct, ...distractors];
    
    // Remove duplicates
    const uniqueOptions = Array.from(new Set(allOptions));
    
    // Shuffle options (Fisher-Yates shuffle)
    for (let i = uniqueOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
    }
    
    // Ensure we have at least 2 options
    if (uniqueOptions.length < 2) {
      uniqueOptions.push('...');
    }
    
    return {
      correctAnswer: correct,
      options: uniqueOptions.slice(0, 4), // Max 4 options
    };
  }, [word, allWords]);

  // Reset state when word changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setAudioError(null);
    cardStartTimeRef.current = Date.now();
    firstPlayTimeRef.current = null;
    prevIsPlayingRef.current = false;
  }, [word.id]);


  const handleAnswerSelect = useCallback((answer: string) => {
    if (hasAnswered) return; // Prevent multiple selections
    
    setSelectedAnswer(answer);
    setHasAnswered(true);
    
    const isCorrect = answer === correctAnswer;
    
    // Calculate latency: time from first audio play (or card mount if audio not played) to answer
    const latencyMs = firstPlayTimeRef.current
      ? Date.now() - firstPlayTimeRef.current
      : Date.now() - cardStartTimeRef.current;
    
    // Create WordPracticeAttempt (without attemptId, userId, createdAt - these are added by logWordAttempt)
    const attempt = {
      sessionId: sessionId || '',
      wordId: word.id,
      difficulty: word.difficulty,
      category: word.categoryId,
      overallScore: isCorrect ? 100 : 0,
      accuracyScore: isCorrect ? 100 : 0,
      practiceMode: 'listening-mcq' as const,
      practiceDirection: cardDirection,
      isCorrect,
      latencyMs,
    };
    
    // Call onAttemptLogged if provided
    if (onAttemptLogged) {
      onAttemptLogged(attempt);
    }
  }, [hasAnswered, correctAnswer, sessionId, word, cardDirection, onAttemptLogged]);

  const getAnswerButtonClass = useCallback((option: string) => {
    if (!hasAnswered) {
      return 'btn btn-outline btn-md w-full text-left justify-start hover:btn-primary';
    }
    
    if (option === correctAnswer) {
      return 'btn btn-success btn-md w-full text-left justify-start';
    }
    
    if (option === selectedAnswer && option !== correctAnswer) {
      return 'btn btn-error btn-md w-full text-left justify-start';
    }
    
    return 'btn btn-outline btn-md w-full text-left justify-start opacity-50';
  }, [hasAnswered, correctAnswer, selectedAnswer]);

  const difficultyColors = {
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  };

  const difficultyLabels = {
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
  };

  // If no audio available, show message and allow skipping
  if (!hasAudio) {
    return (
      <div className="card card-hover card-compact relative">
        {/* Header with status */}
        {status && (
          <div className="mb-4">
            <WordStatusBar status={status} />
          </div>
        )}
        <div className="text-center p-8">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No audio available for this word.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Word: <span className="font-semibold">{word.textPt}</span> ({word.translationEn})
          </p>
          {(onKnowIt || onReviewLater) && (
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {onKnowIt && (
                <button
                  onClick={() => onKnowIt(word.id)}
                  className="btn btn-success btn-sm"
                >
                  ✓ Know it
                </button>
              )}
              {onReviewLater && (
                <button
                  onClick={() => onReviewLater(word.id)}
                  className="btn btn-secondary btn-sm"
                >
                  ⏰ Review later
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card card-hover card-compact relative">
      {/* Header with status, category and difficulty */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {status && <WordStatusBar status={status} />}
          <span className="badge badge-secondary">
            {word.categoryLabelEn}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {word.difficultForEnglish && (
            <span className="badge badge-warning">
              ⚠️ Tricky
            </span>
          )}
          <span
            className={`badge ${difficultyColors[word.difficulty]}`}
          >
            {difficultyLabels[word.difficulty]}
          </span>
        </div>
      </div>

      {/* Audio playback - prominent and centered */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
          Listen to the audio and select the correct word
        </p>
        <div className="flex justify-center items-center gap-3">
          <PremiumPlayButton
            isPlaying={isPlaying}
            onClick={isPlaying ? pause : play}
            disabled={isLoading || !hasAudio}
            size="lg"
          />
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {isLoading ? 'Loading...' : isPlaying ? 'Playing...' : 'Play Audio'}
          </div>
        </div>
        {audioPlayerError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Error playing audio: {audioPlayerError.message}
          </p>
        )}
        {audioError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">{audioError}</p>
        )}
      </div>

      {/* Answer options - Portuguese words */}
      <div className="space-y-2 mb-4">
        {options.map((option, index) => (
          <button
            key={`${option}-${index}`}
            type="button"
            onClick={() => handleAnswerSelect(option)}
            disabled={hasAnswered}
            className={getAnswerButtonClass(option)}
          >
            <span className="flex-1">{option}</span>
            {hasAnswered && option === correctAnswer && (
              <span className="ml-2">✓</span>
            )}
            {hasAnswered && option === selectedAnswer && option !== correctAnswer && (
              <span className="ml-2">✗</span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback message */}
      {hasAnswered && (
        <div className={`mb-4 p-3 rounded text-sm ${
          selectedAnswer === correctAnswer
            ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 dark:border-green-500'
            : 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500'
        }`}>
          <p className={
            selectedAnswer === correctAnswer
              ? 'text-green-800 dark:text-green-300'
              : 'text-red-800 dark:text-red-300'
          }>
            {selectedAnswer === correctAnswer
              ? '✓ Correct!'
              : `✗ Incorrect. The correct answer is: ${correctAnswer}`
            }
          </p>
          {hasAnswered && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Translation: {word.translationEn}
            </p>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(onKnowIt || onReviewLater) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {onKnowIt && (
            <button
              onClick={() => {
                // Log self-rating attempt
                if (sessionId) {
                  try {
                    logWordAttempt({
                      sessionId,
                      wordId: word.id,
                      difficulty: word.difficulty,
                      category: word.categoryId,
                      overallScore: 0,
                      accuracyScore: 0,
                      practiceMode: 'self-rating',
                      selfRating: 'know',
                    });
                  } catch (error) {
                    if (import.meta.env.DEV) {
                      console.warn('Failed to log self-rating attempt:', error);
                    }
                  }
                }
                onKnowIt(word.id);
              }}
              className="btn btn-success btn-sm flex-1"
            >
              ✓ Know it
            </button>
          )}
          {onReviewLater && (
            <button
              onClick={() => {
                // Log self-rating attempt
                if (sessionId) {
                  try {
                    logWordAttempt({
                      sessionId,
                      wordId: word.id,
                      difficulty: word.difficulty,
                      category: word.categoryId,
                      overallScore: 0,
                      accuracyScore: 0,
                      practiceMode: 'self-rating',
                      selfRating: 'dont_know',
                    });
                  } catch (error) {
                    if (import.meta.env.DEV) {
                      console.warn('Failed to log self-rating attempt:', error);
                    }
                  }
                }
                onReviewLater(word.id);
              }}
              className="btn btn-secondary btn-sm flex-1"
            >
              ❓ Don't know it yet
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(WordListeningMcqCard);
