/**
 * Tour visual primitives — always-dark presentational pieces for the
 * recruiter-facing Tour page. Data comes from the real hand-authored demo
 * set (`@/lib/demo/demoData`) and the phoneme metadata dataset, and every
 * sample surface is labelled "Sample data".
 */
import { Info, ArrowRight } from 'lucide-react';
import { getPhonemeById } from '@/lib/phonemeMetadata';
import { getDemoItem, type DemoItem, type DemoWordFeedback } from '@/lib/demo/demoData';

/** The showcase sentence: "Minha mãe se chama Ana." — real demo item. */
export const SHOWCASE: DemoItem =
  getDemoItem('gemini_family_friends_001') ?? getDemoItem('gemini_small_talk_001')!;

/** Score → dark-theme colour tokens. Bands mirror the app's score palette. */
export function band(score: number): {
  text: string;
  chip: string;
  bar: string;
  dot: string;
  label: string;
} {
  if (score >= 88)
    return {
      text: 'text-emerald-300',
      chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25',
      bar: 'bg-emerald-400',
      dot: 'bg-emerald-400',
      label: 'Great',
    };
  if (score >= 75)
    return {
      text: 'text-primary-300',
      chip: 'bg-primary-500/15 text-primary-200 ring-1 ring-inset ring-primary-400/25',
      bar: 'bg-primary-400',
      dot: 'bg-primary-400',
      label: 'Good',
    };
  if (score >= 60)
    return {
      text: 'text-amber-300',
      chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/25',
      bar: 'bg-amber-400',
      dot: 'bg-amber-400',
      label: 'Needs work',
    };
  return {
    text: 'text-rose-300',
    chip: 'bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-400/25',
    bar: 'bg-rose-400',
    dot: 'bg-rose-400',
    label: 'Missed',
  };
}

/** Small "Sample data" pill reused wherever illustrative scores appear. */
export function SampleTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/25">
      <Info size={11} />
      Sample data
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const t = band(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/**
 * The hero "scored attempt" card — mirrors the real assessment view using the
 * showcase sample data. Word chips, problem sounds, score breakdown, and a
 * phoneme timeline, all clearly marked as sample data.
 */
export function ScoredAttemptCard() {
  const item = SHOWCASE;
  const attempt = item.attempt;
  const overall = Math.round(attempt.overallAccuracy);
  const o = band(overall);

  // Two lowest-scoring phonemes across the sentence, with their word context.
  const problems = item.words
    .flatMap((w) => w.phonemes.map((p) => ({ word: w.text.replace(/[.,?]/g, ''), ...p })))
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const timeline = item.words.flatMap((w) => w.phonemes);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">Scored attempt</span>
        <SampleTag />
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-100">{item.text}</p>
          <p className="mt-0.5 text-xs text-slate-400">{item.translation}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Overall</div>
          <div className={`text-2xl font-bold leading-none ${o.text}`}>{overall}</div>
          <div className="text-[10px] text-slate-500">/ 100</div>
        </div>
      </div>

      {/* Word chips */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {item.words.map((w, i) => {
          const t = band(w.score);
          return (
            <span
              key={`${w.text}-${i}`}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${t.chip}`}
            >
              {w.text.replace(/[.,?]/g, '')}
              <span className="text-[10px] opacity-80">{w.score}</span>
            </span>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {/* Problem sounds */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Problem sounds
          </p>
          <ul className="space-y-2">
            {problems.map((p, i) => {
              const meta = getPhonemeById(p.symbol);
              const t = band(p.score);
              return (
                <li key={i} className="flex items-center gap-2">
                  <span className={`h-6 w-6 shrink-0 rounded-md text-center text-xs font-semibold leading-6 ${t.chip}`}>
                    {meta?.ipa ?? '•'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-200">
                      <span className="font-medium">{p.word}</span>{' '}
                      <span className="text-slate-500">/{meta?.ipa}/</span>
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      {meta?.englishApprox ?? 'PT-BR sound'}
                    </p>
                  </div>
                  <span className={`ml-auto text-xs font-semibold ${t.text}`}>{p.score}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Score breakdown */}
        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Score breakdown
          </p>
          <div className="space-y-2.5">
            <ScoreBar label="Accuracy" value={Math.round(attempt.overallAccuracy)} />
            {attempt.fluency != null && <ScoreBar label="Fluency" value={Math.round(attempt.fluency)} />}
            {attempt.completeness != null && (
              <ScoreBar label="Completeness" value={Math.round(attempt.completeness)} />
            )}
          </div>
        </div>
      </div>

      {/* Phoneme timeline */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Phoneme timeline
        </p>
        <div className="flex flex-wrap gap-1">
          {timeline.map((p, i) => {
            const meta = getPhonemeById(p.symbol);
            const t = band(p.score);
            return (
              <span
                key={i}
                title={`${meta?.ipa ?? p.symbol} · ${p.score}`}
                className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${t.chip}`}
              >
                {meta?.ipa ?? p.symbol.toLowerCase()}
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
          {['Great', 'Good', 'Needs work', 'Missed'].map((lbl) => {
            const ref = lbl === 'Great' ? 92 : lbl === 'Good' ? 80 : lbl === 'Needs work' ? 66 : 50;
            return (
              <span key={lbl} className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${band(ref).dot}`} />
                {lbl}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The "key differentiator" — raw Azure-style phoneme output on the left,
 * LusoPronounce's learner-friendly coaching on the right. Uses the real
 * "mãe" word from the showcase item.
 */
export function RawVsCoached() {
  const item = SHOWCASE;
  const word: DemoWordFeedback =
    item.words.find((w) => w.text.replace(/[.,?]/g, '') === 'mãe') ?? item.words[0];
  const wordText = word.text.replace(/[.,?]/g, '');
  const meta = getPhonemeById(word.phonemes[0].symbol);

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
      {/* Raw */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-200">Raw assessment output</p>
            <p className="text-xs text-slate-500">Azure phoneme detail — hard to act on</p>
          </div>
          <SampleTag />
        </div>
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[19rem] text-left text-xs">
            <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Phoneme</th>
                <th className="px-3 py-2 font-medium">IPA</th>
                <th className="px-3 py-2 font-medium">Accuracy</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="font-mono text-slate-300">
              {word.phonemes.map((p, i) => {
                const pm = getPhonemeById(p.symbol);
                const t = band(p.score);
                const err = p.score < 60 ? 'Mispron.' : p.score < 75 ? 'Weak' : 'Good';
                return (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-1.5 text-slate-400">{p.symbol}</td>
                    <td className="px-3 py-1.5">/{pm?.ipa}/</td>
                    <td className={`px-3 py-1.5 font-semibold ${t.text}`}>{(p.score / 100).toFixed(2)}</td>
                    <td className={`px-3 py-1.5 ${t.text}`}>{err}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[10px] text-slate-600">
          {'{ "NBest":[{ "PronScore": '}
          {Math.round(word.score)}
          {", … }] }"}
        </p>
      </div>

      {/* Arrow */}
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-400/30 bg-primary-500/10 text-primary-300 lg:h-11 lg:w-11">
        <ArrowRight size={18} className="hidden lg:block" />
        <ArrowRight size={16} className="rotate-90 lg:hidden" />
      </div>

      {/* Coached */}
      <div className="rounded-2xl border border-primary-400/25 bg-primary-500/[0.06] p-4 shadow-lg shadow-primary-900/20 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <p className="text-sm font-semibold text-primary-200">LusoPronounce coaching</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-100">{wordText}</span>
          <span className="text-sm text-slate-400">/{meta?.ipa}/</span>
          <span className={`ml-auto rounded-md px-2 py-0.5 text-xs font-semibold ${band(word.score).chip}`}>
            Needs improvement ({word.score}/100)
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          The nasal sounds in <span className="font-medium text-slate-100">“{wordText}”</span> drift toward
          an English vowel, which changes the word.
        </p>
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-300">How to fix</p>
          <p className="mt-1 text-sm text-slate-300">{word.tip ?? item.coaching[0]}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {word.phonemes.map((p, i) => {
            const pm = getPhonemeById(p.symbol);
            const t = band(p.score);
            return (
              <span key={i} className={`rounded-md px-2 py-1 text-xs font-medium ${t.chip}`}>
                {pm?.ipa ?? p.symbol}
                <span className="ml-1 text-[10px] opacity-80">{p.score}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Small SVG line of the showcase item's sample score history. */
export function SampleProgress() {
  const item = SHOWCASE;
  const scores = item.history;
  const w = 240;
  const h = 72;
  const pad = 8;
  const min = Math.min(...scores) - 4;
  const max = Math.max(...scores) + 4;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (s - min) / (max - min)) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">Sample score progression</span>
        <SampleTag />
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="Sample score progression trending upward">
        <polygon points={area} fill="url(#tourGrad)" opacity="0.25" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary-400" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" className="fill-primary-300" />
        ))}
        <defs>
          <linearGradient id="tourGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#70cb8f" />
            <stop offset="100%" stopColor="#70cb8f" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <p className="mt-1 text-right text-lg font-bold text-primary-300">
        {item.history[item.history.length - 1]}
        <span className="ml-1 text-xs font-normal text-slate-500">latest / 100</span>
      </p>
    </div>
  );
}
