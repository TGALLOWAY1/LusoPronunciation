import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProgressStoreProvider } from '../state/progressStore';
import AppLayout from '../components/layout/AppLayout';
import Dashboard from '../pages/Dashboard';
import SentencePractice from '../pages/SentencePractice';
import WordPractice from '../pages/WordPractice';
import Review from '../pages/Review';

function App() {
  return (
    <ProgressStoreProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/practice/sentence" element={<SentencePractice />} />
            <Route path="/practice/word" element={<WordPractice />} />
            <Route path="/review" element={<Review />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </ProgressStoreProvider>
  );
}

export default App;

