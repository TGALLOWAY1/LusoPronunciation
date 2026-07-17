/**
 * Tour visual primitives for the recruiter-facing Tour page.
 *
 * These deliberately embed *real* screenshots of the running app (captured into
 * `public/tour/` by the screenshot e2e suite) rather than hand-built mockups, so
 * what a visitor sees on the Tour matches the actual product screen. Illustrative
 * surfaces are labelled "Sample data".
 */
import { Info, ArrowRight } from 'lucide-react';
import { getDemoItem, type DemoItem } from '@/lib/demo/demoData';

/** The showcase sentence used for the sample progression chart. */
export const SHOWCASE: DemoItem =
  getDemoItem('gemini_family_friends_001') ?? getDemoItem('gemini_small_talk_001')!;

/** Small "Sample data" pill reused wherever illustrative scores appear. */
export function SampleTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/25">
      <Info size={11} />
      Sample data
    </span>
  );
}

/**
 * A light "browser window" frame around a real app screenshot so the light-themed
 * product UI reads cleanly on the dark Tour background.
 */
function AppFrame({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption?: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/50">
      <div className="flex items-center gap-1.5 border-b border-black/5 bg-slate-100 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        {caption && (
          <span className="ml-2 truncate text-[11px] font-medium text-slate-500">{caption}</span>
        )}
      </div>
      <div className="space-y-3 bg-slate-50 p-3 sm:p-4">{children}</div>
    </figure>
  );
}

/**
 * Hero visual — the real scored-attempt screen: overall score with the
 * accuracy / fluency / completeness breakdown, captured from the practice page.
 */
export function ScoredResultShot() {
  return (
    <div className="relative">
      <div className="absolute -top-3 right-3 z-10">
        <SampleTag />
      </div>
      <AppFrame caption="Practice · scored attempt">
        <img
          src="/tour/app-scored-result.png"
          alt="Overall pronunciation score of 84 with an accuracy, fluency, and completeness breakdown"
          className="block w-full rounded-lg"
          loading="lazy"
        />
      </AppFrame>
    </div>
  );
}

/**
 * The "key differentiator" — the raw provider signal (opaque phoneme codes and
 * scores, exactly as Azure returns them) on the left, and the app's real,
 * learner-facing coaching screen on the right. No IPA; the mapping layer turns
 * the codes into Portuguese spelling and plain-English guidance.
 */
export function RawToCoached() {
  const rawJson = `{
  "Word": "fome",
  "PronScore": 68,
  "Phonemes": [
    { "Phoneme": "F",  "AccuracyScore": 86 },
    { "Phoneme": "OW", "AccuracyScore": 62 },
    { "Phoneme": "M",  "AccuracyScore": 91 },
    { "Phoneme": "AH", "AccuracyScore": 58 }
  ]
}`;

  return (
    <div className="grid items-center gap-4 lg:grid-cols-[1fr_auto_1.15fr]">
      {/* Raw provider output */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-200">Raw assessment output</p>
            <p className="text-xs text-slate-500">Opaque phoneme codes &amp; scores — hard to act on</p>
          </div>
          <SampleTag />
        </div>
        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
          {rawJson}
        </pre>
        <p className="mt-2 text-[11px] text-slate-500">
          Codes like <span className="font-mono text-slate-400">OW</span> and{' '}
          <span className="font-mono text-slate-400">AH</span> mean nothing to a learner.
        </p>
      </div>

      {/* Arrow */}
      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-400/30 bg-primary-500/10 text-primary-300 lg:h-11 lg:w-11">
        <ArrowRight size={18} className="hidden lg:block" />
        <ArrowRight size={16} className="rotate-90 lg:hidden" />
      </div>

      {/* Coached — real app screen */}
      <div className="relative">
        <div className="absolute -top-3 right-3 z-10">
          <SampleTag />
        </div>
        <AppFrame caption="Practice · Sound Details">
          <img
            src="/tour/app-sound-coaching.png"
            alt="Sound Details panel explaining each sound in plain English with Portuguese spelling and per-sound scores"
            className="block w-full rounded-lg"
            loading="lazy"
          />
        </AppFrame>
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
