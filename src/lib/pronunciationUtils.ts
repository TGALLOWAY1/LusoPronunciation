import type { AttemptScore, WordScore, ErrorType } from '../types/pronunciation';
import { normalizeAzurePronunciationResponse } from './azurePronunciationNormalizer';

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
 * Uses the normalizer to handle different Azure response formats (Studio vs REST API).
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
  audioUrl?: string,
  referenceText?: string
): AttemptScore {
  // Normalize the Azure response to a consistent format
  const normalized = normalizeAzurePronunciationResponse(raw);
  
  const { pronunciationAssessment, words } = normalized.bestHypothesis;

  // Debug logging in development to diagnose missing Prosody
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.log('[pronunciationUtils] Normalized pronunciation assessment:', {
      accuracyScore: pronunciationAssessment.accuracyScore,
      fluencyScore: pronunciationAssessment.fluencyScore,
      completenessScore: pronunciationAssessment.completenessScore,
      prosodyScore: pronunciationAssessment.prosodyScore,
      pronScore: pronunciationAssessment.pronScore,
      allKeys: Object.keys(pronunciationAssessment),
    });
    // Also log raw Azure response structure for ProsodyScore
    const rawNBest = (Array.isArray(raw) ? raw[0] : raw)?.NBest?.[0];
    if (rawNBest) {
      console.log('[pronunciationUtils] Raw Azure NBest[0] keys:', Object.keys(rawNBest));
      console.log('[pronunciationUtils] Raw Azure ProsodyScore check:', {
        'NBest[0].ProsodyScore': rawNBest.ProsodyScore,
        'NBest[0].prosodyScore': rawNBest.prosodyScore,
        'NBest[0].PronunciationAssessment?.ProsodyScore': rawNBest.PronunciationAssessment?.ProsodyScore,
        'NBest[0].PronunciationAssessment?.prosodyScore': rawNBest.PronunciationAssessment?.prosodyScore,
      });
    }
  }

  // Map overall scores from normalized structure
  const overallAccuracy = pronunciationAssessment.accuracyScore ?? 0;
  const fluency = pronunciationAssessment.fluencyScore;
  const completeness = pronunciationAssessment.completenessScore;
  const prosody = pronunciationAssessment.prosodyScore;

  const referenceTokenCount = Array.from(referenceText?.matchAll(/[\p{L}\p{N}]+/gu) ?? []).length;

  // Map word-level scores from normalized structure
  const wordScores: WordScore[] = words.map((wordItem, wordIndex) => {
    const wordText = wordItem.word || '';
    const wordAccuracy = wordItem.pronunciationAssessment.accuracyScore ?? 0;
    const errorType = mapAzureErrorType(wordItem.pronunciationAssessment.errorType);
    const referenceTokenIndex = wordIndex < referenceTokenCount ? wordIndex : undefined;

    return {
      word: wordText,
      accuracy: wordAccuracy,
      errorType: errorType !== 'none' ? errorType : undefined,
      azureWordIndex: wordIndex,
      referenceTokenIndex,
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
    recognitionStatus: normalized.recognitionStatus,
  };
}
