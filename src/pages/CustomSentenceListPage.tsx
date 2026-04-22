import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageScaffold from '@/components/common/PageScaffold';
import {
  CustomSentenceApiError,
  deleteCustomSentence,
  listCustomSentences,
} from '@/api/customSentences';
import type { CustomSentenceDto } from '@/shared/types/customSentence';

/**
 * "My Sentences" — lists the signed-in user's custom sentences so they can
 * return to practice or delete ones they no longer want.
 *
 * Minimal by design: newest first, status badge, per-row Practice link and
 * Delete button. Pagination is not exposed in the UI yet; the API caps at
 * 50 per page by default which is plenty for any realistic personal list.
 */
export default function CustomSentenceListPage() {
  const [sentences, setSentences] = useState<CustomSentenceDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await listCustomSentences({ limit: 50 });
      setSentences(result.sentences);
    } catch (err) {
      if (err instanceof CustomSentenceApiError && err.status === 401) {
        setError('You need to sign in to view your sentences.');
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not load your sentences.'
        );
      }
      setSentences([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = window.confirm(
        'Delete this custom sentence? This cannot be undone.'
      );
      if (!ok) return;
      setDeletingId(id);
      try {
        await deleteCustomSentence(id);
        setSentences((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : 'Could not delete this sentence.'
        );
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <PageScaffold
      title="My Sentences"
      subtitle="Custom sentences you've built. Pick one to practice or remove ones you no longer need."
      primaryAction={{ label: 'New sentence', to: '/builder' }}
      maxWidth="2xl"
    >
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {sentences === null ? (
        <div className="card text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      ) : sentences.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {sentences.map((sentence) => (
            <SentenceRow
              key={sentence.id}
              sentence={sentence}
              isDeleting={deletingId === sentence.id}
              onDelete={() => handleDelete(sentence.id)}
            />
          ))}
        </ul>
      )}
    </PageScaffold>
  );
}

function EmptyState() {
  return (
    <div className="card text-sm text-gray-600 dark:text-gray-400">
      <p>You haven't built any custom sentences yet.</p>
      <p className="mt-2">
        <Link to="/builder" className="text-primary-600 hover:underline dark:text-primary-400">
          Build your first sentence
        </Link>{' '}
        to start practicing phrases you actually need.
      </p>
    </div>
  );
}

interface SentenceRowProps {
  sentence: CustomSentenceDto;
  isDeleting: boolean;
  onDelete: () => void;
}

function SentenceRow({ sentence, isDeleting, onDelete }: SentenceRowProps) {
  const created = new Date(sentence.createdAt).toLocaleDateString();
  return (
    <li className="card">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 break-words">
            {sentence.targetTextPt}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 break-words">
            {sentence.sourceTextEn}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Added {created} · {sentence.tokens.length} word
            {sentence.tokens.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={sentence.status} />
          <Link
            to={`/practice/custom/${sentence.id}`}
            className="btn btn-primary btn-sm"
          >
            Practice
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="btn btn-secondary btn-sm"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: CustomSentenceDto['status'] }) {
  const label =
    status === 'ready'
      ? 'Ready'
      : status === 'partial_support'
        ? 'Partial'
        : 'Review';
  const cls =
    status === 'ready'
      ? 'badge badge-success'
      : status === 'partial_support'
        ? 'badge badge-warning'
        : 'badge badge-danger';
  return <span className={cls}>{label}</span>;
}
