import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ProgressStoreProvider } from '../state/progressStore';
import { SettingsStoreProvider } from '../state/settingsStore';
import { PracticeLogStoreProvider } from '../state/practiceLogStore';
import AppLayout from '../components/layout/AppLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import LocalStorageMigrator from '../features/migration/LocalStorageMigrator';
import UserDashboardPage from '../pages/UserDashboardPage';
import SentencePractice from '../pages/SentencePractice';
import WordPractice from '../pages/WordPractice';
import Review from '../pages/Review';
import RecentSessions from '../pages/RecentSessions';
import AuthPage from '../pages/AuthPage';
import { isAuthenticated, pingSpeechServiceHealth } from '@/api/auth';

// Dev-only pages — lazy loaded and tree-shaken from production bundle
const PronunciationFixtures = lazy(() => import('../pages/dev/pronunciation-fixtures'));
const DevAnalyticsPage = lazy(() => import('../pages/dev/DevAnalyticsPage'));
const DevMetricsPage = lazy(() => import('../pages/dev/DevMetricsPage'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<UserDashboardPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/practice/sentence" element={<SentencePractice />} />
          <Route path="/practice/word" element={<WordPractice />} />
          <Route path="/review" element={<Review />} />
          <Route path="/sessions" element={<RecentSessions />} />
          {import.meta.env.DEV && (
            <>
              <Route path="/dev/pronunciation-fixtures" element={<Suspense fallback={null}><PronunciationFixtures /></Suspense>} />
              <Route path="/dev/analytics" element={<Suspense fallback={null}><DevAnalyticsPage /></Suspense>} />
              <Route path="/dev/metrics" element={<Suspense fallback={null}><DevMetricsPage /></Suspense>} />
            </>
          )}
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

function App() {
  useEffect(() => {
    if (!isAuthenticated()) {
      return;
    }

    void pingSpeechServiceHealth();
  }, []);

  return (
    <ErrorBoundary>
      <SettingsStoreProvider>
        <ProgressStoreProvider>
          <PracticeLogStoreProvider>
            <LocalStorageMigrator />
            <AppRoutes />
          </PracticeLogStoreProvider>
        </ProgressStoreProvider>
      </SettingsStoreProvider>
    </ErrorBoundary>
  );
}

export default App;
