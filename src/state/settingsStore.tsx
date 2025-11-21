import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { WordVoice } from '@/lib/storage';

interface SettingsStore {
  selectedVoice: WordVoice;
  setSelectedVoice: (voice: WordVoice) => void;
}

const SettingsStoreContext = createContext<SettingsStore | null>(null);

const STORAGE_KEY = 'lusopronounce_preferredWordVoice';

/**
 * Provider component for global settings store.
 * Manages voice selection and persists to localStorage.
 * SSR-safe: uses safe default and hydrates from localStorage on client.
 */
export function SettingsStoreProvider({ children }: { children: ReactNode }) {
  // Safe default for SSR - will hydrate from localStorage on client
  const [selectedVoice, setSelectedVoiceState] = useState<WordVoice>('male');

  // Hydrate from localStorage on client mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'male' || stored === 'female') {
        setSelectedVoiceState(stored);
      }
    } catch (error) {
      // Fail silently - use default
      console.warn('Failed to read voice preference from localStorage:', error);
    }
  }, []);

  // Persist changes to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedVoice);
    } catch (error) {
      // Fail silently
      console.warn('Failed to save voice preference to localStorage:', error);
    }
  }, [selectedVoice]);

  // Listen for storage changes (e.g., from other tabs)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'male' || e.newValue === 'female')) {
        setSelectedVoiceState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Listen for custom events (e.g., from VoiceSettings component)
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
    // Persistence is handled by the useEffect above
    // Dispatch custom event for immediate updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('voicePreferenceChanged', { detail: { voice } }));
    }
  }, []);

  const value = useMemo<SettingsStore>(
    () => ({
      selectedVoice,
      setSelectedVoice,
    }),
    [selectedVoice, setSelectedVoice]
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

