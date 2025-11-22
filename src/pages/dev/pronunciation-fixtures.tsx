import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllPracticePhrasesFromFixtures, type PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import { PronunciationFeedbackPanel, type PronunciationFeedbackPanelProps } from '@/components/pronunciation';
import {
  adaptFixtureWordsToNormalized,
  type NormalizedAudioVariant,
  type NormalizedWordAudioVariant,
} from '@/components/pronunciation/shared';
import type { AudioVariant, WordAudioVariant } from '@/types/pronunciationFixtures';

/**
 * Adapter functions to convert fixture data to generic PronunciationFeedbackPanel props.
 */

/**
 * Converts fixture sentence audio to normalized format.
 */
function adaptFixtureSentenceAudio(
  phrase: PracticePhraseFromFixture
): NormalizedAudioVariant[] {
  return phrase.sentenceAudio.map((audio: AudioVariant) => ({
    type: audio.type,
    url: audio.url,
  }));
}

/**
 * Converts fixture word audio to normalized format.
 */
function adaptFixtureWordAudio(
  phrase: PracticePhraseFromFixture
): NormalizedWordAudioVariant[] | undefined {
  if (!phrase.wordAudios) return undefined;
  return phrase.wordAudios.map((audio: WordAudioVariant) => ({
    type: audio.type,
    url: audio.url,
    wordIndex: audio.wordIndex,
    startTimeMs: audio.startTimeMs,
    endTimeMs: audio.endTimeMs,
  }));
}

/**
 * Converts a PracticePhraseFromFixture to PronunciationFeedbackPanelProps.
 */
function adaptPhraseToPanelProps(
  phrase: PracticePhraseFromFixture
): PronunciationFeedbackPanelProps {
  return {
    attempts: [phrase.attempt], // Single attempt for fixtures
    currentAttempt: phrase.attempt,
    sentenceText: phrase.text,
    translationText: phrase.translationEn,
    difficulty: phrase.difficulty,
    sentenceAudio: adaptFixtureSentenceAudio(phrase),
    wordAudios: adaptFixtureWordAudio(phrase),
    words: phrase.words ? phrase.words.map(adaptFixtureWordsToNormalized) : undefined,
    title: 'Pronunciation Lab',
    showDevControls: true,
  };
}

/**
 * Development page for exploring pronunciation fixtures.
 * 
 * This page uses fixture data from data/test_data/pronunciation_fixtures.json
 * for UI prototyping and regression testing.
 */
export default function PronunciationFixtures() {
  const [phrases, setPhrases] = useState<PracticePhraseFromFixture[]>([]);
  const [selectedPhrase, setSelectedPhrase] = useState<PracticePhraseFromFixture | null>(null);

  // Adapt selected phrase to generic panel props
  const panelProps = useMemo<PronunciationFeedbackPanelProps | null>(() => {
    if (!selectedPhrase) return null;
    return adaptPhraseToPanelProps(selectedPhrase);
  }, [selectedPhrase]);

  useEffect(() => {
    // Load all practice phrases once (async now due to sentence matching)
    getAllPracticePhrasesFromFixtures()
      .then((allPhrases) => {
    setPhrases(allPhrases);
    
    // Select first phrase by default
    if (allPhrases.length > 0) {
      setSelectedPhrase(allPhrases[0]);
    }
      })
      .catch((error) => {
        console.error('Failed to load practice phrases:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handlePhraseClick = (phrase: PracticePhraseFromFixture) => {
    setSelectedPhrase(phrase);
  };


  // Keyboard navigation handlers
  const moveToPreviousPhrase = useCallback(() => {
    if (!selectedPhrase || phrases.length === 0) return;
    
    const currentIndex = phrases.findIndex((p) => p.id === selectedPhrase.id);
    if (currentIndex === -1) return;
    
    // Don't wrap - only move if not at the first phrase
    if (currentIndex > 0) {
      setSelectedPhrase(phrases[currentIndex - 1]);
    }
  }, [selectedPhrase, phrases]);

  const moveToNextPhrase = useCallback(() => {
    if (!selectedPhrase || phrases.length === 0) return;
    
    const currentIndex = phrases.findIndex((p) => p.id === selectedPhrase.id);
    if (currentIndex === -1) return;
    
    // Don't wrap - only move if not at the last phrase
    if (currentIndex < phrases.length - 1) {
      setSelectedPhrase(phrases[currentIndex + 1]);
    }
  }, [selectedPhrase, phrases]);

  // Keyboard event listener for arrow key navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only navigate if a phrase is selected
      if (!selectedPhrase) return;

      // Do not override text input behavior
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveToPreviousPhrase();
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveToNextPhrase();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPhrase, phrases, moveToPreviousPhrase, moveToNextPhrase]);

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Pronunciation Lab (Fixture Data)
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Interactive pronunciation practice tool powered by test fixtures. Use this lab to explore pronunciation feedback, compare native and user audio, and practice word-by-word pronunciation.
          </p>
        </div>

        {/* Main content area - Sentences panel centered */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {panelProps ? (
              <PronunciationFeedbackPanel {...panelProps} />
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>Select a phrase from the list below to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Phrase list below */}
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Phrases ({phrases.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {phrases.map((phrase) => (
                <button
                  key={phrase.id}
                  onClick={() => handlePhraseClick(phrase)}
                  className={`w-full text-left p-3 rounded border-2 transition-colors ${
                    selectedPhrase?.id === phrase.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {phrase.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${getDifficultyColor(phrase.difficulty)}`}>
                          Difficulty {phrase.difficulty}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Score: {Math.round(phrase.attempt.overallAccuracy)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

