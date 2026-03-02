import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import PronunciationFixtures from '../pages/dev/pronunciation-fixtures';
import DevAnalyticsPage from '../pages/dev/DevAnalyticsPage';
import DevMetricsPage from '../pages/dev/DevMetricsPage';

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
          <Route path="/dev/pronunciation-fixtures" element={<PronunciationFixtures />} />
          <Route path="/dev/analytics" element={<DevAnalyticsPage />} />
          <Route path="/dev/metrics" element={<DevMetricsPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

function App() {
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
