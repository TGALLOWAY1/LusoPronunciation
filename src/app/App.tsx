import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { ProgressStoreProvider } from '../state/progressStore';
import { SettingsStoreProvider } from '../state/settingsStore';
import { PracticeLogStoreProvider } from '../state/practiceLogStore';
import AppLayout from '../components/layout/AppLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import LocalStorageMigrator from '../features/migration/LocalStorageMigrator';
import PracticePage from '../pages/PracticePage';
import ProgressPage from '../pages/ProgressPage';
import Review from '../pages/Review';
import SentenceBuilderPage from '../pages/SentenceBuilderPage';
import SettingsPage from '../pages/SettingsPage';
import AuthPage from '../pages/AuthPage';
import OAuthCallbackPage from '../pages/OAuthCallbackPage';
import { isAuthenticated, pingSpeechServiceHealth } from '@/api/auth';
import RequireAuth from '@/components/auth/RequireAuth';

// Dev-only pages — lazy loaded and tree-shaken from production bundle
const PronunciationFixtures = lazy(() => import('../pages/dev/pronunciation-fixtures'));
const DevAnalyticsPage = lazy(() => import('../pages/dev/DevAnalyticsPage'));
const DevMetricsPage = lazy(() => import('../pages/dev/DevMetricsPage'));

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<RequireAuth><PracticePage /></RequireAuth>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<OAuthCallbackPage />} />
          <Route path="/practice/sentence" element={<Navigate to="/" replace />} />
          <Route path="/practice/word" element={<Navigate to="/?tab=words" replace />} />
          <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
          <Route path="/sessions" element={<Navigate to="/review" replace />} />
          <Route path="/builder" element={<RequireAuth><SentenceBuilderPage /></RequireAuth>} />
          <Route path="/progress" element={<RequireAuth><ProgressPage /></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
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
