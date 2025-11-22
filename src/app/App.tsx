import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProgressStoreProvider } from '../state/progressStore';
import { SettingsStoreProvider } from '../state/settingsStore';
import { PracticeLogStoreProvider } from '../state/practiceLogStore';
import AppLayout from '../components/layout/AppLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import UserDashboardPage from '../pages/UserDashboardPage';
// TODO: SentencePractice is temporarily unused while we align it to the Pronunciation Lab layout.
// import SentencePractice from '../pages/SentencePractice';
import WordPractice from '../pages/WordPractice';
import Review from '../pages/Review';
import RecentSessions from '../pages/RecentSessions';
import PronunciationFixtures from '../pages/dev/pronunciation-fixtures';
import DevAnalyticsPage from '../pages/dev/DevAnalyticsPage';

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<UserDashboardPage />} />
          <Route path="/practice/sentence" element={<PronunciationFixtures />} />
          <Route path="/practice/word" element={<WordPractice />} />
          <Route path="/review" element={<Review />} />
          <Route path="/sessions" element={<RecentSessions />} />
          <Route path="/dev/analytics" element={<DevAnalyticsPage />} />
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
            <AppRoutes />
          </PracticeLogStoreProvider>
        </ProgressStoreProvider>
      </SettingsStoreProvider>
    </ErrorBoundary>
  );
}

export default App;

