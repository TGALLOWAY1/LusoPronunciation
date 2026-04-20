import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  loadAllSentences,
  loadAllCategories,
  filterSentencesByCategory,
} from '@/lib/data';
import { preloadAudioIndex } from '@/utils/audioRouting';
import type { Sentence, Category, Difficulty, SentencePracticeAttempt } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import { getDifficultyLabel } from '@/utils/difficultyLabels';
import LivePracticeSection from '@/components/practice/LivePracticeSection';
import ScoreHistory from '@/components/practice/ScoreHistory';
import AttemptHistory from '@/components/practice/AttemptHistory';
import SentenceFeedback from '@/components/practice/SentenceFeedback';
import FilterControls from '@/components/practice/FilterControls';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageTransition from '@/components/common/PageTransition';

/**
 * Audio player with error handling for expired blob URLs.
 */
function RecordingPlayer({
  url,
  timestamp,
  formatTimestamp,
}: {
  url: string;
  timestamp?: string;
  formatTimestamp: (iso: string) => string;
}) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when URL changes
  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          Recording expired. Audio is only available during the current session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <audio
        controls
        src={url}
        className="w-full"
        onError={() => setHasError(true)}
      />
      {timestamp && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Recording from {formatTimestamp(timestamp)}
        </p>
      )}
    </div>
  );
}

/**
 * Feat 15: Sentence difficulty ratings ('Easy/Good/Hard') were removed.
 * Progress is tracked by pronunciation attempts and scores instead.
 */
export default function SentencePractice() {
  const { startSession, endSession, getAttemptsBySentenceId } = usePracticeLogStore();
  const sessionIdRef = useRef<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Difficulty[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [livePracticeCurrentAttempt, setLivePracticeCurrentAttempt] = useState<AttemptScore | null>(null);
  const [latestRecordingUrlForCurrentSentence, setLatestRecordingUrlForCurrentSentence] = useState<string | null>(null);
  // selectedAttemptId determines which attempt's scoring + recording are shown
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
const difficultyBadgeClasses: Record<Difficulty, string> = {
  2: 'badge-primary',
  3: 'badge-warning',
  4: 'badge-danger',
};

// Active tab in main panel: 'practice' or 'history'
  const [activeTab, setActiveTab] = useState<'practice' | 'history'>('practice');

  useEffect(() => {
    setLastPracticeMode('sentence');
  }, []);

  // Start practice session when component mounts
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      const sessionId = await startSession('sentences');
      if (mounted) {
        sessionIdRef.current = sessionId;
      }
    })();

    // End session when component unmounts
    return () => {
      mounted = false;
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current).catch((error) => {
          console.warn('Failed to end session:', error);
        });
        sessionIdRef.current = null;
      }
    };
  }, [startSession, endSession]);

  useEffect(() => {
    async function loadData() {
      try {
        // Feat 15: Preload audio index for word-by-word audio playback
        await preloadAudioIndex();
        
        const [sentencesData, categoriesData] = await Promise.all([
          loadAllSentences(),
          loadAllCategories(),
        ]);
        setSentences(sentencesData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Error loading sentence practice data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter sentences based on selected categories and difficulties
  const filteredSentences = useMemo(() => {
    let filtered = sentences;

    if (selectedCategories.length > 0) {
      filtered = filterSentencesByCategory(filtered, selectedCategories);
    }

    if (selectedDifficulties.length > 0) {
      // Filter by multiple specific difficulties
      filtered = filtered.filter(s => selectedDifficulties.includes(s.difficulty));
    }

    return filtered;
  }, [sentences, selectedCategories, selectedDifficulties]);

  // Get current filter summary labels (used in both empty and normal states)
  const currentFilterSummary = useMemo(() => {
    let categoryLabel: string;
    if (selectedCategories.length === 0) {
      categoryLabel = 'All categories';
    } else if (selectedCategories.length === 1) {
      const category = categories.find(cat => cat.id === selectedCategories[0]);
      categoryLabel = category?.labelEn || 'All categories';
    } else {
      const categoryNames = selectedCategories
        .map(id => categories.find(cat => cat.id === id)?.labelEn)
        .filter(Boolean) as string[];
      categoryLabel = categoryNames.join(', ');
    }
    
    let difficultyLabel: string;
    if (selectedDifficulties.length === 0) {
      difficultyLabel = 'All difficulties';
    } else if (selectedDifficulties.length === 1) {
      difficultyLabel = getDifficultyLabel(selectedDifficulties[0]) || 'All difficulties';
    } else {
      const difficultyNames = selectedDifficulties
        .map(d => getDifficultyLabel(d))
        .filter(Boolean) as string[];
      difficultyLabel = difficultyNames.join(', ');
    }

    return { categoryLabel, difficultyLabel };
  }, [selectedCategories, selectedDifficulties, categories]);

  // Reset to first sentence when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedCategories, selectedDifficulties]);

  // Stop any playing audio when sentence changes (e.g., via filter change)
  useEffect(() => {
    stopAllAudio();
  }, [selectedCategories, selectedDifficulties]);

  const currentSentence = useMemo(() => {
    return filteredSentences[currentIndex];
  }, [filteredSentences, currentIndex]);

  // Get attempt history for current sentence (sorted by timestamp descending, most recent first)
  const sentenceAttempts = useMemo(() => {
    if (!currentSentence) return [];
    return getAttemptsBySentenceId(currentSentence.id);
  }, [currentSentence?.id, getAttemptsBySentenceId]);

  // Auto-select most recent attempt when attempts change or sentence changes
  useEffect(() => {
    if (sentenceAttempts.length > 0) {
      // If no attempt is selected, or the selected attempt no longer exists, select the most recent
      const mostRecentAttempt = sentenceAttempts[0];
      if (!selectedAttemptId || !sentenceAttempts.find(a => a.attemptId === selectedAttemptId)) {
        setSelectedAttemptId(mostRecentAttempt.attemptId);
      }
    } else {
      // No attempts for this sentence, clear selection
      setSelectedAttemptId(null);
    }
  }, [sentenceAttempts, selectedAttemptId]);

  // When a new attempt is logged (livePracticeCurrentAttempt changes), auto-select it
  useEffect(() => {
    if (livePracticeCurrentAttempt?.attemptId && currentSentence) {
      // Find the matching attempt in sentenceAttempts
      const matchingAttempt = sentenceAttempts.find(
        a => a.attemptId === livePracticeCurrentAttempt.attemptId
      );
      if (matchingAttempt) {
        setSelectedAttemptId(matchingAttempt.attemptId);
      }
    }
  }, [livePracticeCurrentAttempt?.attemptId, sentenceAttempts, currentSentence]);

  // Reset live practice attempt and recording URL when sentence changes
  useEffect(() => {
    setLivePracticeCurrentAttempt(null);
    setLatestRecordingUrlForCurrentSentence(null);
    setSelectedAttemptId(null); // Will be set by the auto-select effect above
    setActiveTab('practice'); // Reset to practice tab when sentence changes
  }, [currentSentence?.id]);

  /**
   * Converts a SentencePracticeAttempt to AttemptScore for use in ScoringPanel.
   */
  const convertAttemptToAttemptScore = useCallback((attempt: SentencePracticeAttempt): AttemptScore => {
    return {
      attemptId: attempt.attemptId,
      sentenceId: attempt.sentenceId,
      overallAccuracy: attempt.overallScore,
      fluency: attempt.fluencyScore,
      completeness: attempt.completenessScore,
      prosody: attempt.prosodyScore,
      wordScores: attempt.wordScores?.map(ws => ({
        word: ws.token,
        accuracy: ws.overallScore,
        errorType: undefined, // SentencePracticeAttempt doesn't store errorType
      })) || [],
      createdAt: attempt.createdAt,
      audioUrl: attempt.recordingDataUrl || attempt.recordingUrl || undefined,
      latencyMs: attempt.latencyMs,
    };
  }, []);

  // Derive the selected attempt object and convert it to AttemptScore
  const selectedAttempt = useMemo(() => {
    if (!selectedAttemptId || sentenceAttempts.length === 0) {
      // Fall back to livePracticeCurrentAttempt if no selected attempt
      return livePracticeCurrentAttempt;
    }
    const found = sentenceAttempts.find(a => a.attemptId === selectedAttemptId);
    if (found) {
      return convertAttemptToAttemptScore(found);
    }
    // Fall back to most recent attempt or livePracticeCurrentAttempt
    return sentenceAttempts.length > 0 
      ? convertAttemptToAttemptScore(sentenceAttempts[0])
      : livePracticeCurrentAttempt;
  }, [selectedAttemptId, sentenceAttempts, livePracticeCurrentAttempt, convertAttemptToAttemptScore]);

  const selectedAttemptArray = useMemo(() => {
    return selectedAttempt ? [selectedAttempt] : [];
  }, [selectedAttempt]);

  // Get recording URL from selected attempt
  const selectedRecordingUrl = useMemo(() => {
    if (selectedAttempt?.audioUrl) {
      return selectedAttempt.audioUrl;
    }
    // Fall back to latestRecordingUrlForCurrentSentence if selected attempt has no recording
    return latestRecordingUrlForCurrentSentence;
  }, [selectedAttempt?.audioUrl, latestRecordingUrlForCurrentSentence]);

  // Format timestamp for display
  const formatAttemptTimestamp = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }, []);

  // Handle recording URL changes from LivePracticeSection
  const handleRecordingUrlChange = useCallback((url: string | null) => {
    setLatestRecordingUrlForCurrentSentence(url);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopAllAudio();
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredSentences.length - 1) {
      stopAllAudio();
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, filteredSentences.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        stopAllAudio();
        setCurrentIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < filteredSentences.length - 1) {
        stopAllAudio();
        setCurrentIndex(prev => prev + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, filteredSentences.length]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <LoadingSpinner message="Loading sentences..." />
      </div>
    );
  }

  if (filteredSentences.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Sentence Practice</h2>
        <FilterControls
          categories={categories}
          selectedCategories={selectedCategories}
          selectedDifficulties={selectedDifficulties}
          onCategoryChange={setSelectedCategories}
          onDifficultyChange={setSelectedDifficulties}
        />
        {/* Current filters summary header */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Category: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.categoryLabel}</span>
            {' · '}
            Difficulty: <span className="font-medium text-gray-900 dark:text-gray-200">{currentFilterSummary.difficultyLabel}</span>
          </p>
        </div>
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No sentences found matching your filters.
          </p>
          <button
            onClick={() => {
              setSelectedCategories([]);
              setSelectedDifficulties([]);
            }}
            className="btn btn-primary btn-sm mt-4"
          >
            Clear filters
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Sentence Practice</h2>

        {/* Filter controls */}
        <FilterControls
          categories={categories}
          selectedCategories={selectedCategories}
          selectedDifficulties={selectedDifficulties}
          onCategoryChange={setSelectedCategories}
          onDifficultyChange={setSelectedDifficulties}
          currentIndex={currentIndex}
          totalCount={filteredSentences.length}
        />

        {/* Main content area - Single column layout */}
        {currentSentence ? (
          <div className="max-w-6xl mx-auto space-y-4 mb-4">
            {/* Main sentence practice area */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`badge ${difficultyBadgeClasses[currentSentence.difficulty as Difficulty]}`}>
                    Difficulty {currentSentence.difficulty}
                  </span>
                  {activeTab === 'history' && selectedAttempt?.createdAt && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {formatAttemptTimestamp(selectedAttempt.createdAt)}
                    </span>
                  )}
                </div>
                {/* Tabs */}
                <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('practice')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'practice'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      activeTab === 'history'
                        ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    History
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'practice' ? (
                <LivePracticeSection
                  sentence={currentSentence}
                  sessionId={sessionIdRef.current}
                  onCurrentAttemptChange={setLivePracticeCurrentAttempt}
                  onRecordingUrlChange={handleRecordingUrlChange}
                />
              ) : (
                <div className="space-y-3">
                  <SentenceFeedback
                    sentence={currentSentence}
                    attempts={selectedAttemptArray}
                    currentAttempt={selectedAttempt}
                    hideHeaderContent={false}
                    showDifficultyBadge={false}
                    className="mt-0"
                  />

                  {/* Selected Attempt Recording */}
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                        Selected attempt recording
                      </h3>
                    </div>
                    {selectedRecordingUrl ? (
                      <RecordingPlayer
                        url={selectedRecordingUrl}
                        timestamp={
                          selectedAttemptId
                            ? sentenceAttempts.find(a => a.attemptId === selectedAttemptId)?.createdAt
                            : undefined
                        }
                        formatTimestamp={formatAttemptTimestamp}
                      />
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {selectedAttemptId
                          ? 'No recording available for this attempt.'
                          : 'Record this sentence to play back your pronunciation here.'}
                      </p>
                    )}
                  </div>

                  {/* Attempt History */}
                  <AttemptHistory
                    attempts={sentenceAttempts}
                    selectedAttemptId={selectedAttemptId}
                    onSelectAttempt={setSelectedAttemptId}
                  />

                  {/* Score History - Trend chart */}
                  <ScoreHistory attempts={sentenceAttempts} />
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Navigation buttons */}
        {currentSentence && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className="btn btn-secondary btn-md flex-1 flex items-center justify-center gap-2"
            >
              <span>←</span>
              <span>Previous sentence</span>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= filteredSentences.length - 1}
              className="btn btn-primary btn-md flex-1 flex items-center justify-center gap-2"
            >
              <span>Next sentence</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
