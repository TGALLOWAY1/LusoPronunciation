import {
  AudioLines,
  Cloud,
  Database,
  FileAudio,
  Gauge,
  Headphones,
  ListChecks,
  Mic,
  type LucideIcon,
} from 'lucide-react';
import { TOUR_FACTS } from './tourFacts.generated';

export const GITHUB_URL = 'https://github.com/TGALLOWAY1/LusoPronunciation';

export const IMPLEMENTATION_LABELS = [
  'React 19 + TypeScript',
  'Express + MongoDB',
  'Azure Speech + neural TTS',
  'PT-BR coaching engine',
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
    title: 'Hear the sentence in Brazilian Portuguese',
    body: 'Compare your pronunciation with male or female PT-BR reference audio generated with Azure neural text-to-speech.',
    evidence: 'Azure neural text-to-speech · two PT-BR voices',
  },
  {
    icon: Mic,
    kicker: 'Practice',
    title: 'Record a practice attempt',
    body: 'Record in the browser, review the take, and retry before sending it for assessment. Very short or effectively silent recordings are stopped early.',
    evidence: 'Browser recording · pre-submit quality checks',
  },
  {
    icon: Gauge,
    kicker: 'Feedback',
    title: 'See which words need attention',
    body: 'Azure Speech returns overall, fluency, completeness, and word-level accuracy so the learner can focus on a specific part of the sentence.',
    evidence: 'Azure Speech pronunciation assessment · word-level results',
  },
  {
    icon: ListChecks,
    kicker: 'Coaching',
    title: 'Turn a weak word into a practical correction',
    body: 'LusoPronounce connects the weak word to PT-BR sound guidance, showing how to shape the sound and what to practice next.',
    evidence: 'Deterministic PT-BR coaching · articulation guidance',
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
    label: 'Practice sentences',
    description: 'Brazilian Portuguese sentences available to the practice experience.',
    source: 'data/masterSentences.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.words,
    label: 'Practice words',
    description: 'Word entries supporting sentence alignment, sound guidance, and targeted practice.',
    source: 'data/masterWords.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.phonemeMetadataEntries,
    label: 'PT-BR sound profiles',
    description: 'Articulation guidance, common mistakes, examples, and teaching tips for Brazilian Portuguese sounds.',
    source: 'data/phoneme_metadata.json',
    verification: 'Deterministic top-level array count.',
  },
  {
    value: TOUR_FACTS.confusionPatternTags,
    label: 'Coaching patterns',
    description: 'Common pronunciation contrasts recognized by the rule-based coaching layer.',
    source: 'confusionDetection.ts',
    verification: 'Unique tags referenced by the coaching pair dataset.',
  },
  {
    value: TOUR_FACTS.minimalPairPrompts,
    label: 'Tagged contrast prompts',
    description: 'Minimal contrasts prepared in the coaching dataset; not presented as a live drill feature.',
    source: 'minimalPairs.ptbr.ts',
    verification: 'Deterministic exported-array count.',
  },
  {
    value: TOUR_FACTS.dualVoiceAudioIndexEntries,
    label: 'Two-voice audio entries',
    description: 'Practice references with both male and female Azure neural PT-BR voice variants.',
    source: 'data/audio_index.json',
    verification: 'Deterministic count of records with non-empty male and female URL fields.',
  },
];

export type Capability = {
  title: string;
  description: string;
  status: 'Try now' | 'Authenticated path' | 'Built';
  source: string;
};

export const CAPABILITIES: Capability[] = [
  {
    title: 'Explore the coaching flow without setup',
    description: 'The public demo uses local sample states and bundled audio, so recruiters can inspect the experience immediately.',
    status: 'Try now',
    source: '/demo · demoData.ts',
  },
  {
    title: 'Record and assess real speech',
    description: 'The authenticated path captures microphone audio, checks recording quality, and submits accepted takes for assessment.',
    status: 'Authenticated path',
    source: 'useMicrophoneRecorder · audioQuality',
  },
  {
    title: 'Inspect word-by-word Azure feedback',
    description: 'The product handles overall, fluency, completeness, recognition, miscue, and per-word accuracy results.',
    status: 'Authenticated path',
    source: 'pronunciationAssessment · normalizer',
  },
  {
    title: 'Track attempts and practice patterns',
    description: 'Completed attempts feed local history and progress views, with authenticated attempts also written to the server.',
    status: 'Authenticated path',
    source: 'practiceLogStore · ProgressPage',
  },
  {
    title: 'Compare two synthesized PT-BR voices',
    description: 'The practice corpus includes male and female Azure neural reference-audio variants.',
    status: 'Built',
    source: 'generationPipeline.config · audio_index',
  },
  {
    title: 'Open the deployed tour and demo',
    description: 'The public tour and deterministic demo are deployed on Vercel and linked to the source repository.',
    status: 'Try now',
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
    title: 'Capture & validate',
    location: 'Browser',
    input: 'Learner microphone',
    responsibility: 'Record the take and stop audio that is too short, too quiet, or cannot be decoded.',
    output: 'Accepted practice recording',
  },
  {
    icon: FileAudio,
    title: 'Prepare audio',
    location: 'App server',
    input: 'Browser recording',
    responsibility: 'Attempt a consistent FFmpeg audio target and report when the original upload must be used instead.',
    output: 'Assessment-ready audio',
  },
  {
    icon: Cloud,
    title: 'Assess with Azure',
    location: 'External provider',
    input: 'Audio + Portuguese sentence',
    responsibility: 'Run Azure Speech pronunciation assessment and return sentence and word-level results.',
    output: 'Accuracy, fluency, completeness & word scores',
  },
  {
    icon: AudioLines,
    title: 'Turn scores into coaching',
    location: 'Browser + server',
    input: 'Azure results + PT-BR sound data',
    responsibility: 'Normalize the response, check its reliability, and connect weak words to actionable sound guidance.',
    output: 'Learner-facing pronunciation feedback',
  },
  {
    icon: Database,
    title: 'Save & learn',
    location: 'Browser + server',
    input: 'Completed practice attempt',
    responsibility: 'Update practice history and store authenticated attempts for later progress review.',
    output: 'Attempt history & progress views',
  },
];
