import { useId, useState } from 'react';
import type { FormEvent } from 'react';

interface SentenceBuilderFormProps {
  onSubmit: (englishText: string) => void;
  isSubmitting: boolean;
  errorMessage?: string | null;
  maxLength?: number;
}

const DEFAULT_MAX = 500;

export default function SentenceBuilderForm({
  onSubmit,
  isSubmitting,
  errorMessage,
  maxLength = DEFAULT_MAX,
}: SentenceBuilderFormProps) {
  const textareaId = useId();
  const hintId = useId();
  const [value, setValue] = useState('');

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;
  const remaining = Math.max(0, maxLength - value.length);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4" noValidate>
      <div>
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          English sentence
        </label>
        <textarea
          id={textareaId}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          rows={3}
          maxLength={maxLength}
          disabled={isSubmitting}
          placeholder="e.g. I need to buy bread"
          aria-describedby={hintId}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-60 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <div
          id={hintId}
          className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
        >
          <span>
            Translated to Brazilian Portuguese. Native audio is generated on
            save.
          </span>
          <span aria-live="polite">{remaining} left</span>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {errorMessage}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary btn-md"
        >
          {isSubmitting ? 'Translating…' : 'Translate & Preview'}
        </button>
      </div>
    </form>
  );
}
