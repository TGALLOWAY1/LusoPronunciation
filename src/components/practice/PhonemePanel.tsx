import { useState } from 'react';
import { AudioLines, Eye, EyeOff } from 'lucide-react';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import type { Word } from '@/lib/types';
import { useSettingsStore } from '@/state/settingsStore';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';

interface PhonemePanelProps {
  word: Word;
}

/**
 * Small circular "hear it" button rendered on each phoneme row.
 * Plays the word's native pronunciation as context for the phoneme.
 */
function PhonemeSoundButton({ audioUrl }: { audioUrl: string | null | undefined }) {
  const { play, pause, isPlaying, isLoading } = useAudioPlayer(audioUrl || null);

  return (
    <button
      type="button"
      onClick={isPlaying ? pause : play}
      disabled={!audioUrl || isLoading}
      aria-label={isPlaying ? 'Stop sound' : 'Play sound'}
      className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-colors
        ${
          isPlaying
            ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300'
            : 'border-gray-200 text-gray-400 hover:text-primary-600 hover:border-primary-300 dark:border-gray-600 dark:text-gray-500 dark:hover:text-primary-300'
        }
        disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <AudioLines size={16} className={isPlaying ? 'animate-pulse' : ''} />
    </button>
  );
}

/**
 * Panel displaying phoneme details and tips for a word during practice.
 * Uses canonical phoneme metadata from data/phoneme_metadata.json.
 */
export function PhonemePanel({ word }: PhonemePanelProps) {
  const { selectedVoice } = useSettingsStore();
  const [showIpa, setShowIpa] = useState(false);

  if (!word.phonemes || word.phonemes.length === 0) {
    return null;
  }

  const phonemeItems = word.phonemes
    .map((id) => getPhonemeById(id))
    .filter((p): p is NonNullable<ReturnType<typeof getPhonemeById>> => !!p);

  if (phonemeItems.length === 0) {
    return null;
  }

  const audioUrl = selectedVoice === 'male' ? word.audioMaleUrl : word.audioFemaleUrl;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Pronunciation Breakdown
        </h4>
        <button
          type="button"
          onClick={() => setShowIpa((v) => !v)}
          aria-pressed={showIpa}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          {showIpa ? <EyeOff size={14} /> : <Eye size={14} />}
          {showIpa ? 'Hide IPA' : 'Show IPA'}
        </button>
      </div>

      <div className="space-y-2.5">
        {phonemeItems.map((p, index) => (
          <div
            key={`${p.id}-${index}`}
            className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 border border-gray-100 dark:border-gray-700"
          >
            {/* Phoneme symbol tile */}
            <div className="shrink-0 w-14 h-14 rounded-lg bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800/50 flex flex-col items-center justify-center leading-none">
              <span className="text-xl font-bold text-primary-700 dark:text-primary-300 font-mono">
                {p.ipa}
              </span>
              <span className="mt-0.5 text-[10px] text-primary-600/80 dark:text-primary-400/80 font-mono">
                {showIpa ? `/${p.ipa}/` : `(${p.id})`}
              </span>
            </div>

            {/* Tip + examples */}
            <div className="flex-1 min-w-0">
              {p.teachingTips && p.teachingTips.length > 0 && (
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {p.teachingTips[0]}
                </p>
              )}
              {p.exampleWords && p.exampleWords.length > 0 && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium">Ex: </span>
                  <span className="font-mono">
                    {p.exampleWords.slice(0, 2).map((ex) => ex.pt).join(' , ')}
                  </span>
                </p>
              )}
            </div>

            <PhonemeSoundButton audioUrl={audioUrl} />
          </div>
        ))}
      </div>
    </div>
  );
}
