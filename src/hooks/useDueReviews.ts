/**
 * useDueReviews — shared access to the server-side SM-2 review queue.
 *
 * The authoritative "what's due" list lives in MongoDB (FlashcardModel) and is
 * served by GET /api/flashcards/due. This hook is the single client-side entry
 * point for that queue: the Review page consumes the full card list, while the
 * Momentum strip / practice nudge consume just the count.
 *
 * State is held in a module-level store (not a React context) so every mounted
 * consumer shares one cached fetch and re-renders together when the queue is
 * refreshed after a grade — without needing a new provider in the app tree.
 *
 * For unauthenticated users the queue is empty here; callers fall back to the
 * local (offline) progressStore queue in that case.
 */
import { useCallback, useEffect, useState } from 'react';
import { getDueFlashcards, type Flashcard } from '@/api/flashcards';
import { isAuthenticated } from '@/api/auth';

// The /due endpoint caps at 100; this is plenty for both the queue and the badge.
const DUE_FETCH_LIMIT = 100;
// Treat a fetch as fresh for this long to avoid refetching on every mount.
const FRESHNESS_MS = 30_000;

interface DueStore {
  cards: Flashcard[];
  loading: boolean;
  error: boolean;
  fetchedAt: number;
}

let store: DueStore = { cards: [], loading: false, error: false, fetchedAt: 0 };
const subscribers = new Set<() => void>();
let inFlight: Promise<void> | null = null;

function emit(): void {
  subscribers.forEach((fn) => fn());
}

function patch(next: Partial<DueStore>): void {
  store = { ...store, ...next };
  emit();
}

async function load(force: boolean): Promise<void> {
  if (!isAuthenticated()) {
    // No server queue for anonymous sessions — leave it empty and let callers
    // fall back to the local queue.
    patch({ cards: [], loading: false, error: false, fetchedAt: Date.now() });
    return;
  }

  const isFresh = store.fetchedAt !== 0 && Date.now() - store.fetchedAt < FRESHNESS_MS;
  if (!force && isFresh) return;
  if (inFlight) return inFlight;

  patch({ loading: true });
  inFlight = getDueFlashcards(DUE_FETCH_LIMIT)
    .then((cards) => {
      patch({ cards, loading: false, error: false, fetchedAt: Date.now() });
    })
    .catch((err) => {
      console.warn('[useDueReviews] Failed to fetch due flashcards:', err);
      patch({ loading: false, error: true, fetchedAt: Date.now() });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export interface UseDueReviewsResult {
  /** Due flashcards from the server SM-2 queue (empty when unauthenticated). */
  dueCards: Flashcard[];
  /** Number of due cards from the server queue. */
  dueCount: number;
  /** True while a fetch is in flight. */
  loading: boolean;
  /** True if the last fetch failed — callers should fall back to the local queue. */
  error: boolean;
  /** True once at least one fetch attempt has resolved (success or failure). */
  initialized: boolean;
  /** Whether the current session is authenticated (server queue is available). */
  authenticated: boolean;
  /** Force a refetch (call after grading a card so the queue reflects the change). */
  refresh: () => Promise<void>;
}

export function useDueReviews(): UseDueReviewsResult {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const notify = () => forceRender((n) => n + 1);
    subscribers.add(notify);
    void load(false);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  const refresh = useCallback(() => load(true), []);

  return {
    dueCards: store.cards,
    dueCount: store.cards.length,
    loading: store.loading,
    error: store.error,
    initialized: store.fetchedAt !== 0,
    authenticated: isAuthenticated(),
    refresh,
  };
}
