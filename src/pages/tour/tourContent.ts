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
