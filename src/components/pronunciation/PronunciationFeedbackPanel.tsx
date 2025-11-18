import { useState } from 'react';
import type { PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import type { WordFeedback } from '@/types/pronunciationFixtures';
import SentenceAudioControls from './SentenceAudioControls';
import PhraseScoreOverview from './PhraseScoreOverview';
import InteractiveWordStrip from './InteractiveWordStrip';
import PhonemePanel from './PhonemePanel';

interface PronunciationFeedbackPanelProps {
  phrase: PracticePhraseFromFixture;
}

/**
 * Main composite component for displaying pronunciation feedback.
 * Shows overall scores, audio playback, and word-by-word feedback.
 */
export default function PronunciationFeedbackPanel({
  phrase,
}: PronunciationFeedbackPanelProps) {
  const [selectedWord, setSelectedWord] = useState<WordFeedback | null>(null);
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

  const handleWordSelected = (word: WordFeedback) => {
    setSelectedWord(word);
  };

  const handleClosePhonemePanel = () => {
    setSelectedWord(null);
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

      {/* Sentence audio controls */}
      <SentenceAudioControls sentenceAudio={phrase.sentenceAudio} />

      {/* Graphical score overview */}
      <PhraseScoreOverview
        attemptScore={currentAttemptScore}
        words={phrase.words}
        onWordSelected={handleWordSelected}
      />

      {/* Interactive word strip */}
      <InteractiveWordStrip
        words={phrase.words}
        wordAudios={phrase.wordAudios}
        onWordSelected={handleWordSelected}
      />

      {/* Phoneme panel */}
      <PhonemePanel word={selectedWord} onClose={handleClosePhonemePanel} />
    </div>
  );
}

