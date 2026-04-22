import { useCallback, useEffect, useMemo, useState } from 'react';
import PageScaffold from '@/components/common/PageScaffold';
import {
  type AggregateSummary,
  type LexiconReviewItemDto,
  type LexiconReviewStatus,
  listReviewItems,
  promoteReviewItem,
  rejectReviewItem,
  triggerAggregation,
} from '@/api/adminLexicon';

/**
 * Admin page for the Lexicon Expansion Pipeline review queue.
 *
 * Access is gated on the server by LEXICON_ADMIN_USER_IDS — this page
 * surfaces a 403 as a simple error message rather than hiding the route.
 *
 * Flow: pick a pending word → inspect frequency / examples →
 * promote with manually-validated phonemes + notes, OR reject with an
 * optional reason. Rejected and promoted items can also be inspected
 * via the status filter.
 */
export default function AdminLexiconPage() {
  const [status, setStatus] = useState<LexiconReviewStatus>('pending');
  const [items, setItems] = useState<LexiconReviewItemDto[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [isAggregating, setIsAggregating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await listReviewItems({ status, limit: 100 });
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load review queue.');
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAggregate = useCallback(async () => {
    setIsAggregating(true);
    setBanner(null);
    try {
      const summary: AggregateSummary = await triggerAggregation();
      setBanner(
        `Aggregated ${summary.observations} observations into ${summary.groups} words (${summary.upserted} upserted, ${summary.skippedNonPending} skipped).`
      );
      void refresh();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : 'Aggregation failed.');
    } finally {
      setIsAggregating(false);
    }
  }, [refresh]);

  const handlePromote = useCallback(
    async (id: string, payload: Parameters<typeof promoteReviewItem>[1]) => {
      setBanner(null);
      try {
        await promoteReviewItem(id, payload);
        setBanner(`Promoted "${payload.text}" to the curated lexicon.`);
        setExpandedId(null);
        void refresh();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Promote failed.');
      }
    },
    [refresh]
  );

  const handleReject = useCallback(
    async (id: string, reason: string | undefined) => {
      setBanner(null);
      try {
        await rejectReviewItem(id, reason);
        setBanner('Word rejected.');
        setExpandedId(null);
        void refresh();
      } catch (err) {
        setBanner(err instanceof Error ? err.message : 'Reject failed.');
      }
    },
    [refresh]
  );

  return (
    <PageScaffold
      title="Lexicon Review"
      subtitle="Unknown words the pronunciation resolver could not match against the curated corpus. Promote the ones worth adding; reject typos and proper nouns."
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 card card-compact">
          <StatusFilter status={status} onChange={setStatus} />
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{total} total</p>
            <button
              type="button"
              onClick={handleAggregate}
              disabled={isAggregating}
              className="btn btn-secondary btn-sm"
            >
              {isAggregating ? 'Aggregating…' : 'Run aggregation'}
            </button>
          </div>
        </div>

        {banner && (
          <div
            role="status"
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
          >
            {banner}
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          >
            {loadError}
          </div>
        )}

        {isLoading ? (
          <div className="card text-sm text-gray-600 dark:text-gray-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="card text-sm text-gray-600 dark:text-gray-400">
            No {status} items.
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <ReviewItemRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                onPromote={handlePromote}
                onReject={handleReject}
              />
            ))}
          </ul>
        )}
      </div>
    </PageScaffold>
  );
}

function StatusFilter({
  status,
  onChange,
}: {
  status: LexiconReviewStatus;
  onChange: (value: LexiconReviewStatus) => void;
}) {
  const options: Array<{ value: LexiconReviewStatus; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'promoted', label: 'Promoted' },
    { value: 'rejected', label: 'Rejected' },
  ];
  return (
    <div role="group" aria-label="Status filter" className="inline-flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`chip ${status === opt.value ? 'chip-active' : 'chip-inactive'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface ReviewItemRowProps {
  item: LexiconReviewItemDto;
  isExpanded: boolean;
  onToggle: () => void;
  onPromote: (id: string, payload: Parameters<typeof promoteReviewItem>[1]) => Promise<void>;
  onReject: (id: string, reason: string | undefined) => Promise<void>;
}

function ReviewItemRow({
  item,
  isExpanded,
  onToggle,
  onPromote,
  onReject,
}: ReviewItemRowProps) {
  const lastSeen = useMemo(
    () => new Date(item.lastSeenAt).toLocaleDateString(),
    [item.lastSeenAt]
  );

  return (
    <li className="card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
        aria-expanded={isExpanded}
      >
        <div>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {item.displayForm}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.frequency}× · {item.uniqueUsers} user{item.uniqueUsers === 1 ? '' : 's'} · last seen {lastSeen} · {item.lastResolutionType}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
          <ExamplesList examples={item.examples} />
          {item.status === 'pending' && (
            <div className="grid gap-4 md:grid-cols-2">
              <PromoteForm
                displayForm={item.displayForm}
                onSubmit={(payload) => onPromote(item.id, payload)}
              />
              <RejectForm onSubmit={(reason) => onReject(item.id, reason)} />
            </div>
          )}
          {item.status === 'promoted' && item.promoted && (
            <PromotedSummary promoted={item.promoted} />
          )}
          {item.status === 'rejected' && item.rejected && (
            <RejectedSummary rejected={item.rejected} />
          )}
        </div>
      )}
    </li>
  );
}

function ExamplesList({
  examples,
}: {
  examples: LexiconReviewItemDto['examples'];
}) {
  if (examples.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
        Example sentences
      </p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
        {examples.map((ex, idx) => (
          <li key={idx}>{ex.contextText}</li>
        ))}
      </ul>
    </div>
  );
}

function PromoteForm({
  displayForm,
  onSubmit,
}: {
  displayForm: string;
  onSubmit: (payload: Parameters<typeof promoteReviewItem>[1]) => Promise<void>;
}) {
  const [text, setText] = useState(displayForm);
  const [en, setEn] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [phonemes, setPhonemes] = useState('');
  const [ipa, setIpa] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const phonemeList = phonemes
    .split(/[\s,]+/)
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const canSubmit = text.trim() && phonemeList.length > 0 && notes.trim() && !busy;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit({
        text: text.trim(),
        en: en.trim() || undefined,
        partOfSpeech: partOfSpeech.trim() || undefined,
        phonemes: phonemeList,
        ipa: ipa.trim() || undefined,
        pronunciationNotes: notes.trim(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label={`Promote ${displayForm}`}>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Promote to curated lexicon
      </p>
      <Field label="Text (as stored)" value={text} onChange={setText} required />
      <Field label="English gloss (optional)" value={en} onChange={setEn} />
      <Field
        label="Part of speech (optional)"
        value={partOfSpeech}
        onChange={setPartOfSpeech}
        placeholder="noun / verb / adjective"
      />
      <Field
        label="Phonemes (space- or comma-separated ARPABET)"
        value={phonemes}
        onChange={setPhonemes}
        required
        placeholder="SH IY L OW"
      />
      <Field label="IPA (optional)" value={ipa} onChange={setIpa} />
      <TextareaField
        label="Pronunciation notes"
        value={notes}
        onChange={setNotes}
        required
        placeholder="Stress on the penultimate syllable; open 'o' in the first vowel."
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="btn btn-primary btn-sm"
      >
        {busy ? 'Promoting…' : 'Promote'}
      </button>
    </form>
  );
}

function RejectForm({
  onSubmit,
}: {
  onSubmit: (reason: string | undefined) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(reason.trim() || undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Reject">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Reject</p>
      <TextareaField
        label="Reason (optional)"
        value={reason}
        onChange={setReason}
        placeholder="Proper noun / typo / non-word"
      />
      <button
        type="submit"
        disabled={busy}
        className="btn btn-secondary btn-sm"
      >
        {busy ? 'Rejecting…' : 'Reject'}
      </button>
    </form>
  );
}

function PromotedSummary({
  promoted,
}: {
  promoted: NonNullable<LexiconReviewItemDto['promoted']>;
}) {
  return (
    <dl className="grid gap-2 text-sm text-gray-700 dark:text-gray-300">
      <div>
        <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Text
        </dt>
        <dd>{promoted.text}</dd>
      </div>
      {promoted.en && (
        <div>
          <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            English
          </dt>
          <dd>{promoted.en}</dd>
        </div>
      )}
      <div>
        <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Phonemes
        </dt>
        <dd className="font-mono">{promoted.phonemes.join(' ')}</dd>
      </div>
      {promoted.ipa && (
        <div>
          <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            IPA
          </dt>
          <dd className="font-mono">{promoted.ipa}</dd>
        </div>
      )}
      <div>
        <dt className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Notes
        </dt>
        <dd>{promoted.pronunciationNotes}</dd>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Promoted {new Date(promoted.promotedAt).toLocaleString()}
      </p>
    </dl>
  );
}

function RejectedSummary({
  rejected,
}: {
  rejected: NonNullable<LexiconReviewItemDto['rejected']>;
}) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
      {rejected.reason && (
        <p>
          <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 mr-2">
            Reason
          </span>
          {rejected.reason}
        </p>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Rejected {new Date(rejected.rejectedAt).toLocaleString()}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: LexiconReviewStatus }) {
  const cls =
    status === 'pending'
      ? 'badge badge-warning'
      : status === 'promoted'
        ? 'badge badge-success'
        : 'badge badge-secondary';
  return <span className={cls}>{status}</span>;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}

function Field({ label, value, onChange, placeholder, required }: FieldProps) {
  return (
    <label className="block text-xs">
      <span className="block text-gray-600 dark:text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-2 py-1 rounded-md border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
    </label>
  );
}

function TextareaField({ label, value, onChange, placeholder, required }: FieldProps) {
  return (
    <label className="block text-xs">
      <span className="block text-gray-600 dark:text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={2}
        className="w-full px-2 py-1 rounded-md border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
      />
    </label>
  );
}
