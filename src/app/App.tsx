import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProgressStoreProvider } from '../state/progressStore';
import { SettingsStoreProvider } from '../state/settingsStore';
import { PracticeLogStoreProvider } from '../state/practiceLogStore';
import AppLayout from '../components/layout/AppLayout';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import Dashboard from '../pages/Dashboard';
import SentencePractice from '../pages/SentencePractice';
import WordPractice from '../pages/WordPractice';
import Review from '../pages/Review';
import PronunciationFixtures from '../pages/dev/pronunciation-fixtures';
import DevAnalyticsPage from '../pages/dev/DevAnalyticsPage';

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/practice/sentence" element={<SentencePractice />} />
          <Route path="/practice/word" element={<WordPractice />} />
          <Route path="/review" element={<Review />} />
          <Route path="/dev/pronunciation-fixtures" element={<PronunciationFixtures />} />
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

