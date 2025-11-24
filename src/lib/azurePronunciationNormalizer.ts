/**
 * Azure Pronunciation Assessment Response Normalizer
 * 
 * Normalizes Azure Speech Service pronunciation assessment responses to a consistent format,
 * regardless of whether they come from:
 * - Azure Studio (array format with nested PronunciationAssessment)
 * - REST API (object format, may have scores directly or nested)
 * - Different API versions or configurations
 * 
 * Expected fixture format (from Azure Studio):
 * [
 *   {
 *     "RecognitionStatus": "Success",
 *     "NBest": [
 *       {
 *         "PronunciationAssessment": {
 *           "AccuracyScore": 97,
 *           "FluencyScore": 98,
 *           "ProsodyScore": 80.3,
 *           "CompletenessScore": 100,
 *           "PronScore": 91.1
 *         },
 *         "Words": [
 *           {
 *             "Word": "oi",
 *             "PronunciationAssessment": {
 *               "AccuracyScore": 97,
 *               "ErrorType": "None"
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * ]
 * 
 * Actual live REST API format (observed):
 * {
 *   "RecognitionStatus": "Success",
 *   "NBest": [
 *     {
 *       "AccuracyScore": 0,  // Direct property, not nested
 *       "FluencyScore": 0,
 *       "CompletenessScore": 0,
 *       "PronScore": 0,
 *       "Words": [
 *         {
 *           "Word": "Estou",
 *           "AccuracyScore": 0,  // Direct property
 *           "ErrorType": "Omission"
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

export interface NormalizedAzurePronunciationResult {
  /** Root-level recognition status */
  recognitionStatus: string;
  
  /** Best hypothesis from NBest[0] */
  bestHypothesis: {
    /** Overall pronunciation scores (normalized to always be in PronunciationAssessment shape) */
    pronunciationAssessment: {
      accuracyScore: number;
      fluencyScore?: number;
      completenessScore?: number;
      prosodyScore?: number;
      pronScore?: number;
    };
    
    /** Word-level assessments */
    words: Array<{
      word: string;
      pronunciationAssessment: {
        accuracyScore: number;
        errorType?: string;
      };
    }>;
  };
}

/**
 * Normalizes an Azure pronunciation assessment response to a consistent format.
 * 
 * Handles:
 * - Array vs object root format
 * - Nested PronunciationAssessment vs direct properties
 * - Missing optional fields
 * 
 * @param raw - Raw Azure response (array or object)
 * @returns Normalized result with consistent structure
 */
export function normalizeAzurePronunciationResponse(
  raw: unknown
): NormalizedAzurePronunciationResult {
  // Handle array format (Azure Studio) vs object format (REST API)
  const azureResponse = Array.isArray(raw) ? raw[0] : raw;
  
  if (!azureResponse || typeof azureResponse !== 'object') {
    throw new Error('Invalid Azure response: expected object or array');
  }
  
  const recognitionStatus = 
    (azureResponse as any).RecognitionStatus || 
    (azureResponse as any).recognitionStatus || 
    'Unknown';
  
  const nBest = (azureResponse as any).NBest || (azureResponse as any).nBest || [];
  const bestHypothesis = nBest[0];
  
  if (!bestHypothesis) {
    throw new Error('Invalid Azure response: NBest array is empty');
  }
  
  // Extract overall scores - check both nested PronunciationAssessment and direct properties
  const pronunciationAssessmentObj = bestHypothesis.PronunciationAssessment || bestHypothesis.pronunciationAssessment || {};
  const overallAccuracy = 
    pronunciationAssessmentObj.AccuracyScore ?? 
    pronunciationAssessmentObj.accuracyScore ??
    bestHypothesis.AccuracyScore ?? 
    bestHypothesis.accuracyScore ?? 
    0;
  const overallFluency = 
    pronunciationAssessmentObj.FluencyScore ?? 
    pronunciationAssessmentObj.fluencyScore ??
    bestHypothesis.FluencyScore ?? 
    bestHypothesis.fluencyScore;
  const overallCompleteness = 
    pronunciationAssessmentObj.CompletenessScore ?? 
    pronunciationAssessmentObj.completenessScore ??
    bestHypothesis.CompletenessScore ?? 
    bestHypothesis.completenessScore;
  const overallProsody = 
    pronunciationAssessmentObj.ProsodyScore ?? 
    pronunciationAssessmentObj.prosodyScore ??
    bestHypothesis.ProsodyScore ?? 
    bestHypothesis.prosodyScore;
  const overallPronScore = 
    pronunciationAssessmentObj.PronScore ?? 
    pronunciationAssessmentObj.pronScore ??
    bestHypothesis.PronScore ?? 
    bestHypothesis.pronScore;

  // Debug logging in development to diagnose missing ProsodyScore
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && overallProsody === undefined) {
    console.warn('[azurePronunciationNormalizer] ProsodyScore not found in Azure response:', {
      'pronunciationAssessmentObj keys': Object.keys(pronunciationAssessmentObj),
      'bestHypothesis keys': Object.keys(bestHypothesis),
      'pronunciationAssessmentObj.ProsodyScore': pronunciationAssessmentObj.ProsodyScore,
      'pronunciationAssessmentObj.prosodyScore': pronunciationAssessmentObj.prosodyScore,
      'bestHypothesis.ProsodyScore': bestHypothesis.ProsodyScore,
      'bestHypothesis.prosodyScore': bestHypothesis.prosodyScore,
      'bestHypothesis.PronScore': bestHypothesis.PronScore,
      'bestHypothesis.AccuracyScore': bestHypothesis.AccuracyScore,
      'bestHypothesis.FluencyScore': bestHypothesis.FluencyScore,
      'bestHypothesis.CompletenessScore': bestHypothesis.CompletenessScore,
    });
  }
  
  // Extract word-level scores
  const words = bestHypothesis.Words || bestHypothesis.words || [];
  const normalizedWords = words.map((wordItem: any) => {
    const wordText = wordItem.Word || wordItem.word || '';
    const wordAssessment = wordItem.PronunciationAssessment || wordItem.pronunciationAssessment || {};
    
    const wordAccuracy = 
      wordAssessment.AccuracyScore ?? 
      wordAssessment.accuracyScore ??
      wordItem.AccuracyScore ?? 
      wordItem.accuracyScore ?? 
      0;
    
    const errorType = 
      wordAssessment.ErrorType ?? 
      wordAssessment.errorType ??
      wordItem.ErrorType ?? 
      wordItem.errorType;
    
    return {
      word: wordText,
      pronunciationAssessment: {
        accuracyScore: wordAccuracy,
        ...(errorType ? { errorType } : {}),
      },
    };
  });
  
  return {
    recognitionStatus,
    bestHypothesis: {
      pronunciationAssessment: {
        accuracyScore: overallAccuracy,
        ...(overallFluency !== undefined ? { fluencyScore: overallFluency } : {}),
        ...(overallCompleteness !== undefined ? { completenessScore: overallCompleteness } : {}),
        ...(overallProsody !== undefined ? { prosodyScore: overallProsody } : {}),
        ...(overallPronScore !== undefined ? { pronScore: overallPronScore } : {}),
      },
      words: normalizedWords,
    },
  };
}

