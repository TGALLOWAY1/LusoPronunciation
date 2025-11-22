import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAllPracticePhrasesFromFixtures, type PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import { PronunciationFeedbackPanel, type PronunciationFeedbackPanelProps } from '@/components/pronunciation';
import {
  adaptFixtureWordsToNormalized,
  type NormalizedAudioVariant,
  type NormalizedWordAudioVariant,
} from '@/components/pronunciation/shared';
import type { AudioVariant, WordAudioVariant } from '@/types/pronunciationFixtures';
import { loadAllCategories, loadAllSentences, type Category } from '@/lib/data';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import MultiSelect, { type MultiSelectOption } from '@/components/common/MultiSelect';
import ScoringPanel from '@/components/pronunciation/ScoringPanel';
import LivePracticeSection from '@/components/practice/LivePracticeSection';
import { usePracticeLogStore } from '@/state/practiceLogStore';

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
    title: undefined, // No title for practice page
    showDevControls: true,
  };
}

/**
 * Normalizes Portuguese text for matching by:
 * - Trimming whitespace
 * - Normalizing multiple spaces to single space
 * - Removing punctuation
 * - Converting to lowercase
 */
function normalizePortugueseText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]/g, '')
    .toLowerCase();
}

/**
 * Matches a fixture phrase to a real sentence by comparing normalized Portuguese text.
 * 
 * @param phrase - The fixture phrase to match
 * @param sentences - Array of sentences to search
 * @returns The matching sentence if found, null otherwise
 */
function matchFixtureToSentence(
  phrase: PracticePhraseFromFixture | null,
  sentences: Sentence[]
): Sentence | null {
  if (!phrase) return null;

  const normalizedPhrase = normalizePortugueseText(phrase.text);

  // Try to find exact match (normalized)
  for (const sentence of sentences) {
    const normalizedSentence = normalizePortugueseText(sentence.textPt);
    if (normalizedSentence === normalizedPhrase) {
      return sentence;
    }
  }

  return null;
}

/**
 * Development page for exploring pronunciation fixtures.
 * 
 * This page uses fixture data from data/test_data/pronunciation_fixtures.json
 * for UI prototyping and regression testing.
 * 
 * When a fixture phrase matches a real sentence in the dataset, live practice
 * is enabled using the LivePracticeSection component.
 */
export default function PronunciationFixtures() {
  const { startSession } = usePracticeLogStore();
  
  const [phrases, setPhrases] = useState<PracticePhraseFromFixture[]>([]);
  const [selectedPhrase, setSelectedPhrase] = useState<PracticePhraseFromFixture | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<number[]>([]);
  const [livePracticeCurrentAttempt, setLivePracticeCurrentAttempt] = useState<AttemptScore | null>(null);

  // Match selected phrase to a real sentence
  const matchedSentence = useMemo(() => {
    return matchFixtureToSentence(selectedPhrase, sentences);
  }, [selectedPhrase, sentences]);

  const canDoLivePractice = Boolean(matchedSentence);

  // Reset live practice attempt when phrase changes
  useEffect(() => {
    setLivePracticeCurrentAttempt(null);
  }, [selectedPhrase?.id]);

  // Adapt selected phrase to generic panel props (for fixture-only mode)
  const panelProps = useMemo<PronunciationFeedbackPanelProps | null>(() => {
    if (!selectedPhrase) return null;
    return adaptPhraseToPanelProps(selectedPhrase);
  }, [selectedPhrase]);

  // Start a practice session on mount
  useEffect(() => {
    const newSessionId = startSession('sentences');
    setSessionId(newSessionId);
  }, [startSession]);

  useEffect(() => {
    // Load all practice phrases, categories, and sentences
    Promise.all([
      getAllPracticePhrasesFromFixtures(),
      loadAllCategories(),
      loadAllSentences(),
    ])
      .then(([allPhrases, allCategories, allSentences]) => {
        setPhrases(allPhrases);
        setCategories(allCategories);
        setSentences(allSentences);
        
        // Select first phrase by default
        if (allPhrases.length > 0) {
          setSelectedPhrase(allPhrases[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to load practice phrases, categories, or sentences:', error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handlePhraseClick = (phrase: PracticePhraseFromFixture) => {
    setSelectedPhrase(phrase);
  };

  // Filter phrases based on selected categories and difficulties
  const filteredPhrases = useMemo(() => {
    let filtered = phrases;

    // Filter by categories
    if (selectedCategoryIds.length > 0) {
      filtered = filtered.filter(phrase => 
        phrase.categoryId && selectedCategoryIds.includes(phrase.categoryId)
      );
    }

    // Filter by difficulties
    if (selectedDifficulties.length > 0) {
      filtered = filtered.filter(phrase => 
        selectedDifficulties.includes(phrase.difficulty)
      );
    }

    return filtered;
  }, [phrases, selectedCategoryIds, selectedDifficulties]);

  // Keyboard navigation handlers
  const moveToPreviousPhrase = useCallback(() => {
    if (!selectedPhrase || filteredPhrases.length === 0) return;
    
    const currentIndex = filteredPhrases.findIndex((p) => p.id === selectedPhrase.id);
    if (currentIndex === -1) return;
    
    // Don't wrap - only move if not at the first phrase
    if (currentIndex > 0) {
      setSelectedPhrase(filteredPhrases[currentIndex - 1]);
    }
  }, [selectedPhrase, filteredPhrases]);

  const moveToNextPhrase = useCallback(() => {
    if (!selectedPhrase || filteredPhrases.length === 0) return;
    
    const currentIndex = filteredPhrases.findIndex((p) => p.id === selectedPhrase.id);
    if (currentIndex === -1) return;
    
    // Don't wrap - only move if not at the last phrase
    if (currentIndex < filteredPhrases.length - 1) {
      setSelectedPhrase(filteredPhrases[currentIndex + 1]);
    }
  }, [selectedPhrase, filteredPhrases]);

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
  }, [selectedPhrase, filteredPhrases, moveToPreviousPhrase, moveToNextPhrase]);

  // Update selected phrase if it's filtered out
  useEffect(() => {
    if (selectedPhrase && !filteredPhrases.find(p => p.id === selectedPhrase.id)) {
      // Current phrase is filtered out, select first available or null
      setSelectedPhrase(filteredPhrases.length > 0 ? filteredPhrases[0] : null);
    }
  }, [filteredPhrases, selectedPhrase]);

  // Get unique categories from phrases (only show categories that exist in phrases)
  const availableCategories = useMemo(() => {
    const categoryMap = new Map<string, Category>();
    categories.forEach(cat => categoryMap.set(cat.id, cat));
    
    const phraseCategories = new Set<string>();
    phrases.forEach(phrase => {
      if (phrase.categoryId) {
        phraseCategories.add(phrase.categoryId);
      }
    });

    return Array.from(phraseCategories)
      .map(id => categoryMap.get(id))
      .filter((cat): cat is Category => cat !== undefined)
      .sort((a, b) => a.labelEn.localeCompare(b.labelEn));
  }, [categories, phrases]);

  // Get unique difficulties from phrases
  const availableDifficulties = useMemo(() => {
    const difficulties = new Set<number>();
    phrases.forEach(phrase => {
      difficulties.add(phrase.difficulty);
    });
    return Array.from(difficulties).sort((a, b) => a - b);
  }, [phrases]);

  // Build category options for multiselect
  const categoryOptions: MultiSelectOption[] = useMemo(() => {
    return availableCategories.map(cat => ({
      value: cat.id,
      label: cat.labelEn,
    }));
  }, [availableCategories]);

  // Build difficulty options for multiselect
  const difficultyOptions: MultiSelectOption[] = useMemo(() => {
    const difficultyLabels: Record<number, string> = {
      1: 'Very Easy',
      2: 'Easy',
      3: 'Medium',
      4: 'Hard',
      5: 'Very Hard',
    };
    return availableDifficulties.map(diff => ({
      value: diff,
      label: difficultyLabels[diff] || `Difficulty ${diff}`,
    }));
  }, [availableDifficulties]);

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
        {/* Filters */}
        <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MultiSelect
              label="Category"
              options={categoryOptions}
              selectedValues={selectedCategoryIds}
              onChange={(values) => setSelectedCategoryIds(values as string[])}
              placeholder="Select categories..."
            />
            <MultiSelect
              label="Difficulty"
              options={difficultyOptions}
              selectedValues={selectedDifficulties}
              onChange={(values) => setSelectedDifficulties(values as number[])}
              placeholder="Select difficulties..."
            />
          </div>
        </div>

        {/* Main content area - Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Main panel - takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {canDoLivePractice && matchedSentence ? (
                <LivePracticeSection 
                  sentence={matchedSentence} 
                  sessionId={sessionId}
                  onCurrentAttemptChange={setLivePracticeCurrentAttempt}
                />
              ) : panelProps ? (
                <>
                  {!canDoLivePractice && selectedPhrase && (
                    <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                      This fixture phrase doesn't have a matching sentence in your dataset yet, so live practice is disabled for it.
                    </div>
                  )}
                  <PronunciationFeedbackPanel {...panelProps} />
                </>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>Select a phrase from the list below to view details</p>
                </div>
              )}
            </div>
          </div>

          {/* Scoring panel - takes 1 column */}
          <div className="lg:col-span-1">
            <ScoringPanel 
              currentAttempt={
                canDoLivePractice && matchedSentence
                  ? livePracticeCurrentAttempt
                  : panelProps?.currentAttempt ?? null
              } 
            />
          </div>
        </div>

        {/* Phrase list below */}
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Phrases ({filteredPhrases.length} of {phrases.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredPhrases.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>No phrases match the selected filters.</p>
                  <p className="text-sm mt-2">Try adjusting your category or difficulty selections.</p>
                </div>
              ) : (
                filteredPhrases.map((phrase) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

