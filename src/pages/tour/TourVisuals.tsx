import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Info,
  Mic,
  Pause,
  Play,
  ShieldCheck,
  Volume2,
} from 'lucide-react';
import InteractiveSentenceDisplay from '@/components/practice/InteractiveSentenceDisplay';
import {
  PhonemePanel,
  type NormalizedWordFeedback,
} from '@/components/pronunciation/shared';
import { getDemoItem, getDemoNativeAudioUrl } from '@/lib/demo/demoData';
import { buildPronunciationGuide } from '@/lib/pronunciationGuide';
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

function cleanWord(value: string): string {
  return value.replace(/[.,!?]/g, '');
}

const MINHA_WORD = SAMPLE.words.find((word) => cleanWord(word.text) === 'minha') ?? SAMPLE.words[0];
const MINHA_GUIDE = buildPronunciationGuide({
  word: cleanWord(MINHA_WORD.text),
  phonemes: MINHA_WORD.phonemes.map((sound) => sound.symbol),
  pronunciationNote: MINHA_WORD.tip,
  respelling: MINHA_WORD.respelling,
});

const HERO_WORDS: NormalizedWordFeedback[] = SAMPLE.words.map((word, index) => ({
  id: `tour-word-${index}`,
  index,
  text: cleanWord(word.text),
  accuracyScore: word.score,
  score: word.score,
  errorType: word.errorType ?? null,
  guidePhonemes: word.phonemes.map((phoneme) => phoneme.symbol),
  pronunciationNote: word.tip,
  respelling: word.respelling,
  level:
    word.score >= 90
      ? 'excellent'
      : word.score >= 80
        ? 'good'
        : word.score >= 70
          ? 'ok'
          : 'practice',
  phonemes: word.phonemes.map((phoneme) => ({
    symbol: phoneme.symbol,
    score: phoneme.score,
    isProblem: phoneme.score < 75,
    tip: phoneme.score < 75 ? word.tip : undefined,
  })),
}));

const DEFAULT_HERO_WORD = HERO_WORDS.reduce((weakest, word) =>
  word.accuracyScore < weakest.accuracyScore ? word : weakest,
);

const HERO_WORD_SCORES = HERO_WORDS.map((word) => ({
  word: word.text,
  overallScore: word.accuracyScore,
  normalizedWord: word,
}));

/** Deterministic tour sample rendered with the app's production coaching components. */
export function InteractiveAttemptFrame() {
  const [selectedWord, setSelectedWord] = useState<NormalizedWordFeedback>(DEFAULT_HERO_WORD);

  return (
    <div className="overflow-hidden rounded-[1.4rem] border border-white/12 bg-[#0f1724] shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111b2a] px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold text-slate-200">Coaching for “{selectedWord.text}”</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Rendered with the same feedback components used in practice</p>
        </div>
        <SampleLabel compact />
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                Scored sentence
              </p>
              <p className="mt-1 text-xs text-gray-600">Choose a word to open its pronunciation guide.</p>
            </div>
            <p className="text-[10px] text-gray-500">Illustrative word scores</p>
          </div>
          <InteractiveSentenceDisplay
            sentenceText={SAMPLE.text}
            wordScores={HERO_WORD_SCORES}
            onWordClick={(wordData) => {
              if (wordData.normalizedWord) setSelectedWord(wordData.normalizedWord);
            }}
          />
        </div>

        <div className="dark" aria-live="polite">
          <PhonemePanel word={selectedWord} trustLevel="trusted" />
        </div>
      </div>
    </div>
  );
}

function Waveform({ active = false }: { active?: boolean }) {
  const bars = [
    26, 46, 68, 42, 76, 54, 88, 62, 38, 70, 48, 82, 58, 34, 64, 44, 72, 50,
    40, 66, 84, 52, 74, 36, 60, 90, 56, 78, 46, 68, 32, 72, 54, 86, 44, 64,
    30, 58, 76, 48, 88, 62, 42, 70, 52, 80, 38, 66, 46, 74, 56, 84, 50, 34,
  ];
  return (
    <div className="flex h-14 w-full items-center justify-center gap-[3px]" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className={`min-w-0 flex-1 max-w-1.5 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
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
    <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0f1724] shadow-[0_18px_42px_rgba(0,0,0,0.22)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111b2a] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary-300" />
          <span className="text-xs font-semibold text-slate-200">Sentence practice</span>
        </div>
        <span className="text-[10px] text-slate-500">State {activeStep + 1} of 4</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">Minha mãe se chama Ana.</p>
            <p className="mt-1 text-xs text-slate-400">My mother’s name is Ana.</p>
          </div>
          <SampleLabel compact />
        </div>

        <div key={activeStep} className="tour-state-enter mt-4 motion-reduce:animate-none">
          {activeStep === 0 && (
            <div className="rounded-xl border border-white/10 bg-black/15 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Synthesized PT-BR reference
              </p>
              <div className="mt-3 flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white transition-colors hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1724]"
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
              <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-300">
                Compare your attempt with an Azure neural PT-BR reference before you record.
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
                Preview state — microphone access begins only in authenticated practice.
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
                  <p className="text-xs font-semibold text-slate-300">Azure word-level feedback</p>
                  <span className="text-[10px] text-slate-500">Live assessment scope</span>
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
                <div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Say it like</p>
                  <p className="mt-1 text-xl font-bold tracking-wide text-white">{MINHA_GUIDE.respelling}</p>
                </div>
              </div>
              <div className="rounded-xl border border-primary-300/25 bg-primary-300/[0.06] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">PT-BR coaching guidance</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MINHA_GUIDE.references.map((reference) => (
                    <span key={`${reference.sound}-${reference.word}`} className="rounded-lg border border-white/10 bg-black/15 px-2.5 py-1.5 text-xs text-slate-300">
                      <strong className="text-white">{reference.sound}</strong> like <strong className="text-white">{reference.word}</strong>
                    </span>
                  ))}
                </div>
                {MINHA_GUIDE.spellingRules[0] && (
                  <div className="mt-4 border-l-2 border-primary-300 pl-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">The spelling rule</p>
                    <p className="mt-1 text-sm text-slate-200">
                      <strong>{MINHA_GUIDE.spellingRules[0].spelling}</strong> = {MINHA_GUIDE.spellingRules[0].sound}
                    </p>
                  </div>
                )}
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
  return (
    <div>
      <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr_auto_1fr] xl:items-stretch">
        <div className="rounded-2xl border border-white/10 bg-[#0f1724] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">1 · Azure assessment result</p>
              <p className="mt-1 text-xs text-slate-500">Sanitized illustrative excerpt</p>
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
          <p className="text-xs font-semibold text-slate-200">2 · LusoPronounce teaching layer</p>
          <p className="mt-1 text-xs text-slate-500">Make the provider result usable</p>
          <ol className="mt-5 space-y-3 text-sm text-slate-300">
            {[
              ['Normalize', 'Create a stable score model'],
              ['Align', 'Match the result to the learner’s words'],
              ['Enrich', 'Connect “minha” to its PT-BR sounds'],
              ['Protect trust', 'Never invent a missing sound score'],
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
          <p className="text-xs font-semibold text-primary-200">3 · Actionable learner feedback</p>
          <div className="mt-5 flex items-center gap-3">
            <span className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-primary-300/30 bg-primary-300/10 px-3 text-lg font-bold text-primary-100">
              {MINHA_GUIDE.respelling}
            </span>
            <div>
              <p className="font-semibold text-white">Say “minha” like {MINHA_GUIDE.respelling}</p>
              <p className="text-xs text-slate-400">English-friendly respelling and reference words</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {MINHA_GUIDE.references.map((reference) => (
              <span key={`${reference.sound}-${reference.word}`} className="rounded-lg border border-white/10 bg-black/15 px-2.5 py-1.5 text-xs text-slate-300">
                <strong className="text-white">{reference.sound}</strong> like <strong className="text-white">{reference.word}</strong>
              </span>
            ))}
          </div>
          {MINHA_GUIDE.spellingRules[0] && (
            <div className="mt-5 border-l-2 border-primary-300 pl-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">The spelling rule</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                <strong>{MINHA_GUIDE.spellingRules[0].spelling}</strong> = {MINHA_GUIDE.spellingRules[0].sound}
              </p>
            </div>
          )}
          <p className="mt-4 text-xs leading-5 text-slate-400">
            Azure identifies the weak word; LusoPronounce explains the sound worth practicing. Per-sound values in this tour remain illustrative.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PipelineDiagram() {
  return (
    <div className="tour-pipeline" aria-label="Authenticated pronunciation assessment pipeline">
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
                  <dt className="font-semibold text-slate-500">What it does</dt>
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
        The public demo previews the experience without executing this pipeline. Live recording and Azure assessment begin only in authenticated practice.
      </p>
    </div>
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
          A guided product sample with bundled audio and illustrative feedback. No account or microphone access is required.
        </p>
      </div>
      <div className="border-l-2 border-slate-600 pl-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Mic size={16} className="text-slate-300" />
          Live recording path
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Sign in and grant microphone access to use the configured Express, Azure Speech, and saved-history flow.
        </p>
      </div>
    </div>
  );
}
