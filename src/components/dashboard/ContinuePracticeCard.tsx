import { Link } from 'react-router-dom';

interface ContinuePracticeCardProps {
  lastMode: 'sentence' | 'word' | null;
}

export default function ContinuePracticeCard({ lastMode }: ContinuePracticeCardProps) {
  if (!lastMode) {
    return (
      <div className="bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-xl font-bold">Start Practicing</h3>
            <p className="text-primary-50 mt-2">
              Begin your Portuguese pronunciation journey!
            </p>
          </div>
          <span className="text-3xl">🎯</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/practice/sentence"
            className="flex-1 bg-white text-primary-600 font-semibold py-2 px-4 rounded-lg text-center hover:bg-primary-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-500"
          >
            Practice Sentences
          </Link>
          <Link
            to="/practice/word"
            className="flex-1 bg-white/20 text-white font-semibold py-2 px-4 rounded-lg text-center hover:bg-white/30 transition-colors border border-white/30 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-500"
          >
            Practice Words
          </Link>
        </div>
      </div>
    );
  }

  const modeInfo = {
    sentence: {
      title: 'Continue Sentence Practice',
      description: 'Practice pronouncing full Portuguese sentences',
      icon: '💬',
      path: '/practice/sentence',
    },
    word: {
      title: 'Continue Word Practice',
      description: 'Practice individual Portuguese words',
      icon: '📝',
      path: '/practice/word',
    },
  };

  const info = modeInfo[lastMode];

  return (
    <Link
      to={info.path}
      className="block bg-gradient-to-br from-primary-500 to-primary-600 dark:from-primary-600 dark:to-primary-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-xl font-bold">{info.title}</h3>
          <p className="text-primary-50 mt-2">{info.description}</p>
        </div>
        <span className="text-3xl">{info.icon}</span>
      </div>
      <div className="flex items-center text-sm font-medium">
        Continue →
      </div>
    </Link>
  );
}

