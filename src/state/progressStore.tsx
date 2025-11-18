import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { DifficultyRating } from '@/components/practice/DifficultyButtons';

export type ItemType = 'sentence' | 'word';
export type WordAction = 'know' | 'review';

interface ProgressEntry {
  itemId: string;
  itemType: ItemType;
  lastRating?: DifficultyRating | WordAction;
  lastReviewedAt?: string; // ISO timestamp
  nextReviewAt?: string; // ISO timestamp
  reviewCount: number;
}

interface ProgressStore {
  entries: Record<string, ProgressEntry>;
  storageError: boolean;
  rateSentence: (sentenceId: string, rating: DifficultyRating) => void;
  rateWord: (wordId: string, action: WordAction) => void;
  getDueItems: (itemType?: ItemType) => ProgressEntry[];
  getDueCount: (itemType?: ItemType) => number;
  getProgressEntry: (itemId: string, itemType: ItemType) => ProgressEntry | null;
}

const ProgressStoreContext = createContext<ProgressStore | null>(null);

const STORAGE_KEY = 'lusopronounce_progress';

// Calculate next review time based on rating
function calculateNextReview(rating: DifficultyRating | WordAction): Date {
  const now = new Date();
  const hours = {
    easy: 24,      // Easy → +24h
    good: 8,       // Good → +8h
    hard: 1,       // Hard → +1h
    know: 48,      // Know it → +48h
    review: 2,    // Review later → +2h
  };

  const delayHours = hours[rating] || 8;
  const nextReview = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
  return nextReview;
}

function loadProgressFromStorage(): Record<string, ProgressEntry> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading progress from storage:', error);
  }
  return {};
}

/**
 * Saves progress to localStorage with quota error handling.
 * @returns true if save was successful, false if quota exceeded or other error
 */
function saveProgressToStorage(entries: Record<string, ProgressEntry>): boolean {
  try {
    const serialized = JSON.stringify(entries);
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    // Check if it's a quota exceeded error
    if (error instanceof DOMException && (
      error.code === 22 || // QUOTA_EXCEEDED_ERR
      error.code === 1014 || // NS_ERROR_DOM_QUOTA_REACHED
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    )) {
      console.error('Storage quota exceeded. Unable to save progress.');
      return false;
    }
    console.error('Error saving progress to storage:', error);
    return false;
  }
}

function getEntryKey(itemId: string, itemType: ItemType): string {
  return `${itemType}:${itemId}`;
}

export function ProgressStoreProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, ProgressEntry>>(() =>
    loadProgressFromStorage()
  );
  const [storageError, setStorageError] = useState(false);

  // Save to localStorage whenever entries change
  useEffect(() => {
    const success = saveProgressToStorage(entries);
    setStorageError(!success);
  }, [entries]);

  const rateSentence = (sentenceId: string, rating: DifficultyRating) => {
    const key = getEntryKey(sentenceId, 'sentence');
    const now = new Date().toISOString();
    const nextReview = calculateNextReview(rating).toISOString();

    setEntries((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          itemId: sentenceId,
          itemType: 'sentence',
          lastRating: rating,
          lastReviewedAt: now,
          nextReviewAt: nextReview,
          reviewCount: (existing?.reviewCount || 0) + 1,
        },
      };
    });
  };

  const rateWord = (wordId: string, action: WordAction) => {
    const key = getEntryKey(wordId, 'word');
    const now = new Date().toISOString();
    const nextReview = calculateNextReview(action).toISOString();

    setEntries((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: {
          itemId: wordId,
          itemType: 'word',
          lastRating: action,
          lastReviewedAt: now,
          nextReviewAt: nextReview,
          reviewCount: (existing?.reviewCount || 0) + 1,
        },
      };
    });
  };

  const getDueItems = (itemType?: ItemType): ProgressEntry[] => {
    const now = new Date();
    return Object.values(entries).filter((entry) => {
      if (itemType && entry.itemType !== itemType) return false;
      if (!entry.nextReviewAt) return false;
      return new Date(entry.nextReviewAt) <= now;
    });
  };

  const getDueCount = (itemType?: ItemType): number => {
    return getDueItems(itemType).length;
  };

  const getProgressEntry = (itemId: string, itemType: ItemType): ProgressEntry | null => {
    const key = getEntryKey(itemId, itemType);
    return entries[key] || null;
  };

  const value: ProgressStore = {
    entries,
    storageError,
    rateSentence,
    rateWord,
    getDueItems,
    getDueCount,
    getProgressEntry,
  };

  return (
    <ProgressStoreContext.Provider value={value}>
      {children}
    </ProgressStoreContext.Provider>
  );
}

export function useProgressStore(): ProgressStore {
  const context = useContext(ProgressStoreContext);
  if (!context) {
    throw new Error('useProgressStore must be used within ProgressStoreProvider');
  }
  return context;
}

