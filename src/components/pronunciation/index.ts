export { default as WordScoreChip } from './WordScoreChip';
export { default as WordScoreRow } from './WordScoreRow';
export { default as AttemptScoreSummary } from './AttemptScoreSummary';
export { default as PronunciationFeedbackPanel } from './PronunciationFeedbackPanel';
export type { PronunciationFeedbackPanelProps } from './PronunciationFeedbackPanel';
export { default as PhraseDifficultyPerformancePlot } from './PhraseDifficultyPerformancePlot';
export { default as DifficultyScoreBarChart } from './DifficultyScoreBarChart';

// Re-export shared components for backward compatibility
export {
  SentenceAudioControls,
  InteractiveWordStrip,
  PhonemePanel,
  PhraseScoreOverview,
  PhraseTrendSparkline,
} from './shared';

