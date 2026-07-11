/**
 * Tour Page Content — grounded, recruiter-facing case-study copy.
 * ------------------------------------------------------------------
 * Every claim in this file is traceable to a source in the repository.
 * See the inline `// source:` notes. Numeric facts are derived from real
 * datasets / config; nothing here is invented marketing.
 *
 * Illustrative data (sample scores, phoneme breakdowns) is pulled from
 * `@/lib/demo/demoData` — the same hand-authored sample set the public
 * `/demo` uses — and is always labelled "Sample data" in the UI.
 */
import {
  Mic,
  Waves,
  Cloud,
  BrainCircuit,
  LayoutDashboard,
  Database,
  AudioLines,
  Route,
  Gauge,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';

/** Compact metadata chips shown under the hero headline. Verified facts only. */
export const HERO_META: { label: string; value: string }[] = [
  { label: 'Role', value: 'Solo full-stack build' }, // single-author repo
  { label: 'Stack', value: 'React · TS · Azure Speech · MongoDB' }, // source: package.json
  { label: 'Focus', value: 'Speech AI + coaching UX' },
  { label: 'Status', value: 'Deployed demo' }, // source: vercel.json / railway.json / Dockerfile
];

/** "Product in 30 seconds" — the core interaction loop. */
export const LOOP_STEPS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: AudioLines,
    title: 'Listen',
    body: 'Hear native male or female reference audio for the phrase.',
  }, // source: FEATURES.md "Native Audio Playback"
  {
    icon: Mic,
    title: 'Record',
    body: 'Speak in the browser — audio is captured and normalized for scoring.',
  }, // source: useMicrophoneRecorder.ts
  {
    icon: Gauge,
    title: 'Score',
    body: 'Azure Speech returns word- and phoneme-level pronunciation scores.',
  }, // source: pronunciationAssessment.ts
  {
    icon: ListChecks,
    title: 'Improve',
    body: 'Get targeted coaching on the exact sounds to fix, then retry.',
  }, // source: coachingEngine.ts
];

/** "What I built" — ownership + engineering contribution. */
export const BUILT_CARDS: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Cloud,
    title: 'Speech assessment pipeline',
    body: 'Browser recording → ffmpeg WAV normalization (16 kHz, mono) → Azure Speech pronunciation assessment, with async scoring and audio-quality gates.',
  },
  {
    icon: BrainCircuit,
    title: 'Phoneme feedback engine',
    body: 'Maps Azure’s raw phoneme scores and error types onto a 36-phoneme Brazilian-Portuguese knowledge base, detects sound-confusion patterns, and surfaces minimal-pair drills.',
  },
  {
    icon: LayoutDashboard,
    title: 'Scoring & progress UI',
    body: 'Word-by-word and phoneme-level score visualizations, score breakdowns, trend sparklines, and a coaching-first practice flow.',
  },
  {
    icon: Database,
    title: 'History & practice tracking',
    body: 'Express + MongoDB backend with JWT auth persists per-user attempts, sessions, and progress analytics over time.',
  },
];

/** Engineering challenges / technical decisions — recruiter-relevant substance. */
export const CHALLENGES: {
  icon: LucideIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: Waves,
    title: 'Browser audio → clean, consistent WAV',
    body: 'Captured Opus audio reliably across browsers, then downmixed to 16 kHz mono 16-bit PCM server-side with ffmpeg so Azure always receives a consistent signal.',
  }, // source: useMicrophoneRecorder.ts + audioConversion.ts
  {
    icon: Route,
    title: 'Mapping raw Azure output to PT-BR coaching',
    body: 'Built a phoneme mapping layer and rule set for Brazilian Portuguese — nasal vowels, the tapped “r”, “lh/nh”, vowel reduction — turning opaque scores into specific, teachable fixes.',
  }, // source: coaching/ + phonemeMetadata
  {
    icon: Gauge,
    title: 'Trustworthy feedback, not noise',
    body: 'Client-side quality gates reject silent or too-short takes, and a confidence badge suppresses coaching when recognition is unreliable, so learners never act on bad tips.',
  }, // source: audioQuality.ts + FEATURES.md "Confidence Trust Badge"
  {
    icon: LayoutDashboard,
    title: 'Detail without overwhelm',
    body: 'Designed progressive disclosure — overall score → sub-scores → word → phoneme — that auto-focuses the weakest sound instead of dumping every metric at once.',
  }, // source: FEATURES.md sentence-practice flow
];

/** Verified numeric evidence. Each value is derived from a real source. */
export const STAT_TILES: { value: string; label: string; note: string }[] = [
  { value: '36', label: 'PT-BR phoneme map', note: 'data/phoneme_metadata.json' },
  { value: '13', label: 'Sound-confusion sets', note: 'confusionDetection.ts' },
  { value: '42', label: 'Minimal-pair drills', note: 'minimalPairs.ptbr.ts' },
  { value: '593 · 974', label: 'Curated sentences · words', note: 'master datasets' },
];

/** Qualitative, verified capabilities (used where numbers would be invented). */
export const EVIDENCE_CHIPS: string[] = [
  'Interactive demo — no account, mic, or API keys',
  'Word-, phoneme-, and score-level feedback',
  'Attempt history & progress analytics',
  'Native male & female reference audio',
  'Responsive, dark-mode web UI',
  'Deployed on Vercel + Railway',
];

/** Technical architecture pipeline stages. */
export const ARCH_STAGES: {
  icon: LucideIcon;
  title: string;
  sub: string;
}[] = [
  { icon: Mic, title: 'Browser audio', sub: 'MediaRecorder (Opus)' },
  { icon: Waves, title: 'WAV processing', sub: 'ffmpeg · 16 kHz mono PCM' },
  { icon: Cloud, title: 'Azure Speech', sub: 'Pronunciation assessment' },
  { icon: BrainCircuit, title: 'Coaching engine', sub: 'PT-BR phoneme rules' },
  { icon: LayoutDashboard, title: 'Feedback UI', sub: 'Scores · chips · trends' },
  { icon: Database, title: 'Persistence', sub: 'MongoDB · users & history' },
];
