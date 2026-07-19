import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility behavior for a modal dialog rendered as a fixed overlay.
 *
 * While `isOpen` is true this hook:
 * - Moves focus into the dialog (to `initialFocusRef` if provided, otherwise
 *   the dialog container itself).
 * - Traps Tab / Shift+Tab focus within the dialog's focusable elements.
 * - Closes the dialog when Escape is pressed (via `onClose`).
 * - Restores focus to whatever element had focus before the dialog opened,
 *   once the dialog closes or unmounts.
 *
 * Returns a ref that must be attached to the dialog's outer container element.
 */
export function useDialogA11y<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
  initialFocusRef?: React.RefObject<HTMLElement | null>
) {
  const dialogRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose in a ref so callers can pass an inline arrow
  // function without retriggering this effect (and its focus-capture logic)
  // on every unrelated re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Defer so the dialog has been painted before we move focus into it.
    const focusTimer = window.setTimeout(() => {
      const target = initialFocusRef?.current ?? dialogRef.current;
      target?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const dialogNode = dialogRef.current;
      if (!dialogNode) {
        return;
      }

      const focusable = Array.from(
        dialogNode.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
      previouslyFocusedRef.current = null;
    };
  }, [isOpen, initialFocusRef]);

  return dialogRef;
}
