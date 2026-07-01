import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Volume2, Mic, Loader2, RotateCcw, Info, ArrowRight, Pause, Headphones } from 'lucide-react';
import PublicPageShell from '@/components/demo/PublicPageShell';
import PhraseScoreOverview from '@/components/pronunciation/PhraseScoreOverview';
import PhraseTrendSparkline from '@/components/pronunciation/PhraseTrendSparkline';
import PhonemeChip from '@/components/pronunciation/PhonemeChip';
import { useAudioPlayer, stopAllAudio } from '@/hooks/useAudioPlayer';
import { getScoreColor, getScoreBorderColor } from '@/lib/pronunciationDisplay';
import {
  DEMO_ITEMS,
  getDemoNativeAudioUrl,
  type DemoItem,
  type DemoWordFeedback,
} from '@/lib/demo/demoData';

type DemoPhase = 'idle' | 'analyzing' | 'result';

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

export default function DemoPage() {
  const [activeId, setActiveId] = useState<string>(DEMO_ITEMS[0].id);
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [selectedWord, setSelectedWord] = useState<DemoWordFeedback | null>(null);
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const item = useMemo<DemoItem>(
    () => DEMO_ITEMS.find((d) => d.id === activeId) ?? DEMO_ITEMS[0],
    [activeId],
  );

  // Native reference audio — the same WAV the full app plays.
  const nativeAudioUrl = useMemo(() => getDemoNativeAudioUrl(item.id), [item.id]);
  const native = useAudioPlayer(nativeAudioUrl);
  // Optional sample learner recording (present only when one has been added).
  const learner = useAudioPlayer(item.learnerAudioUrl);

  const resetTo = (id: string) => {
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    stopAllAudio();
    setActiveId(id);
    setPhase('idle');
    setSelectedWord(null);
  };

  const toggleNative = () => {
    if (native.isPlaying) native.pause();
    else native.play();
  };

  const runAnalysis = () => {
    setPhase('analyzing');
    setSelectedWord(null);
    if (analyzeTimer.current) clearTimeout(analyzeTimer.current);
    // Brief simulated latency so the "assessment" feels real.
    analyzeTimer.current = setTimeout(() => {
      setPhase('result');
      setSelectedWord(item.words[0] ?? null);
    }, 1100);
  };

  return (
    <PublicPageShell>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Intro / disclaimer */}
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold">Interactive demo — real sentences, sample scores</p>
              <p className="mt-1">
                These are <strong>real sentences</strong> from the app, with the same native
                reference audio you hear in the full experience — press{' '}
                <strong>Listen</strong> to play it. The scores, phoneme feedback, and history below
                are realistic <strong>samples</strong>, not live Azure Speech results. No microphone,
                account, or API keys are used. In the full app, you record your own voice and Azure
                Speech scores it in real time.
              </p>
            </div>
          </div>
        </div>

        {/* Word / phrase picker */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Pick a sentence
          </h2>
          <div className="flex flex-wrap gap-2">
            {DEMO_ITEMS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => resetTo(d.id)}
                className={`chip ${d.id === activeId ? 'chip-active' : 'chip-inactive'}`}
                aria-pressed={d.id === activeId}
              >
                {d.text}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="badge badge-secondary">Difficulty {item.difficulty}</span>
            {item.cefr && <span className="badge badge-secondary">{item.cefr}</span>}
            {item.focusSounds.map((s) => (
              <span key={s} className="chip-soft">{s}</span>
            ))}
          </div>
          <div className="text-center">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {item.text}
            </p>
            <p className="mt-2 font-mono text-primary-600 dark:text-primary-400">/{item.ipa}/</p>
            <p className="mt-1 text-gray-500 dark:text-gray-400 italic">{item.translation}</p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              className="btn btn-secondary btn-md inline-flex items-center gap-2"
              title="Play the native reference pronunciation for this sentence."
              onClick={toggleNative}
              aria-pressed={native.isPlaying}
            >
              {native.isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : native.isPlaying ? (
                <Pause size={18} />
              ) : (
                <Volume2 size={18} />
              )}
              {native.isPlaying ? 'Playing…' : 'Listen (native voice)'}
            </button>

            {phase === 'idle' && (
              <button
                type="button"
                onClick={runAnalysis}
                className="btn btn-primary btn-md inline-flex items-center gap-2"
              >
                <Mic size={18} />
                Analyze demo recording
              </button>
            )}
            {phase === 'analyzing' && (
              <button
                type="button"
                disabled
                className="btn btn-primary btn-md inline-flex items-center gap-2"
              >
                <Loader2 size={18} className="animate-spin" />
                Analyzing…
              </button>
            )}
            {phase === 'result' && (
              <button
                type="button"
                onClick={runAnalysis}
                className="btn btn-secondary btn-md inline-flex items-center gap-2"
              >
                <RotateCcw size={18} />
                Try again
              </button>
            )}
          </div>

          {native.error && (
            <p className="mt-3 text-center text-xs text-rose-500 dark:text-rose-400">
              Couldn&apos;t play the reference audio. Please try again.
            </p>
          )}

          {phase === 'idle' && (
            <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Press <strong>Listen</strong> to hear the native voice, then{' '}
              <strong>Analyze demo recording</strong> to see how a scored attempt looks.
            </p>
          )}
        </div>

        {/* Result state */}
        {phase === 'result' && (
          <div className="space-y-6 animate-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your sample result</h2>
              <DemoBadge />
            </div>

            {/* Compare recordings — only shown when a sample learner recording exists */}
            {item.learnerAudioUrl && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Hear it back — native vs. this sample attempt
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={toggleNative}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-2"
                  >
                    {native.isPlaying ? <Pause size={16} /> : <Volume2 size={16} />}
                    Native voice
                  </button>
                  <button
                    type="button"
                    onClick={() => (learner.isPlaying ? learner.pause() : learner.play())}
                    className="btn btn-secondary btn-sm inline-flex items-center gap-2"
                  >
                    {learner.isPlaying ? <Pause size={16} /> : <Headphones size={16} />}
                    Sample attempt
                  </button>
                </div>
              </div>
            )}

            {/* Score overview (reuses the real app component) */}
            <PhraseScoreOverview attemptScore={item.attempt} />

            {/* Word-by-word strip */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Word-by-word — tap a word to see its sounds
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.words.map((w, i) => {
                  const isSelected = selectedWord?.text === w.text && selectedWord === w;
                  return (
                    <button
                      key={`${w.text}-${i}`}
                      type="button"
                      onClick={() => setSelectedWord(w)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-base font-medium border-2 transition-all ${getScoreColor(
                        w.score,
                      )} ${getScoreBorderColor(w.score)} ${
                        isSelected ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-gray-800' : ''
                      }`}
                    >
                      {w.text}
                      <span className="text-xs opacity-75">{w.score}</span>
                    </button>
                  );
                })}
              </div>

              {/* Phoneme breakdown for the selected word */}
              {selectedWord && (
                <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Sounds in “{selectedWord.text}”
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedWord.phonemes.map((p, i) => (
                      <PhonemeChip key={`${p.symbol}-${i}`} symbol={p.symbol} score={p.score} />
                    ))}
                  </div>
                  {selectedWord.tip && (
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      💡 {selectedWord.tip}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Coaching */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Coaching — what to work on next
              </h3>
              <ul className="space-y-2">
                {item.coaching.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <ArrowRight size={16} className="text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Progress over time */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Progress on “{item.text}”
                </h3>
                <DemoBadge />
              </div>
              <PhraseTrendSparkline scores={item.history} />
              <div className="mt-4 space-y-1.5">
                {item.history.map((score, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"
                  >
                    <span>Attempt {i + 1}</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{score}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                +{item.history[item.history.length - 1] - item.history[0]} points across{' '}
                {item.history.length} attempts.
              </p>
            </div>
          </div>
        )}

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
