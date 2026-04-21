import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlignLeft, CaseSensitive } from 'lucide-react';
import { usePracticeLogStore } from '@/state/practiceLogStore';
import { useProgressStore } from '@/state/progressStore';
import { computeUserGlobalStats } from '@/lib/practiceAnalytics';
import MomentumStrip from '@/components/common/MomentumStrip';
import SentencePractice from './SentencePractice';
import WordPractice from './WordPractice';

type PracticeTab = 'sentences' | 'words';

export default function PracticePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramTab = searchParams.get('tab');
  const initialTab: PracticeTab = paramTab === 'words' ? 'words' : 'sentences';
  const [activeTab, setActiveTab] = useState<PracticeTab>(initialTab);

  const { sessions, sentenceAttempts, wordAttempts } = usePracticeLogStore();
  const { getDueCount } = useProgressStore();
  const dueCount = getDueCount();

  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;
    // Lightweight streak calc — reuse computeUserGlobalStats only when sessions exist
    const stats = computeUserGlobalStats(sessions, sentenceAttempts, wordAttempts, 0, 0);
    return stats.currentDailyStreak;
  }, [sessions, sentenceAttempts, wordAttempts]);

  const todayAttempts = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const sentenceCount = sentenceAttempts.filter(
      (a) => new Date(a.createdAt).toISOString().split('T')[0] === todayStr,
    ).length;
    const wordCount = wordAttempts.filter(
      (a) => new Date(a.createdAt).toISOString().split('T')[0] === todayStr,
    ).length;
    return sentenceCount + wordCount;
  }, [sentenceAttempts, wordAttempts]);

  function handleTabChange(tab: PracticeTab) {
    setActiveTab(tab);
    setSearchParams(tab === 'sentences' ? {} : { tab }, { replace: true });
  }

  const tabBar = (
    <div className="flex gap-6 -mb-px">
      <button
        onClick={() => handleTabChange('sentences')}
        className={`flex items-center gap-2 py-2 text-sm font-medium transition-colors border-b-2 ${
          activeTab === 'sentences'
            ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
      >
        <AlignLeft size={16} />
        Sentences
      </button>
      <button
        onClick={() => handleTabChange('words')}
        className={`flex items-center gap-2 py-2 text-sm font-medium transition-colors border-b-2 ${
          activeTab === 'words'
            ? 'border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-400'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }`}
      >
        <CaseSensitive size={16} />
        Words
      </button>
    </div>
  );

  return (
    <div>
      {/* Mobile-only momentum strip — desktop shows it in the sidebar */}
      <div className="mb-4 lg:hidden">
        <MomentumStrip
          streak={streak}
          todayAttempts={todayAttempts}
          dueCount={dueCount}
        />
      </div>

      {/* Tab content — key forces remount on tab switch so session lifecycle is correct */}
      {activeTab === 'sentences' ? (
        <SentencePractice key="sentences" headerElement={tabBar} />
      ) : (
        <WordPractice key="words" headerElement={tabBar} />
      )}
    </div>
  );
}
