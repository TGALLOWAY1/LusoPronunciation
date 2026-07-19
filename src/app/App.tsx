import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import CustomSentenceListPage from '../pages/CustomSentenceListPage';
import CustomSentencePracticePage from '../pages/CustomSentencePracticePage';
import AdminLexiconPage from '../pages/AdminLexiconPage';
import SettingsPage from '../pages/SettingsPage';
import AuthPage from '../pages/AuthPage';
import OAuthCallbackPage from '../pages/OAuthCallbackPage';
import TourPage from '../pages/TourPage';
import DemoPage from '../pages/DemoPage';
import { isAuthenticated, pingSpeechServiceHealth } from '@/api/auth';
import RequireAuth from '@/components/auth/RequireAuth';

// Dev-only pages — lazy loaded and tree-shaken from production bundle
const PronunciationFixtures = lazy(() => import('../pages/dev/pronunciation-fixtures'));
const DevAnalyticsPage = lazy(() => import('../pages/dev/DevAnalyticsPage'));
const DevMetricsPage = lazy(() => import('../pages/dev/DevMetricsPage'));

function AppShell() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<RequireAuth><PracticePage /></RequireAuth>} />
        <Route path="/practice/sentence" element={<Navigate to="/" replace />} />
        <Route path="/practice/word" element={<Navigate to="/?tab=words" replace />} />
        <Route path="/review" element={<RequireAuth><Review /></RequireAuth>} />
        <Route path="/sessions" element={<Navigate to="/review" replace />} />
        <Route path="/builder" element={<RequireAuth><SentenceBuilderPage /></RequireAuth>} />
        <Route path="/sentences/custom" element={<RequireAuth><CustomSentenceListPage /></RequireAuth>} />
        <Route path="/practice/custom/:id" element={<RequireAuth><CustomSentencePracticePage /></RequireAuth>} />
        <Route path="/admin/lexicon" element={<RequireAuth><AdminLexiconPage /></RequireAuth>} />
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
  );
}

/**
 * On every route change: scroll the window to the top (so navigating never
 * leaves the viewport mid-scroll on the previous page) and move focus to the
 * main content landmark (the `#main-content` element AppLayout renders),
 * matching the "route change = new page" mental model for screen reader and
 * keyboard users. A no-op on routes that don't render AppLayout (e.g. /tour,
 * /auth) since there's no `#main-content` there.
 */
function ScrollAndFocusOnRouteChange() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.getElementById('main-content');
    main?.focus();
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollAndFocusOnRouteChange />
      <Routes>
        {/* Public, unauthenticated marketing surfaces (own standalone layout) */}
        <Route path="/tour" element={<TourPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        {/* Everything else runs inside the authenticated app shell */}
        <Route path="/*" element={<AppShell />} />
      </Routes>
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
