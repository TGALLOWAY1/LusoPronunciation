import { useEffect, useState } from 'react';
import { isAuthenticated } from '@/api/auth';
import { authenticatedFetch } from '@/api/auth';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';

const MIGRATION_FLAG_KEY = 'luso_cloud_migrated';

interface MigrationResult {
  importedSessions: number;
  importedAttempts: number;
  skippedSessions: number;
  skippedAttempts: number;
  errors: string[];
}

/**
 * LocalStorageMigrator component
 * 
 * Automatically migrates localStorage practice data to MongoDB when:
 * - User is authenticated
 * - Migration hasn't been completed yet
 * 
 * This component should be mounted high in the component tree (e.g., in App.tsx)
 * so it runs once after login.
 */
export default function LocalStorageMigrator() {
  const [migrationStatus, setMigrationStatus] = useState<
    'idle' | 'checking' | 'migrating' | 'completed' | 'error'
  >('idle');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const practiceLogStore = usePracticeLogStore();
  const progressStore = useProgressStore();

  useEffect(() => {
    async function performMigration() {
      // Check if user is authenticated
      if (!isAuthenticated()) {
        return;
      }

      // Check if migration has already been completed
      if (typeof window !== 'undefined') {
        const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY);
        if (alreadyMigrated === 'true') {
          setMigrationStatus('completed');
          return;
        }
      }

      setMigrationStatus('checking');

      try {
        // Read legacy data from stores
        const sessions = practiceLogStore.getAllSessions();
        const sentenceAttempts = practiceLogStore.getAllSentenceAttempts();
        const wordAttempts = practiceLogStore.getAllWordAttempts();
        const progressEntries = progressStore.entries;

        // Check if there's any data to migrate
        if (
          sessions.length === 0 &&
          sentenceAttempts.length === 0 &&
          wordAttempts.length === 0
        ) {
          // No data to migrate, mark as completed
          if (typeof window !== 'undefined') {
            localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
          }
          setMigrationStatus('completed');
          return;
        }

        setMigrationStatus('migrating');

        // Prepare migration payload
        const payload = {
          sessions,
          sentenceAttempts,
          wordAttempts,
          progress: progressEntries, // Include progress data for potential future use
        };

        // Call migration endpoint
        const response = await authenticatedFetch('/api/migrate/local-storage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
        }

        const result: MigrationResult = await response.json();
        setMigrationResult(result);

        // Mark migration as completed
        if (typeof window !== 'undefined') {
          localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
        }

        setMigrationStatus('completed');

        // Log migration results
        console.log('[Migration] Migration completed:', {
          importedSessions: result.importedSessions,
          importedAttempts: result.importedAttempts,
          skippedSessions: result.skippedSessions,
          skippedAttempts: result.skippedAttempts,
          errors: result.errors.length,
        });

        if (result.errors.length > 0) {
          console.warn('[Migration] Some items failed to migrate:', result.errors);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setMigrationStatus('error');
        console.error('[Migration] Migration failed:', err);
      }
    }

    performMigration();
  }, [practiceLogStore, progressStore]);

  // This component doesn't render anything visible
  // It runs silently in the background
  return null;
}

