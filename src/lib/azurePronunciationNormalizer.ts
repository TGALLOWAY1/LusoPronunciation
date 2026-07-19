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
      /**
       * Per-phoneme scores as returned by Azure when the assessment is requested
       * with `Granularity: 'Phoneme'`. Present only when Azure returns a
       * `Phonemes` array for the word; omitted entirely otherwise (older cached
       * attempts, word-granularity responses, unexpected shapes).
       *
       * `label` is null when Azure omits the phoneme name — Microsoft documents
       * that phoneme NAMES are only guaranteed for en-US / zh-CN, so pt-BR may
       * return scores without names. The SCORE is always preserved either way.
       */
      phonemes?: Array<{
        label: string | null;
        accuracyScore: number;
        offset?: number;
        duration?: number;
      }>;
    }>;
  };
}

/**
 * Parses an optional Azure `Phonemes` array on a word. Handles both observed
 * shapes defensively:
 *   - flattened: { Phoneme?, AccuracyScore?, Offset?, Duration? }
 *   - nested:    { Phoneme?, PronunciationAssessment?: { AccuracyScore }, Offset?, Duration? }
 *
 * Returns undefined when there is no usable phoneme array so callers can cleanly
 * fall back to word-level-only rendering.
 */
function normalizePhonemes(
  wordItem: any
): NormalizedAzurePronunciationResult['bestHypothesis']['words'][number]['phonemes'] {
  const rawPhonemes = wordItem?.Phonemes ?? wordItem?.phonemes;
  if (!Array.isArray(rawPhonemes) || rawPhonemes.length === 0) {
    return undefined;
  }

  const parsed = rawPhonemes.map((entry: any) => {
    const rawLabel = entry?.Phoneme ?? entry?.phoneme;
    const label =
      typeof rawLabel === 'string' && rawLabel.trim() !== '' ? rawLabel : null;

    const nestedAssessment = entry?.PronunciationAssessment ?? entry?.pronunciationAssessment;
    const accuracyScore =
      nestedAssessment?.AccuracyScore ??
      nestedAssessment?.accuracyScore ??
      entry?.AccuracyScore ??
      entry?.accuracyScore ??
      0;

    const offset = entry?.Offset ?? entry?.offset;
    const duration = entry?.Duration ?? entry?.duration;

    return {
      label,
      accuracyScore,
      ...(typeof offset === 'number' ? { offset } : {}),
      ...(typeof duration === 'number' ? { duration } : {}),
    };
  });

  return parsed;
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
    
    const phonemes = normalizePhonemes(wordItem);

    return {
      word: wordText,
      pronunciationAssessment: {
        accuracyScore: wordAccuracy,
        ...(errorType ? { errorType } : {}),
      },
      ...(phonemes ? { phonemes } : {}),
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

