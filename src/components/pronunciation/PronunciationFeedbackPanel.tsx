import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import AttemptScoreSummary from './AttemptScoreSummary';
import WordScoreRow from './WordScoreRow';

interface PronunciationFeedbackPanelProps {
  phrase: PracticePhraseFromFixture;
  selectedAttemptIndex?: number; // default 0 for now
}

/**
 * Main composite component for displaying pronunciation feedback.
 * Shows overall scores, audio playback, and word-by-word feedback.
 */
export default function PronunciationFeedbackPanel({
  phrase,
  selectedAttemptIndex: _selectedAttemptIndex = 0,
}: PronunciationFeedbackPanelProps) {
  // For now, we only have one attempt (the fixture attempt)
  // selectedAttemptIndex is reserved for future multi-attempt support
  const currentAttemptScore = phrase.attempt;

  const getDifficultyColor = (difficulty: number): string => {
    switch (difficulty) {
      case 1:
        return 'badge-success';
      case 2:
        return 'badge-primary';
      case 3:
        return 'badge-warning';
      case 4:
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <div className="space-y-6">
      {/* Phrase text and difficulty badge */}
      <div>
        <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {phrase.text}
        </p>
        <span className={`badge ${getDifficultyColor(phrase.difficulty)}`}>
          Difficulty {phrase.difficulty}
        </span>
      </div>

      {/* Overall score summary */}
      <AttemptScoreSummary attemptScore={currentAttemptScore} />

      {/* Audio player */}
      <div>
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">
          Audio Playback
        </h3>
        <audio
          controls
          src={phrase.audioUrl}
          className="w-full"
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      {/* Word-by-word feedback */}
      <div>
        <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">
          Word-by-Word Feedback
        </h3>
        <WordScoreRow words={phrase.words} />
      </div>
    </div>
  );
}

