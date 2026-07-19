import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, X } from 'lucide-react';

const DISMISS_KEY = 'luso_review_nudge_dismissed';

/**
 * Subtle, dismissible prompt shown on the Practice page when the learner has
 * items due in the (server-authoritative) review queue. Links to /review.
 * Dismissal is remembered for the browser session only, so it reappears next
 * visit if items are still due.
 */
export default function ReviewNudge({ dueCount }: { dueCount: number }) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  if (dueCount <= 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* sessionStorage unavailable — dismissal just won't persist */
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-primary-200 dark:border-primary-900/50 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-sm">
      <Link
        to="/review"
        className="flex items-center gap-2 text-primary-700 dark:text-primary-300 hover:underline"
      >
        <ClipboardList size={16} />
        <span>
          You have {dueCount} item{dueCount === 1 ? '' : 's'} due for review
        </span>
      </Link>
      <button
        onClick={dismiss}
        aria-label="Dismiss review reminder"
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      >
        <X size={16} />
      </button>
    </div>
  );
}
