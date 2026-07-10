import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, Mic, Info, ArrowRight, Headphones } from 'lucide-react';
import PublicPageShell from '@/components/demo/PublicPageShell';
import PronunciationFeedbackPanel from '@/components/pronunciation/PronunciationFeedbackPanel';
import ScoringPanel from '@/components/pronunciation/ScoringPanel';
import PhraseTrendSparkline from '@/components/pronunciation/PhraseTrendSparkline';
import {
  FocusAreasCard,
  type NormalizedAudioVariant,
  type NormalizedWordFeedback,
} from '@/components/pronunciation/shared';
import { stopAllAudio } from '@/hooks/useAudioPlayer';
import { useDemoAudioAvailability } from '@/lib/demo/demoAudioAvailability';
import {
  DEMO_ITEMS,
  getDemoNativeAudioUrl,
  type DemoExample,
  type DemoExampleKind,
  type DemoItem,
  type DemoWordFeedback,
} from '@/lib/demo/demoData';

const EXAMPLE_ICONS: Record<DemoExampleKind, typeof Volume2> = {
  native: Volume2,
  bad: Mic,
  best: Headphones,
};

function DemoBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800"
      title="These results are hand-authored sample data, not live Azure Speech output."
    >
      <Info size={13} />
      Sample data
    </span>
  );
}

/** Score chip shown inside each example selector button. */
function scoreChipClasses(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
}

/**
 * Adapt the demo's hand-authored word feedback to the normalized shape the
 * real practice components consume. The word-level tip is attached to the
 * word's lowest-scoring phoneme so it surfaces in Sound Details/Focus Areas.
 */
function toNormalizedWords(words: DemoWordFeedback[]): NormalizedWordFeedback[] {
  return words.map((w, index) => {
    const lowestIdx = w.phonemes.reduce(
      (low, p, i) => (p.score < w.phonemes[low].score ? i : low),
      0,
    );
    return {
      id: String(index),
      index,
      text: w.text,
      accuracyScore: w.score,
      score: w.score,
      errorType: w.errorType ?? null,
      phonemes: w.phonemes.map((p, i) => ({
        symbol: p.symbol,
        score: p.score,
        isProblem: p.score < 75,
        tip: i === lowestIdx ? w.tip : undefined,
      })),
    };
  });
}

/** The demo counterpart of the practice page's main sentence card. */
function DemoPracticeCard({ item, example }: { item: DemoItem; example: DemoExample }) {
  // Learner recordings are uploaded separately (public/demo-audio/attempts/)
  // and may not exist yet — probe before offering playback. Bundled native
  // audio skips the probe.
  const exampleAudioAvailable = useDemoAudioAvailability(example.audioUrl, example.audioBundled);

  const normalizedWords = useMemo(() => toNormalizedWords(example.words), [example.words]);

  // Native reference is always offered; the selected learner example's
  // recording rides in the "user" audio slot, exactly like a fresh recording
  // does on the real practice page.
  const sentenceAudio = useMemo<NormalizedAudioVariant[]>(() => {
    const variants: NormalizedAudioVariant[] = [
      { type: 'native', url: getDemoNativeAudioUrl(item.id) },
    ];
    if (example.kind !== 'native' && exampleAudioAvailable) {
      variants.push({ type: 'user', url: example.audioUrl });
    }
    return variants;
  }, [item.id, example.kind, example.audioUrl, exampleAudioAvailable]);

  return (
    <div className="space-y-6">
      {example.kind !== 'native' && exampleAudioAvailable === false && (
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          The recording for this sample attempt hasn&apos;t been uploaded yet — the scores below
          still show how the app would assess it.
        </p>
      )}

      {/* Score strip — same component the practice page shows after scoring.
          The sparkline rides in the hero column so progress sits alongside the
          accuracy/fluency/completeness metrics instead of a separate card. */}
      <ScoringPanel
        currentAttempt={example.attempt}
        variant="strip"
        heroExtra={
          <div className="border-t border-gray-200/70 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Progress
              </span>
              <DemoBadge />
            </div>
            <PhraseTrendSparkline scores={item.history} />
          </div>
        }
      />

      {/* Full sentence, translation toggle, audio controls, and Sound Details.
          Keyed by example so word selection and scores reset when switching. */}
      <PronunciationFeedbackPanel
        key={`${item.id}:${example.kind}`}
        attempts={[example.attempt]}
        currentAttempt={example.attempt}
        sentenceText={item.text}
        translationText={item.translation}
        difficulty={item.difficulty}
        sentenceAudio={sentenceAudio}
        userAudioLabel={example.kind === 'bad' ? 'Bad Attempt' : 'Best Attempt'}
        words={normalizedWords}
        showDifficultyBadge={false}
      />

      {/* Focus Areas — problem phonemes across the sentence (empty for native) */}
      <FocusAreasCard words={normalizedWords} />

      {/* Coaching — tailored to the selected example */}
      <div className="rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Coaching — what to work on next
        </h3>
        <ul className="space-y-2">
          {example.coaching.map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <ArrowRight size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [activeId, setActiveId] = useState<string>(DEMO_ITEMS[0].id);
  const [exampleKind, setExampleKind] = useState<DemoExampleKind>('native');

  const item = useMemo<DemoItem>(
    () => DEMO_ITEMS.find((d) => d.id === activeId) ?? DEMO_ITEMS[0],
    [activeId],
  );
  const example = useMemo<DemoExample>(
    () => item.examples.find((e) => e.kind === exampleKind) ?? item.examples[0],
    [item, exampleKind],
  );

  const selectSentence = (id: string) => {
    stopAllAudio();
    setActiveId(id);
    setExampleKind('native');
  };

  const selectExample = (kind: DemoExampleKind) => {
    stopAllAudio();
    setExampleKind(kind);
  };

  return (
    <PublicPageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Intro / disclaimer */}
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Interactive demo — the real practice page, minus the microphone</p>
              <p className="mt-1">
                This is the same sentence-practice experience the full app gives you, with{' '}
                <strong>real sentences</strong> and the same native reference audio. Instead of
                recording yourself, compare three audio examples — the{' '}
                <strong>native speaker</strong>, an intentionally <strong>bad attempt</strong>, and
                a <strong>best-effort attempt</strong> — and see how each one scores. The scores and
                phoneme feedback are realistic <strong>samples</strong>, not live Azure Speech
                results. No microphone, account, or API keys are used.
              </p>
            </div>
          </div>
        </div>

        {/* Sentence picker */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Pick a sentence
          </h2>
          <div className="flex flex-wrap gap-2">
            {DEMO_ITEMS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => selectSentence(d.id)}
                className={`chip ${d.id === activeId ? 'chip-active' : 'chip-inactive'}`}
                aria-pressed={d.id === activeId}
              >
                {d.text}
              </button>
            ))}
          </div>
        </div>

        {/* Main practice card — mirrors the real sentence practice page */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-secondary">Difficulty {item.difficulty}</span>
              {item.cefr && <span className="badge badge-secondary">{item.cefr}</span>}
              {item.focusSounds.map((s) => (
                <span key={s} className="chip-soft">{s}</span>
              ))}
            </div>
            <DemoBadge />
          </div>

          {/* Audio example selector — the demo's stand-in for the record button */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Audio examples — pick one to hear it and see how it scores
            </h3>
            <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Audio examples">
              {item.examples.map((ex) => {
                const Icon = EXAMPLE_ICONS[ex.kind];
                const isActive = ex.kind === example.kind;
                const overall = Math.round(ex.attempt.overallAccuracy);
                return (
                  <button
                    key={ex.kind}
                    type="button"
                    onClick={() => selectExample(ex.kind)}
                    aria-pressed={isActive}
                    className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={16} />
                      {ex.label}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${scoreChipClasses(overall)}`}
                      title={`Sample overall score: ${overall}/100`}
                    >
                      {overall}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{example.description}</p>
          </div>

          <DemoPracticeCard item={item} example={example} />
        </div>

        {/* Footer CTA */}
        <div className="text-center pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Want the full picture of how it works?{' '}
            <Link to="/tour" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
              Take the tour
            </Link>
            .
          </p>
        </div>
      </div>
    </PublicPageShell>
  );
}
