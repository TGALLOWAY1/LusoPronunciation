import { useState, useEffect } from 'react';
import { getAllPracticePhrasesFromFixtures, type PracticePhraseFromFixture } from '@/lib/pronunciationFixtureAdapter';
import SentenceFeedback, { type OverallScores, type WordFeedback } from '@/components/practice/SentenceFeedback';

/**
 * Development page for exploring pronunciation fixtures.
 * 
 * This page uses fixture data from data/test_data/pronunciation_fixtures.json
 * for UI prototyping and regression testing.
 */
export default function PronunciationFixtures() {
  const [phrases, setPhrases] = useState<PracticePhraseFromFixture[]>([]);
  const [selectedPhrase, setSelectedPhrase] = useState<PracticePhraseFromFixture | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    // Load all practice phrases once (no network requests)
    const allPhrases = getAllPracticePhrasesFromFixtures();
    setPhrases(allPhrases);
    
    // Select first phrase by default
    if (allPhrases.length > 0) {
      setSelectedPhrase(allPhrases[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handlePhraseClick = (phrase: PracticePhraseFromFixture) => {
    setSelectedPhrase(phrase);
    setAudioError(null);
  };

  const handleAudioError = () => {
    setAudioError('Audio file could not be loaded. Check the file path.');
  };

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header note */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Development Page:</strong> This page uses fixture data from{' '}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">data/test_data/pronunciation_fixtures.json</code>{' '}
            for UI prototyping and regression testing.
          </p>
        </div>

        {/* Main content area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side: Phrase list */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
              Phrases ({phrases.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {phrases.map((phrase) => (
                <button
                  key={phrase.id}
                  onClick={() => handlePhraseClick(phrase)}
                  className={`w-full text-left p-3 rounded border-2 transition-colors ${
                    selectedPhrase?.id === phrase.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {phrase.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge ${getDifficultyColor(phrase.difficulty)}`}>
                          Difficulty {phrase.difficulty}
                        </span>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Score: {Math.round(phrase.attempt.overallAccuracy)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right side: Selected phrase details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {selectedPhrase ? (
              <>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                  Phrase Details
                </h2>

                {/* Phrase text and difficulty */}
                <div className="mb-6">
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {selectedPhrase.text}
                  </p>
                  <span className={`badge ${getDifficultyColor(selectedPhrase.difficulty)}`}>
                    Difficulty {selectedPhrase.difficulty}
                  </span>
                </div>

                {/* Pronunciation Feedback - using shared component */}
                <div className="mb-6">
                  {(() => {
                    // Map fixture attempt to SentenceFeedbackProps format
                    const overall: OverallScores = {
                      accuracy: selectedPhrase.attempt.overallAccuracy,
                      fluency: selectedPhrase.attempt.fluency,
                      completeness: selectedPhrase.attempt.completeness,
                      prosody: selectedPhrase.attempt.prosody,
                    };

                    // Map word scores if available, otherwise create from text
                    const words: WordFeedback[] = selectedPhrase.attempt.wordScores.length > 0
                      ? selectedPhrase.attempt.wordScores.map((ws, index) => ({
                          index,
                          text: ws.word,
                          accuracyScore: ws.accuracy,
                          errorType: ws.errorType,
                        }))
                      : selectedPhrase.text.split(/\s+/).map((word, index) => ({
                          index,
                          text: word,
                          accuracyScore: selectedPhrase.attempt.overallAccuracy, // Use overall as fallback
                        }));

                    return <SentenceFeedback overall={overall} words={words} />;
                  })()}
                </div>

                {/* Audio player */}
                <div className="mb-4">
                  <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-gray-100">
                    Audio Playback
                  </h3>
                  <audio
                    controls
                    src={selectedPhrase.audioUrl}
                    onError={handleAudioError}
                    className="w-full"
                  >
                    Your browser does not support the audio element.
                  </audio>
                  {audioError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{audioError}</p>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Source: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{selectedPhrase.audioUrl}</code>
                  </p>
                </div>

                {/* Additional metadata */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>Attempt ID:</strong> {selectedPhrase.attempt.attemptId}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <strong>Created:</strong> {new Date(selectedPhrase.attempt.createdAt).toLocaleString()}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p>Select a phrase from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

