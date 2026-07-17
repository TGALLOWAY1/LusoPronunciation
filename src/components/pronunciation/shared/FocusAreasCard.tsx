import { Target } from 'lucide-react';
import type { NormalizedWordFeedback } from './types';
import { getPhonemeById } from '@/lib/phonemeMetadata';

interface FocusAreasCardProps {
  words: NormalizedWordFeedback[];
}

interface ProblemPhoneme {
  symbol: string;
  score: number;
  tip: string;
}

/**
 * Collapse all words' problem phonemes into a deduped list, keyed by symbol.
 * When the same phoneme appears in multiple words, keeps the lowest score.
 */
function collectProblemPhonemes(words: NormalizedWordFeedback[]): ProblemPhoneme[] {
  const bySymbol = new Map<string, ProblemPhoneme>();

  for (const word of words) {
    if (!word.phonemes) continue;
    for (const phoneme of word.phonemes) {
      if (!phoneme.isProblem) continue;
      const existing = bySymbol.get(phoneme.symbol);
      if (existing && existing.score <= phoneme.score) continue;

      const metadata = getPhonemeById(phoneme.symbol);
      const tip =
        phoneme.tip ||
        metadata?.teachingTips?.[0] ||
        metadata?.englishApprox ||
        metadata?.articulation ||
        `Needs more precision.`;
      bySymbol.set(phoneme.symbol, {
        symbol: phoneme.symbol,
        score: phoneme.score,
        tip,
      });
    }
  }

  return Array.from(bySymbol.values()).sort((a, b) => a.score - b.score);
}

/**
 * Standalone Focus Areas card surfacing the lowest-scoring problem phonemes
 * across the entire sentence. Rendered below Sound Details on the practice page.
 */
export default function FocusAreasCard({ words }: FocusAreasCardProps) {
  const problems = collectProblemPhonemes(words);
  if (problems.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary-100 dark:border-primary-900/50 bg-primary-50/60 dark:bg-primary-900/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="shrink-0 w-7 h-7 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border border-primary-200 dark:border-primary-800">
          <Target size={14} className="text-primary-600 dark:text-primary-400" />
        </div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Focus Areas
        </h4>
      </div>
      <ul className="space-y-1 pl-9">
        {problems.map((p) => (
          <li
            key={p.symbol}
            className="text-sm text-gray-700 dark:text-gray-300 flex gap-2"
          >
            <span className="text-primary-500 dark:text-primary-400 shrink-0">•</span>
            <span>
              <strong className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                {p.symbol}:
              </strong>{' '}
              {p.tip}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
