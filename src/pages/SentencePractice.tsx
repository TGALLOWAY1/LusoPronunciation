import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { setLastPracticeMode } from '@/lib/storage';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useSettingsStore } from '@/state/settingsStore';
import {
  loadAllSentences,
  filterSentencesByCategory,
} from '@/lib/data';
import { preloadAudioIndex } from '@/utils/audioRouting';
import type { Sentence, SentencePracticeAttempt } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import LivePracticeSection from '@/components/practice/LivePracticeSection';
import ScoreHistory from '@/components/practice/ScoreHistory';
import AttemptHistory from '@/components/practice/AttemptHistory';
import SentenceFeedback from '@/components/practice/SentenceFeedback';
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

export default function SentencePractice() {
  const { startSession, endSession, getAttemptsBySentenceId } = usePracticeLogStore();
  const { practiceCategories, practiceDifficulties } = useSettingsStore();
  const sessionIdRef = useRef<string | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [livePracticeCurrentAttempt, setLivePracticeCurrentAttempt] = useState<AttemptScore | null>(null);
  const [latestRecordingUrlForCurrentSentence, setLatestRecordingUrlForCurrentSentence] = useState<string | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
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
        await preloadAudioIndex();
        const sentencesData = await loadAllSentences();
        setSentences(sentencesData);
      } catch (error) {
        console.error('Error loading sentence practice data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter sentences using settings-store-managed filters
  const filteredSentences = useMemo(() => {
    let filtered = sentences;

    if (practiceCategories.length > 0) {
      filtered = filterSentencesByCategory(filtered, practiceCategories);
    }

    if (practiceDifficulties.length > 0) {
      filtered = filtered.filter((s) => practiceDifficulties.includes(s.difficulty));
    }

    return filtered;
  }, [sentences, practiceCategories, practiceDifficulties]);

  // Reset to first sentence when filters change
  useEffect(() => {
    setCurrentIndex(0);
  }, [practiceCategories, practiceDifficulties]);

  useEffect(() => {
    stopAllAudio();
  }, [practiceCategories, practiceDifficulties]);

  const currentSentence = useMemo(() => {
    return filteredSentences[currentIndex];
  }, [filteredSentences, currentIndex]);

  const sentenceAttempts = useMemo(() => {
    if (!currentSentence) return [];
    return getAttemptsBySentenceId(currentSentence.id);
  }, [currentSentence?.id, getAttemptsBySentenceId]);

  useEffect(() => {
    if (sentenceAttempts.length > 0) {
      const mostRecentAttempt = sentenceAttempts[0];
      if (!selectedAttemptId || !sentenceAttempts.find((a) => a.attemptId === selectedAttemptId)) {
        setSelectedAttemptId(mostRecentAttempt.attemptId);
      }
    } else {
      setSelectedAttemptId(null);
    }
  }, [sentenceAttempts, selectedAttemptId]);

  useEffect(() => {
    if (livePracticeCurrentAttempt?.attemptId && currentSentence) {
      const matchingAttempt = sentenceAttempts.find(
        (a) => a.attemptId === livePracticeCurrentAttempt.attemptId
      );
      if (matchingAttempt) {
        setSelectedAttemptId(matchingAttempt.attemptId);
      }
    }
  }, [livePracticeCurrentAttempt?.attemptId, sentenceAttempts, currentSentence]);

  useEffect(() => {
    setLivePracticeCurrentAttempt(null);
    setLatestRecordingUrlForCurrentSentence(null);
    setSelectedAttemptId(null);
    setActiveTab('practice');
  }, [currentSentence?.id]);

  const convertAttemptToAttemptScore = useCallback((attempt: SentencePracticeAttempt): AttemptScore => {
    return {
      attemptId: attempt.attemptId,
      sentenceId: attempt.sentenceId,
      overallAccuracy: attempt.overallScore,
      fluency: attempt.fluencyScore,
      completeness: attempt.completenessScore,
      prosody: attempt.prosodyScore,
      wordScores: attempt.wordScores?.map((ws) => ({
        word: ws.token,
        accuracy: ws.overallScore,
        errorType: undefined,
      })) || [],
      createdAt: attempt.createdAt,
      audioUrl: attempt.recordingDataUrl || attempt.recordingUrl || undefined,
      latencyMs: attempt.latencyMs,
    };
  }, []);

  const selectedAttempt = useMemo(() => {
    if (!selectedAttemptId || sentenceAttempts.length === 0) {
      return livePracticeCurrentAttempt;
    }
    const found = sentenceAttempts.find((a) => a.attemptId === selectedAttemptId);
    if (found) {
      return convertAttemptToAttemptScore(found);
    }
    return sentenceAttempts.length > 0
      ? convertAttemptToAttemptScore(sentenceAttempts[0])
      : livePracticeCurrentAttempt;
  }, [selectedAttemptId, sentenceAttempts, livePracticeCurrentAttempt, convertAttemptToAttemptScore]);

  const selectedAttemptArray = useMemo(() => {
    return selectedAttempt ? [selectedAttempt] : [];
  }, [selectedAttempt]);

  const selectedRecordingUrl = useMemo(() => {
    if (selectedAttempt?.audioUrl) {
      return selectedAttempt.audioUrl;
    }
    return latestRecordingUrlForCurrentSentence;
  }, [selectedAttempt?.audioUrl, latestRecordingUrlForCurrentSentence]);

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

  const handleRecordingUrlChange = useCallback((url: string | null) => {
    setLatestRecordingUrlForCurrentSentence(url);
  }, []);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      stopAllAudio();
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < filteredSentences.length - 1) {
      stopAllAudio();
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, filteredSentences.length]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        stopAllAudio();
        setCurrentIndex((prev) => prev - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < filteredSentences.length - 1) {
        stopAllAudio();
        setCurrentIndex((prev) => prev + 1);
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Sentence Practice
        </h2>
        <div className="card text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            No sentences match your current filters.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Adjust Category and Difficulty in Settings to see more sentences.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sentence Practice
        </h2>

        {currentSentence ? (
          <div className="max-w-6xl mx-auto space-y-6 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {activeTab === 'practice' ? (
                <LivePracticeSection
                  sentence={currentSentence}
                  sessionId={sessionIdRef.current}
                  onCurrentAttemptChange={setLivePracticeCurrentAttempt}
                  onRecordingUrlChange={handleRecordingUrlChange}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              ) : (
                <div className="space-y-4">
                  {/* History header: difficulty + tabs (no filter redundancy) */}
                  <div className="flex items-center justify-end">
                    <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setActiveTab('practice')}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          (activeTab as string) === 'practice'
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

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Word-by-word breakdown
                      </h3>
                      {selectedAttempt?.createdAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatAttemptTimestamp(selectedAttempt.createdAt)}
                        </span>
                      )}
                    </div>
                    <SentenceFeedback
                      sentence={currentSentence}
                      attempts={selectedAttemptArray}
                      currentAttempt={selectedAttempt}
                      hideHeaderContent={false}
                      className="mt-0"
                    />
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                      Selected Attempt Recording
                    </h3>
                    {selectedRecordingUrl ? (
                      <RecordingPlayer
                        url={selectedRecordingUrl}
                        timestamp={
                          selectedAttemptId
                            ? sentenceAttempts.find((a) => a.attemptId === selectedAttemptId)?.createdAt
                            : undefined
                        }
                        formatTimestamp={formatAttemptTimestamp}
                      />
                    ) : (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                          {selectedAttemptId
                            ? 'No recording available for this attempt.'
                            : 'Record this sentence to play back your pronunciation here.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <AttemptHistory
                    attempts={sentenceAttempts}
                    selectedAttemptId={selectedAttemptId}
                    onSelectAttempt={setSelectedAttemptId}
                  />

                  <div className="mt-6">
                    <ScoreHistory attempts={sentenceAttempts} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {currentSentence && (
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
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
