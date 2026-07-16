import {
  AudioLines,
  BadgeCheck,
  Cloud,
  Database,
  FileAudio,
  Gauge,
  Headphones,
  ListChecks,
  Mic,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { TOUR_FACTS } from './tourFacts.generated';

export const GITHUB_URL = 'https://github.com/TGALLOWAY1/LusoPronunciation';
export const LIVE_DEMO_URL = 'https://luso-pronunciation.vercel.app/demo';

export const IMPLEMENTATION_LABELS = [
  'React 19 + TypeScript',
  'Express + MongoDB',
  'Azure Speech assessment',
  'Deterministic PT-BR metadata',
] as const;

export type WalkthroughStep = {
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  evidence: string;
};

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    icon: Headphones,
    kicker: 'Reference',
    title: 'Choose a sentence and hear the target',
    body: 'Practice items include pre-generated male and female Azure neural PT-BR reference audio.',
    evidence: 'audio_index.json + Azure TTS voice configuration',
  },
  {
    icon: Mic,
    kicker: 'Capture',
    title: 'Record, review, then submit',
    body: 'The authenticated product records in the browser and blocks very short or effectively silent takes before a request is sent.',
    evidence: 'useMicrophoneRecorder + audioQuality',
  },
  {
    icon: Gauge,
    kicker: 'Assessment',
    title: 'Read the returned score at the right level',
    body: 'The current live Azure path returns overall, fluency, completeness, miscue, and word-level accuracy data.',
    evidence: 'pronunciationAssessment + pronunciationUtils',
  },
  {
    icon: ListChecks,
    kicker: 'Coaching',
    title: 'Move from a weak word to a teachable sound',
    body: 'A scored word is joined to canonical PT-BR phoneme metadata so the learner can inspect articulation notes and retry deliberately.',
    evidence: 'adapters + masterWords + phoneme_metadata',
  },
];

export type Challenge = {
  icon: LucideIcon;
  title: string;
  summary: string;
  detail: string;
  source: string;
};

export const SUPPORTING_CHALLENGES: Challenge[] = [
  {
    icon: ShieldCheck,
    title: 'Reject weak inputs before they spend an API call',
    summary: 'Duration and RMS gates run in the browser before submission.',
    detail:
      'The current thresholds reject recordings shorter than 900 ms or below an RMS of 0.012. Decode failures also stop the request and ask the learner to record again.',
    source: 'src/lib/audioQuality.ts · submitAttempt()',
  },
  {
    icon: Route,
    title: 'Keep incomplete provider output honest',
    summary: 'Recognition status, completeness, and missing-word ratio control the level of detail shown.',
    detail:
      'The trust classifier marks attempts as trusted, degraded, or untrusted. Detailed phoneme help is withheld for untrusted responses rather than treating an incomplete assessment as precise.',
    source: 'src/lib/assessmentTrust.ts · PhonemePanel',
  },
  {
    icon: SlidersHorizontal,
    title: 'Join scores to PT-BR teaching metadata',
    summary: 'Word indices and normalized text provide controlled fallbacks into the canonical dataset.',
    detail:
      'The adapter first preserves provider phonemes when present. Otherwise it uses sentence word references, then normalized text, to attach the repository’s phoneme sequence without fabricating phoneme scores.',
    source: 'enrichWordsWithCanonicalData()',
  },
];

export type EvidenceFact = {
  value: number;
  label: string;
  description: string;
  source: string;
  verification: string;
};

export const DATASET_FACTS: EvidenceFact[] = [
  {
    value: TOUR_FACTS.sentences,
    label: 'Sentence records',
    description: 'Current master sentence dataset used by the practice loader.',
    source: 'data/masterSentences.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.words,
    label: 'Word records',
    description: 'Current master word dataset with IDs, references, and enrichment fields.',
    source: 'data/masterWords.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.phonemeMetadataEntries,
    label: 'Phoneme metadata entries',
    description: 'PT-BR teaching records; this is not a claim of complete phoneme coverage.',
    source: 'data/phoneme_metadata.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.confusionPatternTags,
    label: 'Confusion-pattern tags',
    description: 'Tags used by deterministic spelling and weak-word heuristics.',
    source: 'confusionDetection.ts',
    verification: 'Unique tags referenced by the coaching pair dataset.',
  },
  {
    value: TOUR_FACTS.minimalPairPrompts,
    label: 'Tagged contrast prompts',
    description: 'Repository coaching data with selector logic; not presented as a currently accessible drill.',
    source: 'minimalPairs.ptbr.ts',
    verification: 'Deterministic exported-array count.',
  },
  {
    value: TOUR_FACTS.dualVoiceAudioIndexEntries,
    label: 'Dual-voice audio index entries',
    description: 'Practice audio records containing both configured Azure neural voice URL fields.',
    source: 'data/audio_index.json',
    verification: 'Deterministic count of records with non-empty male and female URL fields.',
  },
];

export type Capability = {
  title: string;
  description: string;
  status: 'Public sample' | 'Authenticated product' | 'Implementation';
  source: string;
};

export const CAPABILITIES: Capability[] = [
  {
    title: 'Deterministic public demo',
    description: 'Local sample states and static audio; no microphone, account, backend, or Azure key.',
    status: 'Public sample',
    source: '/demo · demoData.ts',
  },
  {
    title: 'Browser recording with quality gates',
    description: 'MediaRecorder capture plus pre-submit duration and loudness checks.',
    status: 'Authenticated product',
    source: 'useMicrophoneRecorder · audioQuality',
  },
  {
    title: 'Word-level Azure assessment',
    description: 'Overall, fluency, completeness, miscue, recognition, and per-word accuracy handling.',
    status: 'Authenticated product',
    source: 'pronunciationAssessment · normalizer',
  },
  {
    title: 'Attempt history and progress analysis',
    description: 'Client-hydrated history and analytics with authenticated server dual-write.',
    status: 'Authenticated product',
    source: 'practiceLogStore · ProgressPage',
  },
  {
    title: 'Male and female synthesized references',
    description: 'Azure neural PT-BR voice URLs indexed for the current practice corpus.',
    status: 'Implementation',
    source: 'generationPipeline.config · audio_index',
  },
  {
    title: 'Static Vercel story deployment',
    description: 'The public tour and demo were reachable on Vercel during this audit.',
    status: 'Public sample',
    source: 'vercel.json · verified 2026-07-16',
  },
];

export type PipelineStage = {
  icon: LucideIcon;
  title: string;
  location: 'Browser' | 'App server' | 'External provider' | 'Browser + server';
  input: string;
  responsibility: string;
  output: string;
};

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    icon: Mic,
    title: 'Capture',
    location: 'Browser',
    input: 'Microphone stream',
    responsibility: 'Prefer Ogg/Opus; fall back to supported MediaRecorder output.',
    output: 'Encoded audio Blob',
  },
  {
    icon: BadgeCheck,
    title: 'Quality gate',
    location: 'Browser',
    input: 'Encoded audio Blob',
    responsibility: 'Decode, measure duration and RMS, and stop invalid takes.',
    output: 'Accepted multipart upload',
  },
  {
    icon: FileAudio,
    title: 'Normalize',
    location: 'App server',
    input: 'Browser audio',
    responsibility: 'Attempt FFmpeg conversion with timeout and record fallback use.',
    output: '16 kHz mono s16 WAV or original fallback',
  },
  {
    icon: Cloud,
    title: 'Assess',
    location: 'External provider',
    input: 'Audio + PT-BR reference text',
    responsibility: 'Run Azure pronunciation assessment at word granularity.',
    output: 'Overall, sub-score, miscue, and word data',
  },
  {
    icon: Route,
    title: 'Normalize response',
    location: 'App server',
    input: 'Azure detailed response',
    responsibility: 'Map provider variants into the typed AttemptScore contract.',
    output: 'Stable word-score model',
  },
  {
    icon: AudioLines,
    title: 'Teach',
    location: 'Browser',
    input: 'AttemptScore + canonical word refs',
    responsibility: 'Gate trust and attach PT-BR sound metadata without inventing scores.',
    output: 'Progressive learner feedback',
  },
  {
    icon: Database,
    title: 'Persist',
    location: 'Browser + server',
    input: 'Completed attempt',
    responsibility: 'Update the local practice log and dual-write authenticated attempts.',
    output: 'History, analytics, MongoDB record',
  },
];
