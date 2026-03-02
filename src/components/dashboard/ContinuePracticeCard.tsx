import { Link } from 'react-router-dom';

interface ContinuePracticeCardProps {
  lastMode: 'sentence' | 'word' | null;
}

export default function ContinuePracticeCard({ lastMode }: ContinuePracticeCardProps) {
  const href = lastMode === 'word' ? '/practice/words' : '/practice/sentences';
  const label = lastMode === 'word' ? 'Continue Word Practice' : 'Continue Sentence Practice';
  const description =
    lastMode === 'word'
      ? 'Pick up where you left off with vocabulary drills.'
      : 'Keep improving your sentence pronunciation flow.';

  return (
    <Link
      to={href}
      className="block bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-lg shadow-lg p-6 text-white hover:shadow-xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-xl font-bold">{label}</h3>
        <span className="text-3xl">▶</span>
      </div>
      <p className="text-emerald-50">{description}</p>
    </Link>
  );
}
