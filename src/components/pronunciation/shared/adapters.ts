/**
 * Shared adapter functions for converting pronunciation data to normalized formats.
 * 
 * These adapters are used by both:
 * - Dev pronunciation fixtures page
 * - Practice Sentences page
 */

import type { WordFeedback } from '@/types/pronunciationFixtures';
import type { WordScore } from '@/types/pronunciation';
import type { Sentence } from '@/lib/types';
import type { NormalizedWordFeedback, NormalizedWordAudioVariant } from './types';
import { getAudioUrlForWordSync } from '@/utils/audioRouting';

/**
 * Normalizes word text for matching (removes punctuation, lowercase).
 */
function normalizeWordToken(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:]/g, '')
    .trim();
}

/**
 * Maps Azure phoneme data to normalized phoneme format.
 */
function mapAzurePhonemeToNormalized(
  azurePhoneme: any
): NonNullable<NormalizedWordFeedback['phonemes']>[number] {
  const symbol = azurePhoneme.Phoneme || '';
  const score = azurePhoneme.PronunciationAssessment?.AccuracyScore ?? 0;
  const isProblem = score < 80;
  
  let tip: string | undefined;
  if (isProblem) {
    const tips = [
      `Focus on the ${symbol} sound - try to make it clearer`,
      `The ${symbol} sound needs more precision`,
      `Practice the ${symbol} sound more slowly`,
    ];
    tip = tips[Math.floor(Math.random() * tips.length)];
  }
  
  return {
    symbol,
    score: Math.round(score),
    tip,
    isProblem,
  };
}

/**
 * Extracts phoneme data from Azure JSON response for a specific word.
 * 
 * @param rawAzure - The raw Azure pronunciation assessment response
 * @param wordIndex - Index of the word in the sentence
 * @param wordText - The word text to match
 * @returns Array of normalized phonemes or undefined if no data available
 */
function extractPhonemesFromAzureResponse(
  rawAzure: any,
  wordIndex: number,
  wordText: string
): NormalizedWordFeedback['phonemes'] | undefined {
  const bestHypothesis = rawAzure?.NBest?.[0];
  const words = bestHypothesis?.Words || [];
  
  // Normalize word text for matching
  const normalizedWordText = normalizeWordToken(wordText);
  
  // First, try to find by exact text match (case-insensitive, punctuation-agnostic)
  let wordData = words.find((w: any) => {
    const azureWord = w.Word || '';
    const normalizedAzureWord = normalizeWordToken(azureWord);
    return normalizedAzureWord === normalizedWordText;
  });
  
  // If no text match found, fall back to index matching
  if (!wordData && wordIndex < words.length) {
    wordData = words[wordIndex];
    // Verify the word at this index matches
    const azureWord = wordData?.Word || '';
    const normalizedAzureWord = normalizeWordToken(azureWord);
    if (normalizedAzureWord !== normalizedWordText) {
      // Index doesn't match, don't use it
      wordData = undefined;
    }
  }
  
  if (!wordData) {
    return undefined;
  }
  
  const phonemes = wordData.Phonemes;
  if (!phonemes || !Array.isArray(phonemes) || phonemes.length === 0) {
    return undefined;
  }
  
  // Map Azure phonemes to normalized format
  return phonemes.map((phoneme: any) => 
    mapAzurePhonemeToNormalized(phoneme)
  );
}

/**
 * Converts WordFeedback (from pronunciationFixtures) to NormalizedWordFeedback.
 */
export function adaptFixtureWordsToNormalized(word: WordFeedback): NormalizedWordFeedback {
  return {
    id: word.wordId || `word_${word.index}`,
    text: word.text,
    accuracyScore: word.score,
    errorType: word.errorType || null,
    phonemes: word.phonemes,
    wordId: word.wordId,
    index: word.index,
    level: word.level,
    score: word.score,
  };
}

/**
 * Converts an array of WordScores to NormalizedWordFeedback array.
 * Extracts phonemes from Azure raw response if available.
 * 
 * @param wordScores - Array of WordScore from pronunciation assessment
 * @param rawAzure - Optional raw Azure response for phoneme extraction
 * @param startIndex - Starting index for word numbering (default: 0)
 * @returns Array of NormalizedWordFeedback
 */
export function adaptWordScoresToNormalized(
  wordScores: WordScore[] | undefined,
  rawAzure?: any,
  startIndex: number = 0
): NormalizedWordFeedback[] {
  if (!wordScores || wordScores.length === 0) {
    return [];
  }

  return wordScores.map((wordScore, idx) => {
    const index = startIndex + idx;
    const score = wordScore.accuracy;
    const level: NormalizedWordFeedback['level'] = 
      score >= 90 ? 'excellent' :
      score >= 80 ? 'good' :
      score >= 70 ? 'ok' : 'practice';

    // Extract phonemes from Azure response if available
    let phonemes: NormalizedWordFeedback['phonemes'] | undefined;
    if (rawAzure) {
      phonemes = extractPhonemesFromAzureResponse(rawAzure, index, wordScore.word);
    }

    return {
      id: `word_${index}`,
      text: wordScore.word,
      accuracyScore: score,
      errorType: wordScore.errorType || null,
      phonemes,
      index,
      level,
      score,
    };
  });
}

/**
 * Builds normalized word audio variants for a sentence.
 * Uses sentence.wordRefs to find word IDs and builds audio URLs.
 * 
 * For now, only supports native word audio (no user variants).
 * 
 * @param sentence - The sentence with wordRefs
 * @param voice - Voice type to use ('male' or 'female', default: 'male')
 * @returns Array of NormalizedWordAudioVariant, or empty array if no wordRefs
 */
export function buildWordAudioVariantsForSentence(
  sentence: Sentence,
  voice: 'male' | 'female' = 'male'
): NormalizedWordAudioVariant[] {
  if (!sentence.wordRefs || sentence.wordRefs.length === 0) {
    return [];
  }

  const variants: NormalizedWordAudioVariant[] = [];
  
  for (const wordRef of sentence.wordRefs) {
    const audioUrl = getAudioUrlForWordSync(wordRef.wordId, voice);
    if (audioUrl) {
      variants.push({
        type: 'native' as const,
        url: audioUrl,
        wordIndex: wordRef.tokenIndex,
        // startTimeMs and endTimeMs not available from sentence data
        // Could be added if sentence audio has word-level timing data
      });
    }
  }
  
  return variants;
}

