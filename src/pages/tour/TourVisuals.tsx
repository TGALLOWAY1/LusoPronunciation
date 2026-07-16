import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CircleAlert,
  FileAudio,
  Info,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import { getDemoItem, getDemoNativeAudioUrl } from '@/lib/demo/demoData';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import { PIPELINE_STAGES } from './tourContent';

const SAMPLE = getDemoItem('gemini_family_friends_001') ?? getDemoItem('gemini_small_talk_001')!;

type ScoreBand = {
  label: string;
  text: string;
  border: string;
  background: string;
  bar: string;
};

function scoreBand(score: number): ScoreBand {
  if (score >= 88) {
    return {
      label: 'Strong',
      text: 'text-emerald-300',
      border: 'border-emerald-400/35',
      background: 'bg-emerald-400/10',
      bar: 'bg-emerald-400',
    };
  }
  if (score >= 75) {
    return {
      label: 'On track',
      text: 'text-primary-300',
      border: 'border-primary-400/35',
      background: 'bg-primary-400/10',
      bar: 'bg-primary-400',
    };
  }
  if (score >= 60) {
    return {
      label: 'Needs attention',
      text: 'text-amber-300',
      border: 'border-amber-400/35',
      background: 'bg-amber-400/10',
      bar: 'bg-amber-400',
    };
  }
  return {
    label: 'Retry',
    text: 'text-rose-300',
    border: 'border-rose-400/35',
    background: 'bg-rose-400/10',
    bar: 'bg-rose-400',
  };
}

export function SampleLabel({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
      <Info size={compact ? 10 : 12} aria-hidden="true" />
      {compact ? 'Illustrative' : 'Illustrative scored attempt'}
    </span>
  );
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  const band = scoreBand(value);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`font-semibold ${band.text}`}>{value}/100</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${band.bar}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function cleanWord(value: string): string {
  return value.replace(/[.,!?]/g, '');
}

/** Interactive, deterministic sample used as the hero product demonstration. */
export function InteractiveAttemptFrame() {
  const [selectedWordIndex, setSelectedWordIndex] = useState(0);
  const [selectedPhonemeIndex, setSelectedPhonemeIndex] = useState(2);

  const selectedWord = SAMPLE.words[selectedWordIndex] ?? SAMPLE.words[0];
  const selectedPhoneme = selectedWord.phonemes[selectedPhonemeIndex] ?? selectedWord.phonemes[0];
  const metadata = getPhonemeById(selectedPhoneme.symbol);
  const wordBand = scoreBand(selectedWord.score);
  const phonemeBand = scoreBand(selectedPhoneme.score);

  const problemSounds = useMemo(
    () =>
      SAMPLE.words.flatMap((word, wordIndex) =>
        word.phonemes
          .map((phoneme, phonemeIndex) => ({ word, wordIndex, phoneme, phonemeIndex }))
          .filter(({ phoneme }) => phoneme.score < 75),
      ),
    [],
  );

  const selectWord = (wordIndex: number) => {
    const word = SAMPLE.words[wordIndex];
    const weakestIndex = word.phonemes.reduce(
      (weakest, phoneme, index) =>
        phoneme.score < word.phonemes[weakest].score ? index : weakest,
      0,
    );
    setSelectedWordIndex(wordIndex);
    setSelectedPhonemeIndex(weakestIndex);
  };

  const selectSound = (wordIndex: number, phonemeIndex: number) => {
    setSelectedWordIndex(wordIndex);
    setSelectedPhonemeIndex(phonemeIndex);
  };

  const coaching =
    metadata?.teachingTips?.[0] ??
    metadata?.articulation ??
    selectedWord.tip ??
    'Listen to the reference, isolate this sound, and retry the word slowly.';

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#0f1724] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111b2a] px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold text-slate-200">Practice feedback</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Static sample based on the production feedback format</p>
        </div>
        <SampleLabel compact />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-white sm:text-xl">{SAMPLE.text}</p>
            <p className="mt-1 text-xs text-slate-400">{SAMPLE.translation}</p>
          </div>
          <div className="shrink-0 border-l border-white/10 pl-4 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sentence</p>
            <p className="mt-0.5 text-3xl font-bold leading-none text-primary-300">
              {Math.round(SAMPLE.attempt.overallAccuracy)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">illustrative / 100</p>
          </div>
        </div>

        <div className="mt-5" aria-label="Select a word to inspect its pronunciation feedback">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Choose a word
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE.words.map((word, index) => {
              const band = scoreBand(word.score);
              const active = index === selectedWordIndex;
              return (
                <button
                  key={`${word.text}-${index}`}
                  type="button"
                  onClick={() => selectWord(index)}
                  onFocus={() => selectWord(index)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-[background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1724] motion-reduce:transition-none ${
                    active
                      ? `${band.border} ${band.background} ${band.text} -translate-y-0.5 motion-reduce:translate-y-0`
                      : 'border-white/10 bg-black/15 text-slate-300 hover:border-white/20 hover:bg-white/5'
                  }`}
                >
                  <span>{cleanWord(word.text)}</span>
                  <span className="ml-2 font-mono text-[10px] opacity-80">{word.score}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-xl border border-white/10 bg-black/15 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Selected word
                </p>
                <p className="mt-1 text-base font-semibold text-white">{cleanWord(selectedWord.text)}</p>
              </div>
              <div className={`rounded-lg border px-2.5 py-1.5 text-right ${wordBand.border} ${wordBand.background}`}>
                <p className={`text-lg font-bold leading-none ${wordBand.text}`}>{selectedWord.score}</p>
                <p className="mt-1 text-[9px] text-slate-400">{wordBand.label}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <ScoreMeter label="Word accuracy" value={selectedWord.score} />
              <ScoreMeter label={`Sound /${metadata?.ipa ?? selectedPhoneme.symbol}/`} value={selectedPhoneme.score} />
            </div>
          </div>

          <div className="rounded-xl border border-primary-300/25 bg-primary-300/[0.06] p-3.5" aria-live="polite">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">
                  Coaching context
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  /{metadata?.ipa ?? selectedPhoneme.symbol}/ · {metadata?.category ?? 'PT-BR sound'}
                </p>
              </div>
              <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${phonemeBand.border} ${phonemeBand.background} ${phonemeBand.text}`}>
                {phonemeBand.label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{coaching}</p>
            {metadata?.exampleWords?.[0] && (
              <p className="mt-3 border-t border-white/10 pt-3 text-xs text-slate-400">
                Repository example:{' '}
                <span className="font-medium text-slate-200">{metadata.exampleWords[0].pt}</span>{' '}
                <span className="font-mono">/{metadata.exampleWords[0].ipa}/</span>
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Select a problem sound
          </p>
          <div className="flex flex-wrap gap-2">
            {problemSounds.map(({ word, wordIndex, phoneme, phonemeIndex }) => {
              const meta = getPhonemeById(phoneme.symbol);
              const active = wordIndex === selectedWordIndex && phonemeIndex === selectedPhonemeIndex;
              const band = scoreBand(phoneme.score);
              return (
                <button
                  key={`${wordIndex}-${phonemeIndex}`}
                  type="button"
                  onClick={() => selectSound(wordIndex, phonemeIndex)}
                  aria-pressed={active}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1724] ${
                    active
                      ? `${band.border} ${band.background} ${band.text}`
                      : 'border-white/10 bg-black/15 text-slate-300 hover:border-white/20'
                  }`}
                  aria-label={`Inspect ${cleanWord(word.text)} sound ${meta?.ipa ?? phoneme.symbol}, illustrative score ${phoneme.score}`}
                >
                  <span className="font-mono">/{meta?.ipa ?? phoneme.symbol}/</span>
                  <span className="ml-2 text-[10px] opacity-70">{cleanWord(word.text)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Illustrative phoneme timeline
            </p>
            <p className="text-[10px] text-slate-500">Selected sound is outlined</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Illustrative phoneme score timeline">
            {SAMPLE.words.flatMap((word, wordIndex) =>
              word.phonemes.map((phoneme, phonemeIndex) => {
                const meta = getPhonemeById(phoneme.symbol);
                const active = wordIndex === selectedWordIndex && phonemeIndex === selectedPhonemeIndex;
                const band = scoreBand(phoneme.score);
                return (
                  <span
                    key={`${wordIndex}-${phonemeIndex}`}
                    className={`rounded-md border px-2 py-1 font-mono text-[10px] ${band.background} ${band.text} ${
                      active ? 'border-white ring-1 ring-white/40' : band.border
                    }`}
                    title={`${cleanWord(word.text)} /${meta?.ipa ?? phoneme.symbol}/ · illustrative ${phoneme.score}`}
                  >
                    {meta?.ipa ?? phoneme.symbol}
                  </span>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Waveform({ active = false }: { active?: boolean }) {
  const bars = [26, 46, 68, 42, 76, 54, 88, 62, 38, 70, 48, 82, 58, 34, 64, 44, 72, 50];
  return (
    <div className="flex h-14 items-center gap-1" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className={`w-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
            active ? 'bg-primary-300' : 'bg-slate-600'
          }`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function WalkthroughFrame({ activeStep }: { activeStep: number }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const metadata = getPhonemeById('NH');

  useEffect(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlaying(false);
  }, [activeStep]);

  const toggleAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-white/12 bg-[#0f1724] shadow-[0_22px_50px_rgba(0,0,0,0.24)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111b2a] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-300" />
          <span className="text-xs font-semibold text-slate-200">Sentence practice</span>
        </div>
        <span className="text-[10px] text-slate-500">State {activeStep + 1} of 4</span>
      </div>

      <div className="min-h-[25rem] p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-white">Minha mãe se chama Ana.</p>
            <p className="mt-1 text-sm text-slate-400">My mother’s name is Ana.</p>
          </div>
          <SampleLabel compact />
        </div>

        <div key={activeStep} className="tour-state-enter mt-6 motion-reduce:animate-none">
          {activeStep === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Synthesized PT-BR reference
              </p>
              <div className="mt-4 flex items-center gap-5">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1724]"
                  aria-label={playing ? 'Pause synthesized reference audio' : 'Play synthesized reference audio'}
                >
                  {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <Waveform active={playing} />
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                    <span>Francisca neural voice</span>
                    <span>pt-BR</span>
                  </div>
                </div>
              </div>
              <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-slate-300">
                Playback is user-triggered. Viewing the tour does not start audio or call Azure.
              </p>
            </div>
          )}

          {activeStep === 1 && (
            <div className="rounded-2xl border border-white/10 bg-black/15 p-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary-300/35 bg-primary-300/10 text-primary-200">
                <Mic size={25} />
              </div>
              <p className="mt-4 text-base font-semibold text-white">Seeded recording ready</p>
              <p className="mt-1 text-sm text-slate-400">Review the take before submitting it for assessment.</p>
              <div className="mx-auto mt-4 flex max-w-xs items-center justify-center rounded-xl border border-white/10 bg-[#0b111c] px-4">
                <Waveform active />
              </div>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <button type="button" className="min-h-11 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white">
                  Check pronunciation
                </button>
                <button type="button" className="min-h-11 rounded-lg border border-white/12 px-4 py-2 text-sm font-semibold text-slate-300">
                  Discard and re-record
                </button>
              </div>
              <p className="mt-4 text-xs text-amber-200">
                Tour state only — this control never requests microphone permission.
              </p>
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['Accuracy', 74],
                  ['Fluency', 76],
                  ['Completeness', 100],
                ].map(([label, value]) => {
                  const numeric = Number(value);
                  const band = scoreBand(numeric);
                  return (
                    <div key={String(label)} className="rounded-xl border border-white/10 bg-black/15 p-4">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
                      <p className={`mt-2 text-2xl font-bold ${band.text}`}>{numeric}</p>
                      <p className="mt-1 text-[10px] text-slate-500">illustrative / 100</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-300">Returned word accuracy</p>
                  <span className="text-[10px] text-slate-500">Current live granularity</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SAMPLE.words.map((word) => {
                    const band = scoreBand(word.score);
                    return (
                      <span key={word.text} className={`rounded-lg border px-3 py-2 text-xs ${band.border} ${band.background} ${band.text}`}>
                        {cleanWord(word.text)} <strong className="ml-1">{word.score}</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div className="grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
              <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.07] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Weak word</p>
                <p className="mt-2 text-2xl font-semibold text-white">minha</p>
                <p className="mt-1 text-sm text-amber-200">Illustrative word score: 82</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['M', 'IY', 'NH', 'AH'].map((symbol) => {
                    const meta = getPhonemeById(symbol);
                    return (
                      <span key={symbol} className={`rounded-md border px-2 py-1 font-mono text-xs ${symbol === 'NH' ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-white/10 text-slate-400'}`}>
                        /{meta?.ipa ?? symbol}/
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-primary-300/25 bg-primary-300/[0.06] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">Repository coaching metadata</p>
                <p className="mt-2 text-base font-semibold text-white">NH · /{metadata?.ipa}/</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{metadata?.teachingTips?.[0]}</p>
                <p className="mt-3 text-xs text-slate-400">
                  Example: <span className="text-slate-200">{metadata?.exampleWords?.[0]?.pt}</span>{' '}
                  <span className="font-mono">/{metadata?.exampleWords?.[0]?.ipa}/</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={getDemoNativeAudioUrl(SAMPLE.id)}
        preload="none"
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}

export function AssessmentTransformation() {
  const metadata = getPhonemeById('NH');
  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-stretch">
        <div className="rounded-2xl border border-white/10 bg-[#0f1724] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">1 · Provider-shaped input</p>
              <p className="mt-1 text-xs text-slate-500">Sanitized, illustrative word record</p>
            </div>
            <SampleLabel compact />
          </div>
          <pre className="mt-5 overflow-x-auto rounded-xl border border-white/10 bg-[#090e17] p-4 text-xs leading-6 text-slate-300" aria-label="Illustrative Azure word assessment excerpt">
{`{
  "Word": "minha",
  "AccuracyScore": 70,
  "ErrorType": "Mispronunciation"
}`}
          </pre>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            The current request is configured at <strong className="text-slate-200">word granularity</strong>.
          </p>
        </div>

        <div className="flex items-center justify-center text-slate-600" aria-hidden="true">
          <ArrowDown className="xl:hidden" size={20} />
          <ArrowRight className="hidden xl:block" size={20} />
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0f1724] p-5">
          <p className="text-xs font-semibold text-slate-200">2 · Normalize and join</p>
          <p className="mt-1 text-xs text-slate-500">Typed result + canonical word reference</p>
          <ol className="mt-5 space-y-3 text-sm text-slate-300">
            {[
              ['Normalize', 'Provider variants → AttemptScore'],
              ['Align', 'Azure word index → UI token'],
              ['Enrich', 'wordRef → [M, IY, NH, AH]'],
              ['Guard', 'No phoneme score is invented'],
            ].map(([title, body], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary-300/30 bg-primary-300/10 text-[10px] font-bold text-primary-200">
                  {index + 1}
                </span>
                <span>
                  <strong className="font-semibold text-slate-100">{title}</strong>
                  <span className="block text-xs text-slate-500">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-center text-slate-600" aria-hidden="true">
          <ArrowDown className="xl:hidden" size={20} />
          <ArrowRight className="hidden xl:block" size={20} />
        </div>

        <div className="rounded-2xl border border-primary-300/25 bg-primary-300/[0.06] p-5">
          <p className="text-xs font-semibold text-primary-200">3 · Learner-facing context</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary-300/30 bg-primary-300/10 font-mono text-lg font-bold text-primary-100">
              /{metadata?.ipa}/
            </span>
            <div>
              <p className="font-semibold text-white">NH in “minha”</p>
              <p className="text-xs text-slate-400">Canonical PT-BR metadata</p>
            </div>
          </div>
          <div className="mt-5 border-l-2 border-primary-300 pl-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">How to try it</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">{metadata?.teachingTips?.[0]}</p>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            The score identifies the weak word; repository metadata explains its sounds. Per-phoneme values shown elsewhere on this tour are illustrative only.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AudioNormalizationVisual() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
      <div className="rounded-2xl border border-white/10 bg-[#0f1724] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-slate-300">
            <Mic size={20} />
          </span>
          <div>
            <p className="font-semibold text-white">Browser output</p>
            <p className="text-xs text-slate-500">Container and codec vary by support</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {['Ogg · Opus preferred', 'WebM · Opus fallback', 'Browser default'].map((value) => (
            <span key={value} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
              {value}
            </span>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-400">
          MediaRecorder prioritizes an Opus format but does not assume every browser exposes the same MIME type.
        </p>
      </div>

      <div className="flex items-center justify-center" aria-hidden="true">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary-300/30 bg-primary-300/10 text-primary-200">
          <ArrowDown className="lg:hidden" size={20} />
          <ArrowRight className="hidden lg:block" size={20} />
        </div>
      </div>

      <div className="rounded-2xl border border-primary-300/25 bg-primary-300/[0.06] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary-300/25 bg-primary-300/10 text-primary-200">
            <FileAudio size={20} />
          </span>
          <div>
            <p className="font-semibold text-white">FFmpeg target</p>
            <p className="text-xs text-slate-500">Server-side normalization attempt</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ['16 kHz', 'sample rate'],
            ['1', 'mono channel'],
            ['s16', 'sample format'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-black/15 px-2 py-3">
              <dt className="text-base font-bold text-primary-200">{value}</dt>
              <dd className="mt-1 text-[10px] text-slate-500">{label}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100">
          <CircleAlert size={15} className="mt-0.5 shrink-0" />
          <p>Conversion has a timeout. On failure, the route records a fallback flag and sends the original upload instead.</p>
        </div>
      </div>
    </div>
  );
}

export function PipelineDiagram() {
  return (
    <div className="tour-pipeline" aria-label="Authenticated pronunciation assessment pipeline">
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {PIPELINE_STAGES.map((stage, index) => (
          <li key={stage.title} className="relative min-w-0 border-l border-white/10 pl-4 md:border-l-0 md:pl-0">
            <div className="h-full border-b border-white/10 bg-transparent py-5 transition-colors duration-200 hover:border-primary-300/30 focus-within:border-primary-300/30 motion-reduce:transition-none md:rounded-2xl md:border md:bg-[#0f1724] md:p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary-300/20 bg-primary-300/[0.07] text-primary-200">
                  <stage.icon size={17} aria-hidden="true" />
                </span>
                <span className="font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <p className="mt-4 text-sm font-semibold text-white">{stage.title}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-300">{stage.location}</p>
              <dl className="mt-4 space-y-2 text-xs leading-5 md:space-y-3">
                <div className="grid grid-cols-[5rem_1fr] gap-2 md:block">
                  <dt className="font-semibold text-slate-500">Input</dt>
                  <dd className="text-slate-300">{stage.input}</dd>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-2 md:block">
                  <dt className="font-semibold text-slate-500">Responsibility</dt>
                  <dd className="text-slate-300">{stage.responsibility}</dd>
                </div>
                <div className="grid grid-cols-[5rem_1fr] gap-2 md:block">
                  <dt className="font-semibold text-slate-500">Output</dt>
                  <dd className="text-slate-300">{stage.output}</dd>
                </div>
              </dl>
            </div>
            {index < PIPELINE_STAGES.length - 1 && (
              <span className="pointer-events-none absolute -bottom-2 left-1/2 z-10 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 bg-[#090e17] text-slate-600 md:hidden" aria-hidden="true">
                <ArrowDown size={11} />
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-5 overflow-hidden rounded-full bg-white/5" aria-hidden="true">
        <div className="tour-flow-line h-0.5 w-full origin-left bg-primary-300/70 motion-reduce:animate-none" />
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary-300" />
        The public tour renders this pipeline but does not execute it. Azure requests, microphone access, and authenticated API calls begin only inside the configured full product flow.
      </p>
    </div>
  );
}

export function CapabilityMark() {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary-300/30 bg-primary-300/10 text-primary-200">
      <Check size={13} aria-hidden="true" />
    </span>
  );
}

export function DemoAccessSummary() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="border-l-2 border-primary-300 pl-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Volume2 size={16} className="text-primary-200" />
          Public sample mode
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Static sample states and bundled audio. No account, microphone, backend, database, or Azure key is required.
        </p>
      </div>
      <div className="border-l-2 border-slate-600 pl-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Mic size={16} className="text-slate-300" />
          Live recording path
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Requires sign-in, microphone permission, a running Express backend, MongoDB connectivity, and configured Azure Speech credentials.
        </p>
      </div>
    </div>
  );
}
