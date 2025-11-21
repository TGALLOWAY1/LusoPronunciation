import { memo, useState, useCallback, useEffect } from 'react';
import type { Sentence } from '@/lib/types';
import type { AttemptScore } from '@/types/pronunciation';
import AudioPlayerButton from './AudioPlayerButton';
import { useMicrophoneRecorder } from '@/hooks/useMicrophoneRecorder';
import SentenceFeedback, { type OverallScores, type WordFeedback } from './SentenceFeedback';
import { useSettingsStore } from '@/state/settingsStore';

interface SentenceCardProps {
  sentence: Sentence;
  currentIndex: number;
  totalCount: number;
}

function SentenceCard({ sentence, currentIndex, totalCount }: SentenceCardProps) {
  const { selectedVoice } = useSettingsStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempts, setAttempts] = useState<AttemptScore[]>([]);
  
  const {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    reset,
    error: recorderError,
  } = useMicrophoneRecorder();

  // Track if we're waiting for blob after stopping
  const [pendingSubmission, setPendingSubmission] = useState(false);

  // Define submitRecording before useEffect that uses it
  const submitRecording = useCallback(async (blob: Blob, url: string | undefined) => {
    setIsSubmitting(true);
    
    try {
      // Build FormData
      const formData = new FormData();
      formData.append('audio', blob, `${sentence.id}-attempt.ogg`);
      formData.append('sentenceId', sentence.id);
      formData.append('referenceText', sentence.textPt);
      formData.append('language', 'pt-BR');

      // POST to API endpoint
      const response = await fetch('/api/pronunciation-assessment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const { rawAzure, attemptScore } = await response.json();

      // Log rawAzure in development for debugging
      if (import.meta.env.DEV) {
        console.debug('Azure pronunciation assessment response:', rawAzure);
      }

      // Create new attempt with audioUrl from recorder
      const newAttempt: AttemptScore = {
        ...attemptScore,
        audioUrl: url || undefined,
      };

      // Add to attempts list
      setAttempts(prev => [newAttempt, ...prev]);

      // Reset recorder for next recording
      reset();
    } catch (error) {
      console.error('Error submitting pronunciation assessment:', error);
      alert(`Failed to assess pronunciation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
      setPendingSubmission(false);
    }
  }, [sentence.id, sentence.textPt, reset]);

  // Reset recorder when sentence changes
  useEffect(() => {
    reset();
    setAttempts([]);
  }, [sentence.id, reset]);

  // Submit when audioBlob becomes available after stopping
  useEffect(() => {
    if (pendingSubmission && audioBlob && !isRecording) {
      setPendingSubmission(false);
      submitRecording(audioBlob, audioUrl || undefined);
    }
  }, [audioBlob, audioUrl, isRecording, pendingSubmission, submitRecording]);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording - blob will be available in onstop handler
      setPendingSubmission(true);
      stopRecording();
    } else {
      // Start recording
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);
  const difficultyColors = {
    1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    2: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    4: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    5: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  const difficultyLabels = {
    1: 'Very Easy',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Very Hard',
  };

  return (
    <div className="card card-hover p-6 md:p-8">
      {/* Progress indicator */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {currentIndex + 1} of {totalCount}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge ${difficultyColors[sentence.difficulty]}`}
          >
            {difficultyLabels[sentence.difficulty]}
          </span>
          <span className="badge badge-secondary">
            {sentence.categoryLabelEn}
          </span>
        </div>
      </div>

      {/* Portuguese sentence - prominent */}
      <div className="mb-6">
        <p className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
          {sentence.textPt}
        </p>
      </div>

      {/* English translation - smaller, lighter */}
      <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 italic">
          {sentence.translationEn}
        </p>
      </div>

      {/* Audio playback controls - uses global voice setting */}
      {(() => {
        const audioUrl = selectedVoice === 'male' ? sentence.audioMaleUrl : sentence.audioFemaleUrl;
        if (!audioUrl) return null;
        
        return (
          <div className="mb-6 flex gap-3">
            <AudioPlayerButton
              audioUrl={audioUrl}
              label={selectedVoice === 'male' ? 'Male Voice' : 'Female Voice'}
              icon={selectedVoice === 'male' ? '👨' : '👩'}
              variant={selectedVoice}
            />
          </div>
        );
      })()}

      {/* Pronunciation tips */}
      {sentence.pronunciationNotes && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 rounded">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">💡 Pronunciation Tip</p>
          <p className="text-sm text-blue-800 dark:text-blue-300">{sentence.pronunciationNotes}</p>
        </div>
      )}

      {/* Recording controls */}
      <div className="mb-6">
        <button
          onClick={handleRecordToggle}
          disabled={isSubmitting}
          className={`btn btn-md ${
            isRecording
              ? 'btn-danger'
              : 'btn-primary'
          } w-full sm:w-auto`}
        >
          {isRecording ? (
            <>
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></span>
              Stop & Score
            </>
          ) : (
            'Record'
          )}
        </button>
        {recorderError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{recorderError}</p>
        )}
      </div>

      {/* Pronunciation Feedback - show feedback for the most recent attempt */}
      {attempts.length > 0 && (() => {
        const latestAttempt = attempts[0]; // Most recent is first in array
        
        // Map AttemptScore to SentenceFeedbackProps
        const overall: OverallScores = {
          accuracy: latestAttempt.overallAccuracy,
          fluency: latestAttempt.fluency,
          completeness: latestAttempt.completeness,
          prosody: latestAttempt.prosody,
        };

        // Map word scores to WordFeedback format
        const words: WordFeedback[] = latestAttempt.wordScores.map((ws, index) => ({
          index,
          text: ws.word,
          accuracyScore: ws.accuracy,
          errorType: ws.errorType,
        }));

        return <SentenceFeedback overall={overall} words={words} />;
      })()}

      {/* Category info (optional, subtle) */}
      <div className="text-xs text-gray-400 dark:text-gray-500">
        Category: {sentence.categoryLabelPt}
      </div>
    </div>
  );
}

export default memo(SentenceCard);

