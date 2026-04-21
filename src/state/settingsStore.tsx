import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { WordVoice } from '@/lib/storage';
import type { Difficulty } from '@/lib/types';

interface SettingsStore {
  selectedVoice: WordVoice;
  setSelectedVoice: (voice: WordVoice) => void;
  practiceCategories: string[];
  setPracticeCategories: (ids: string[]) => void;
  practiceDifficulties: Difficulty[];
  setPracticeDifficulties: (levels: Difficulty[]) => void;
}

const SettingsStoreContext = createContext<SettingsStore | null>(null);

const STORAGE_KEY = 'lusopronounce_preferredWordVoice';
const PRACTICE_CATEGORIES_KEY = 'lusopronounce_practice_categories';
const PRACTICE_DIFFICULTIES_KEY = 'lusopronounce_practice_difficulties';

function readStringArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // Fall through to default
  }
  return [];
}

function readDifficultyArray(key: string): Difficulty[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is Difficulty => v === 2 || v === 3 || v === 4);
    }
  } catch {
    // Fall through to default
  }
  return [];
}

/**
 * Provider component for global settings store.
 * Manages voice selection and practice filters, persists to localStorage.
 * SSR-safe: uses safe defaults and hydrates from localStorage on client.
 */
export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  const [selectedVoice, setSelectedVoiceState] = useState<WordVoice>('male');
  const [practiceCategories, setPracticeCategoriesState] = useState<string[]>([]);
  const [practiceDifficulties, setPracticeDifficultiesState] = useState<Difficulty[]>([]);

  // Hydrate from localStorage on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'male' || stored === 'female') {
        setSelectedVoiceState(stored);
      }
    } catch (error) {
      console.warn('Failed to read voice preference from localStorage:', error);
    }

    setPracticeCategoriesState(readStringArray(PRACTICE_CATEGORIES_KEY));
    setPracticeDifficultiesState(readDifficultyArray(PRACTICE_DIFFICULTIES_KEY));
  }, []);

  // Persist voice changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedVoice);
    } catch (error) {
      console.warn('Failed to save voice preference to localStorage:', error);
    }
  }, [selectedVoice]);

  // Persist practice category changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PRACTICE_CATEGORIES_KEY, JSON.stringify(practiceCategories));
    } catch (error) {
      console.warn('Failed to save practice categories to localStorage:', error);
    }
  }, [practiceCategories]);

  // Persist practice difficulty changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PRACTICE_DIFFICULTIES_KEY, JSON.stringify(practiceDifficulties));
    } catch (error) {
      console.warn('Failed to save practice difficulties to localStorage:', error);
    }
  }, [practiceDifficulties]);

  // Listen for storage changes (e.g., from other tabs)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'male' || e.newValue === 'female')) {
        setSelectedVoiceState(e.newValue);
      } else if (e.key === PRACTICE_CATEGORIES_KEY) {
        setPracticeCategoriesState(readStringArray(PRACTICE_CATEGORIES_KEY));
      } else if (e.key === PRACTICE_DIFFICULTIES_KEY) {
        setPracticeDifficultiesState(readDifficultyArray(PRACTICE_DIFFICULTIES_KEY));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for custom voice change events (from VoiceSettings component)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVoiceChange = (e: CustomEvent) => {
      if (e.detail?.voice && (e.detail.voice === 'male' || e.detail.voice === 'female')) {
        setSelectedVoiceState(e.detail.voice);
      }
    };

    window.addEventListener('voicePreferenceChanged', handleVoiceChange as EventListener);
    return () => {
      window.removeEventListener('voicePreferenceChanged', handleVoiceChange as EventListener);
    };
  }, []);

  const setSelectedVoice = useCallback((voice: WordVoice) => {
    setSelectedVoiceState(voice);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voicePreferenceChanged', { detail: { voice } }));
    }
  }, []);

  const setPracticeCategories = useCallback((ids: string[]) => {
    setPracticeCategoriesState(ids);
  }, []);

  const setPracticeDifficulties = useCallback((levels: Difficulty[]) => {
    setPracticeDifficultiesState(levels);
  }, []);

  const value = useMemo<SettingsStore>(
    () => ({
      selectedVoice,
      setSelectedVoice,
      practiceCategories,
      setPracticeCategories,
      practiceDifficulties,
      setPracticeDifficulties,
    }),
    [selectedVoice, setSelectedVoice, practiceCategories, setPracticeCategories, practiceDifficulties, setPracticeDifficulties]
  );

  return (
    <SettingsStoreContext.Provider value={value}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

/**
 * Hook to access the global settings store.
 * @throws Error if used outside SettingsStoreProvider
 */
export function useSettingsStore(): SettingsStore {
  const context = useContext(SettingsStoreContext);
  if (!context) {
    throw new Error('useSettingsStore must be used within SettingsStoreProvider');
  }
  return context;
}
