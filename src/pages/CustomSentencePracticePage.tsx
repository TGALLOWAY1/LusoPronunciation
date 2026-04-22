import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pause, Play, Trash2 } from 'lucide-react';
import PageScaffold from '@/components/common/PageScaffold';
import PremiumRecordButton from '@/components/common/PremiumRecordButton';
import { useLivePronunciationPractice } from '@/hooks/useLivePronunciationPractice';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import {
  CustomSentenceApiError,
  deleteCustomSentence,
  getCustomSentence,
} from '@/api/customSentences';
import type {
  CustomSentenceDto,
  CustomSentenceTokenDto,
} from '@/shared/types/customSentence';

/**
 * Dedicated practice page for a user-built custom sentence.
 *
 * Reuses `useLivePronunciationPractice` (same Azure Speech scoring pipeline
 * the regular sentence practice page uses) and the existing practice-log
 * session lifecycle so attempts land in the user's history exactly like
 * any other sentence attempt. The `contentType` on the logged attempt is
 * `sentence` with the custom sentence id as `contentId`, which the
 * existing backend already accepts as a free string.
 */
export default function CustomSentencePracticePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { startSession, endSession } = usePracticeLogStore();

  const [sentence, setSentence] = useState<CustomSentenceDto | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const {
    isRecording,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    submitting,
    error: submitError,
    attempts,
    currentAttempt,
    submitAttempt,
    clearAssessmentState,
  } = useLivePronunciationPractice();

  // Load the sentence
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!id) return;
      try {
        const result = await getCustomSentence(id);
        if (!cancelled) setSentence(result);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof CustomSentenceApiError && err.status === 404) {
          setLoadError('This custom sentence was not found. It may have been deleted.');
        } else {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Could not load this custom sentence.'
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Start a practice session on mount, end it on unmount
  useEffect(() => {
    let active = true;
    void (async () => {
      const sessionId = await startSession('sentences');
      if (active) {
        sessionIdRef.current = sessionId;
      }
    })();
    return () => {
      active = false;
      const sid = sessionIdRef.current;
      if (sid) {
        void endSession(sid);
        sessionIdRef.current = null;
      }
    };
    // startSession / endSession are stable store refs; exclude to avoid
    // re-starting the session on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any prior assessment state when the sentence id changes
  useEffect(() => {
    resetRecording();
    clearAssessmentState();
  }, [id, resetRecording, clearAssessmentState]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSubmit = useCallback(async () => {
    if (!sentence || !audioUrl) return;
    await submitAttempt(sentence.id, sentence.targetTextPt, {
      sessionId: sessionIdRef.current ?? '',
      sentenceId: sentence.id,
      difficulty: 3,
      category: 'custom',
    });
  }, [sentence, audioUrl, submitAttempt]);

  const handleDelete = useCallback(async () => {
    if (!sentence) return;
    const ok = window.confirm('Delete this custom sentence? This cannot be undone.');
    if (!ok) return;
    setIsDeleting(true);
    try {
      await deleteCustomSentence(sentence.id);
      navigate('/builder');
    } catch (err) {
      setIsDeleting(false);
      window.alert(
        err instanceof Error ? err.message : 'Could not delete this sentence.'
      );
    }
  }, [sentence, navigate]);

  if (loadError) {
    return (
      <PageScaffold title="Custom sentence" maxWidth="2xl">
        <div className="card" role="alert">
          <p className="text-sm text-red-800 dark:text-red-200">{loadError}</p>
          <div className="mt-4">
            <Link to="/builder" className="btn btn-primary btn-sm">
              Back to Sentence Builder
            </Link>
          </div>
        </div>
      </PageScaffold>
    );
  }

  if (!sentence) {
    return (
      <PageScaffold title="Custom sentence" maxWidth="2xl">
        <div className="card">
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading…</p>
        </div>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="Practice"
      subtitle="Custom sentence from your builder"
      maxWidth="2xl"
    >
      <div className="space-y-6">
        <SentenceHeader
          sentence={sentence}
          onDelete={handleDelete}
          isDeleting={isDeleting}
        />

        <RecordingPanel
          isRecording={isRecording}
          hasRecording={Boolean(audioUrl)}
          submitting={submitting}
          onToggleRecording={toggleRecording}
          onSubmit={handleSubmit}
          onDiscard={resetRecording}
          submitError={submitError}
        />

        {currentAttempt && (
          <AttemptResult
            currentAttempt={currentAttempt}
            tokens={sentence.tokens}
            attemptCount={attempts.length}
          />
        )}
      </div>
    </PageScaffold>
  );
}

interface SentenceHeaderProps {
  sentence: CustomSentenceDto;
  onDelete: () => void;
  isDeleting: boolean;
}

function SentenceHeader({ sentence, onDelete, isDeleting }: SentenceHeaderProps) {
  const { play, pause, isPlaying, isLoading, error } = useAudioPlayer(sentence.ttsAudioUrl);

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Brazilian Portuguese
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
            {sentence.targetTextPt}
          </p>
          {sentence.sourceTextEn && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 break-words">
              {sentence.sourceTextEn}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete this custom sentence"
          className="btn btn-ghost btn-sm text-red-600 dark:text-red-400 shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/40">
        <button
          type="button"
          onClick={isPlaying ? pause : play}
          disabled={isLoading || Boolean(error)}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary-500 text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 dark:bg-primary-600 dark:hover:bg-primary-700"
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {error ? 'Audio unavailable' : 'Listen to the native audio before recording'}
        </span>
      </div>
    </div>
  );
}

interface RecordingPanelProps {
  isRecording: boolean;
  hasRecording: boolean;
  submitting: boolean;
  onToggleRecording: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
  onDiscard: () => void;
  submitError: string | null;
}

function RecordingPanel({
  isRecording,
  hasRecording,
  submitting,
  onToggleRecording,
  onSubmit,
  onDiscard,
  submitError,
}: RecordingPanelProps) {
  return (
    <div className="card">
      <div className="flex flex-col items-center gap-4">
        <PremiumRecordButton
          isRecording={isRecording}
          onClick={() => void onToggleRecording()}
          size="lg"
          disabled={submitting}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isRecording
            ? 'Recording… click to stop.'
            : hasRecording
              ? 'Recording ready. Submit for scoring.'
              : 'Click to start recording.'}
        </p>
        {hasRecording && !isRecording && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={submitting}
              className="btn btn-secondary btn-sm"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting}
              className="btn btn-primary btn-sm"
            >
              {submitting ? 'Scoring…' : 'Submit for scoring'}
            </button>
          </div>
        )}
        {submitError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 text-center">
            {submitError}
          </p>
        )}
      </div>
    </div>
  );
}

interface AttemptResultProps {
  currentAttempt: { overallAccuracy: number; wordScores?: Array<{ word: string; accuracy: number }> };
  tokens: CustomSentenceTokenDto[];
  attemptCount: number;
}

function AttemptResult({ currentAttempt, tokens, attemptCount }: AttemptResultProps) {
  const score = Math.round(currentAttempt.overallAccuracy);
  const scoreBand = useMemo(() => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, [score]);

  return (
    <div className="card animate-in space-y-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Overall accuracy
          </p>
          <p className={`text-4xl font-bold ${scoreBand}`}>{score}</p>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Attempt {attemptCount}
        </p>
      </header>

      {currentAttempt.wordScores && currentAttempt.wordScores.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Word-by-word
          </p>
          <div className="flex flex-wrap gap-1.5">
            {currentAttempt.wordScores.map((ws, idx) => {
              const token = tokens[idx];
              const coverageClass = tokenCoverageClass(token?.confidence);
              return (
                <span
                  key={`${ws.word}-${idx}`}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-sm ${coverageClass}`}
                  title={
                    token
                      ? `${ws.word} — ${token.resolutionType}, ${Math.round(ws.accuracy)}% accuracy`
                      : `${ws.word} — ${Math.round(ws.accuracy)}% accuracy`
                  }
                >
                  <span>{ws.word}</span>
                  <span className="text-xs opacity-75">{Math.round(ws.accuracy)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function tokenCoverageClass(confidence?: CustomSentenceTokenDto['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200';
    case 'medium':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200';
    case 'low':
      return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200';
    default:
      return 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200';
  }
}
