import { memo } from 'react';
import { Pause, Play } from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import type {
  CustomSentenceDto,
  CustomSentenceTokenDto,
} from '@/shared/types/customSentence';

interface SentencePreviewProps {
  sentence: CustomSentenceDto;
  onPractice: () => void;
  onReset: () => void;
}

function SentencePreview({
  sentence,
  onPractice,
  onReset,
}: SentencePreviewProps) {
  return (
    <div className="card space-y-5 animate-in">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            English
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 break-words">
            {sentence.sourceTextEn}
          </p>
        </div>
        <StatusBadge status={sentence.status} />
      </header>

      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Brazilian Portuguese
        </p>
        <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 break-words">
          {sentence.targetTextPt}
        </p>
      </div>

      <AudioPreview audioUrl={sentence.ttsAudioUrl} />

      <TokenBreakdown tokens={sentence.tokens} />

      <StatusExplainer status={sentence.status} />

      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onReset}
          className="btn btn-secondary btn-sm"
        >
          Try another
        </button>
        <button
          type="button"
          onClick={onPractice}
          className="btn btn-primary btn-sm"
        >
          Add to Practice
        </button>
      </footer>
    </div>
  );
}

function AudioPreview({ audioUrl }: { audioUrl: string }) {
  const { play, pause, isPlaying, isLoading, error } = useAudioPlayer(audioUrl);

  return (
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
      <div className="text-sm text-gray-700 dark:text-gray-300">
        {error ? (
          <span className="text-red-600 dark:text-red-400">
            Audio unavailable
          </span>
        ) : (
          'Native Brazilian Portuguese audio'
        )}
      </div>
    </div>
  );
}

function TokenBreakdown({ tokens }: { tokens: CustomSentenceTokenDto[] }) {
  if (tokens.length === 0) return null;

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
        Per-word coverage
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tokens.map((token) => (
          <TokenChip key={token.position} token={token} />
        ))}
      </div>
      <Legend />
    </div>
  );
}

function TokenChip({ token }: { token: CustomSentenceTokenDto }) {
  const title = describeToken(token);
  const classes = tokenChipClasses(token.confidence);
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-sm ${classes}`}
      title={title}
    >
      {token.surfaceForm}
    </span>
  );
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" />
        Curated data
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-500" />
        Generated
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
        Needs review
      </li>
    </ul>
  );
}

function StatusBadge({ status }: { status: CustomSentenceDto['status'] }) {
  const label =
    status === 'ready'
      ? 'Ready'
      : status === 'partial_support'
        ? 'Partial support'
        : 'Needs review';
  const cls =
    status === 'ready'
      ? 'badge badge-success'
      : status === 'partial_support'
        ? 'badge badge-warning'
        : 'badge badge-danger';
  return <span className={cls}>{label}</span>;
}

function StatusExplainer({ status }: { status: CustomSentenceDto['status'] }) {
  if (status === 'ready') return null;
  const message =
    status === 'partial_support'
      ? 'Some words fell back to auto-generated pronunciation. Scoring still works; refer to the native audio for any words marked in yellow.'
      : 'At least one word could not be resolved. Scoring will be approximate for the words marked in red.';
  return (
    <p className="text-xs text-gray-600 dark:text-gray-400">{message}</p>
  );
}

function tokenChipClasses(
  confidence: CustomSentenceTokenDto['confidence']
): string {
  switch (confidence) {
    case 'high':
      return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200';
    case 'medium':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200';
    case 'low':
      return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200';
  }
}

function describeToken(token: CustomSentenceTokenDto): string {
  const resolution = (() => {
    switch (token.resolutionType) {
      case 'exact_match':
        return 'curated word (exact match)';
      case 'lemma_match':
        return 'curated word (lemma match)';
      case 'generated':
        return 'auto-generated pronunciation';
      case 'unresolved':
        return 'no pronunciation data';
    }
  })();
  return `${token.surfaceForm} — ${resolution}`;
}

export default memo(SentencePreview);
