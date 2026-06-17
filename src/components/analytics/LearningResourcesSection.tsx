import { GraduationCap, ExternalLink, Play } from 'lucide-react';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import { getPhonemeResources, getWordResources } from '@/lib/learningResources';
import type { LearningResource } from '@/lib/types';

interface LearningResourcesSectionProps {
  /** Canonical/Azure phoneme ids the learner struggles with (already prioritized). */
  weakPhonemeIds: string[];
  /** Words the learner should review (already prioritized). */
  focusWords: { textPt: string }[];
}

function ResourceLinks({ resources }: { resources: LearningResource[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {resources.map((res) => (
        <li key={res.url}>
          <a
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {res.source === 'youtube-search' ? (
              <Play size={13} className="shrink-0" />
            ) : (
              <ExternalLink size={13} className="shrink-0" />
            )}
            {res.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Learning Resources: clickable pronunciation tutorials for the learner's hardest
 * sounds and words. Resource links are generated deterministically (see
 * src/lib/learningResources.ts) — no manual curation or API key required.
 */
export default function LearningResourcesSection({
  weakPhonemeIds,
  focusWords,
}: LearningResourcesSectionProps) {
  const hasData = weakPhonemeIds.length > 0 || focusWords.length > 0;

  return (
    <section id="resources" className="card scroll-mt-20">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap size={18} className="text-primary-500 dark:text-primary-400" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Learning Resources
        </h2>
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
          As you practice, tutorials for the sounds and words you find hardest will
          appear here.
        </p>
      ) : (
        <div className="space-y-4">
          {weakPhonemeIds.map((phonemeId) => {
            const meta = getPhonemeById(phonemeId);
            return (
              <div
                key={phonemeId}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
                    Problem Sound
                  </span>
                  <span className="font-mono text-base font-semibold text-gray-900 dark:text-gray-100">
                    {meta?.ipa ?? phonemeId}
                  </span>
                  {meta?.category && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {meta.category}
                    </span>
                  )}
                </div>
                {meta?.teachingTips?.[0] && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {meta.teachingTips[0]}
                  </p>
                )}
                <ResourceLinks resources={getPhonemeResources(phonemeId)} />
              </div>
            );
          })}

          {focusWords.map((word) => (
            <div
              key={word.textPt}
              className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400 dark:text-gray-500">
                  Word
                </span>
                <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {word.textPt}
                </span>
              </div>
              <ResourceLinks resources={getWordResources(word)} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
