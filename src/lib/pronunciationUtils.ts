import type { AttemptScore, WordScore, ErrorType } from '@/types/pronunciation';

/**
 * Maps Azure's ErrorType values to our ErrorType enum
 */
function mapAzureErrorType(azureErrorType: string | undefined): ErrorType {
  if (!azureErrorType) return 'none';
  
  const normalized = azureErrorType.toLowerCase();
  if (normalized === 'none' || normalized === '') return 'none';
  if (normalized === 'mispronunciation' || normalized === 'mispronounced') return 'mispronounced';
  if (normalized === 'omission' || normalized === 'omitted') return 'omitted';
  if (normalized === 'insertion' || normalized === 'extra') return 'extra';
  
  // Default to 'none' for unknown types
  return 'none';
}

/**
 * Maps Azure Speech pronunciation assessment result to AttemptScore
 * 
 * @param raw - The JSON response from Azure short-audio + pronunciation assessment
 * @param sentenceId - The ID of the sentence being assessed
 * @param attemptId - Unique identifier for this attempt
 * @param audioUrl - Optional local blob URL for playback
 * @returns AttemptScore with mapped data
 */
export function mapAzurePronunciationResultToAttemptScore(
  raw: any,
  sentenceId: string,
  attemptId: string,
  audioUrl?: string
): AttemptScore {
  // Extract the best hypothesis from NBest[0]
  const bestHypothesis = raw?.NBest?.[0];
  const pronunciationAssessment = bestHypothesis?.PronunciationAssessment || {};
  const words = bestHypothesis?.Words || [];

  // Map overall scores (default to 0 if missing)
  const overallAccuracy = pronunciationAssessment.AccuracyScore ?? 0;
  const fluency = pronunciationAssessment.FluencyScore ?? undefined;
  const completeness = pronunciationAssessment.CompletenessScore ?? undefined;
  const prosody = pronunciationAssessment.ProsodyScore ?? undefined;

  // Map word-level scores
  const wordScores: WordScore[] = words.map((wordItem: any) => {
    const wordText = wordItem.Word || '';
    const wordAssessment = wordItem.PronunciationAssessment || {};
    const wordAccuracy = wordAssessment.AccuracyScore ?? 0;
    const errorType = mapAzureErrorType(wordAssessment.ErrorType);

    return {
      word: wordText,
      accuracy: wordAccuracy,
      errorType: errorType !== 'none' ? errorType : undefined,
    };
  });

  return {
    attemptId,
    sentenceId,
    overallAccuracy,
    fluency,
    completeness,
    prosody,
    wordScores,
    createdAt: new Date().toISOString(),
    audioUrl,
  };
}

