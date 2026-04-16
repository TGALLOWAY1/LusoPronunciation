import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlignLeft, CaseSensitive } from 'lucide-react';
import SentencePractice from './SentencePractice';
import WordPractice from './WordPractice';

type PracticeTab = 'sentences' | 'words';

export default function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const initialTab: PracticeTab = paramTab === 'words' ? 'words' : 'sentences';
  const [activeTab, setActiveTab] = useState<PracticeTab>(initialTab);

  function handleTabChange(tab: PracticeTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'sentences' ? {} : { tab }, { replace: true });
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => handleTabChange('sentences')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'sentences'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <AlignLeft size={16} />
          Sentences
        </button>
        <button
          onClick={() => handleTabChange('words')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'words'
              ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CaseSensitive size={16} />
          Words
        </button>
      </div>

      {/* Tab content — key forces remount on tab switch so session lifecycle is correct */}
      {activeTab === 'sentences' ? (
        <SentencePractice key="sentences" />
      ) : (
        <WordPractice key="words" />
      )}
    </div>
  );
}
