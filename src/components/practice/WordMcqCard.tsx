import { memo, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import type { Word } from '@/lib/types';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import WordAudioButton from './WordAudioButton';
import WordStatusBar from './WordStatusBar';

interface WordMcqCardProps {
  word: Word;
  sessionId: string | null;
  directionMode: 'pt-to-en' | 'en-to-pt' | 'mixed';
  allWords: Word[]; // All words in the current practice set for distractor generation
  status?: 'new' | 'learning' | 'review' | 'known';
  onKnowIt?: (wordId: string) => void;
  onReviewLater?: (wordId: string) => void;
}

/**
 * Multiple-choice question card for vocabulary recall practice.
 * Shows either PT→EN or EN→PT questions based on directionMode.
 */
function WordMcqCard({ 
  word, 
  sessionId, 
  directionMode, 
  allWords,
  status,
  onKnowIt,
  onReviewLater,
}: WordMcqCardProps) {
  const { logWordAttempt } = usePracticeLogStore();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const cardStartTimeRef = useRef<number>(Date.now());
  
  // Determine card direction (stable for this card instance)
  // Use a ref to store the random direction for mixed mode so it doesn't change on re-renders
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

  // Generate question and options
  const { promptText, correctAnswer, options } = useMemo(() => {
    const prompt = cardDirection === 'pt-to-en' ? word.textPt : word.translationEn;
    const correct = cardDirection === 'pt-to-en' ? word.translationEn : word.textPt;
    
    // Generate distractors from other words
    // First try same category + similar difficulty, then fall back to same category, then any word
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
    
    // Shuffle and take up to 3 distractors
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const distractors = shuffled
      .slice(0, 3)
      .map(w => {
        const text = cardDirection === 'pt-to-en' ? w.translationEn : w.textPt;
        return text;
      })
      .filter((text): text is string => text !== undefined && text !== '' && text !== correct);
    
    // Combine correct answer with distractors
    const allOptions = [correct, ...distractors];
    
    // Remove duplicates
    const uniqueOptions = Array.from(new Set(allOptions));
    
    // Shuffle options (Fisher-Yates shuffle for better randomness)
    for (let i = uniqueOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [uniqueOptions[i], uniqueOptions[j]] = [uniqueOptions[j], uniqueOptions[i]];
    }
    
    // Ensure we have at least 2 options (correct + at least 1 distractor)
    // If we don't have enough, pad with placeholder
    if (uniqueOptions.length < 2) {
      uniqueOptions.push('...');
    }
    
    return {
      promptText: prompt,
      correctAnswer: correct,
      options: uniqueOptions.slice(0, 4), // Max 4 options
    };
  }, [word, cardDirection, allWords]);

  // Reset state when word changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    cardStartTimeRef.current = Date.now();
  }, [word.id]);

  const handleAnswerSelect = useCallback((answer: string) => {
    if (hasAnswered) return; // Prevent multiple selections
    
    setSelectedAnswer(answer);
    setHasAnswered(true);
    
    const isCorrect = answer === correctAnswer;
    const latencyMs = Date.now() - cardStartTimeRef.current;
    
    // Log the attempt
    if (sessionId) {
      try {
        logWordAttempt({
          sessionId,
          wordId: word.id,
          difficulty: word.difficulty,
          category: word.categoryId,
          overallScore: isCorrect ? 100 : 0,
          accuracyScore: isCorrect ? 100 : 0,
          practiceMode: 'text-mcq',
          practiceDirection: cardDirection,
          isCorrect,
          latencyMs,
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Failed to log Multiple Choice attempt:', error);
        }
      }
    }
    
    // Auto-advance after showing feedback (optional - can be handled by parent)
    // For now, we'll let the parent handle navigation
  }, [hasAnswered, correctAnswer, sessionId, word, cardDirection, logWordAttempt]);

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
    1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const difficultyLabels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };

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

      {/* Prompt text - large and prominent */}
      <div className="mb-6 text-center">
        <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {promptText}
        </p>
        {cardDirection === 'pt-to-en' && (
          <div className="flex justify-center">
            <WordAudioButton wordId={word.id} label="Play" compact={true} />
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          {cardDirection === 'pt-to-en' ? 'Select the English translation' : 'Select the Portuguese word'}
        </p>
      </div>

      {/* Answer options */}
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

export default memo(WordMcqCard);

