/**
 * Pronunciation Fixture Adapter
 * 
 * Converts PronunciationFixture data into practice-ready format for UI components.
 * This adapter provides a convenient bridge between test fixtures and the practice UI.
 */

import { PRONUNCIATION_FIXTURES, getFixtureById, getFixturesByDifficulty } from '@/mock/pronunciationFixtures';
import type { PronunciationFixture, WordFeedback, AudioVariant, WordAudioVariant, PhonemeFeedback } from '@/types/pronunciationFixtures';
import type { AttemptScore } from '@/types/pronunciation';
import { loadAllSentences } from './data';
import type { Sentence } from './types';

// Cache for sentences data
let cachedSentences: Sentence[] | null = null;

/**
 * Normalizes Portuguese text for matching by:
 * - Trimming whitespace
 * - Normalizing multiple spaces to single space
 * - Removing punctuation
 * - Converting to lowercase
 */
function normalizePortugueseText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:]/g, '')
    .toLowerCase();
}

/**
 * Finds a matching sentence from sentences.json by comparing Portuguese text.
 * Uses normalized text comparison as fallback if no ID match is found.
 * 
 * @param fixtureText - The Portuguese text from the fixture
 * @returns The matching sentence if found, null otherwise
 */
async function findMatchingSentence(fixtureText: string): Promise<Sentence | null> {
  if (!cachedSentences) {
    try {
      cachedSentences = await loadAllSentences();
    } catch (error) {
      console.warn('Failed to load sentences for native audio matching:', error);
      return null;
    }
  }

  const normalizedFixture = normalizePortugueseText(fixtureText);

  // Try to find exact match (normalized)
  for (const sentence of cachedSentences) {
    const normalizedSentence = normalizePortugueseText(sentence.textPt);
    if (normalizedSentence === normalizedFixture) {
      return sentence;
    }
  }

  return null;
}

/**
 * Gets native audio URL for a sentence.
 * Uses female voice by default (can be made configurable later).
 * 
 * @param sentence - The matched sentence
 * @returns The native audio URL, or null if not available
 */
function getNativeAudioUrl(sentence: Sentence | null): string | null {
  if (!sentence) {
    return null;
  }

  // Prefer female audio, fallback to male
  const audioUrl = sentence.audioFemaleUrl || sentence.audioMaleUrl;
  return audioUrl || null;
}

/**
 * Practice-ready phrase data derived from a pronunciation fixture.
 * This format is optimized for use in practice UI components.
 */
export type PracticePhraseFromFixture = {
  id: string;              // e.g. "phrase_1"
  text: string;            // Portuguese phrase text
  difficulty: number;
  audioUrl: string;        // URL to use in <audio src=...>
  attempt: AttemptScore;   // single "fixture attempt" containing overall scores
  sentenceAudio: AudioVariant[];      // [native, user]
  wordAudios?: WordAudioVariant[];    // optional for now
  words?: WordFeedback[];  // word-level feedback for UI display
};

/**
 * Maps a numeric score to a word feedback level.
 * 
 * @param score - The score (0-100)
 * @returns The corresponding level
 */
function mapScoreToLevel(score: number): WordFeedback['level'] {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'ok';
  return 'practice';
}

/**
 * Loads and parses an Azure JSON file to extract phoneme data.
 * 
 * @param azureJsonFile - Path to the Azure JSON file
 * @returns Parsed Azure JSON data or null if loading fails
 */
async function loadAzureJson(azureJsonFile: string): Promise<any | null> {
  try {
    // Ensure path starts with / for browser fetch
    const url = azureJsonFile.startsWith('/') ? azureJsonFile : `/${azureJsonFile}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn(`[PronunciationFixtureAdapter] Failed to load Azure JSON: ${azureJsonFile}`);
      }
      return null;
    }
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data; // Azure JSON is often wrapped in an array
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[PronunciationFixtureAdapter] Error loading Azure JSON ${azureJsonFile}:`, error);
    }
    return null;
  }
}

/**
 * Maps Azure phoneme data to PhonemeFeedback format.
 * 
 * @param azurePhoneme - Azure phoneme object from JSON
 * @param wordText - The word text for context
 * @returns PhonemeFeedback object
 */
function mapAzurePhonemeToPhonemeFeedback(
  azurePhoneme: any,
  wordText: string
): PhonemeFeedback {
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
    exampleWord: wordText,
    tip,
    isProblem,
  };
}

/**
 * Extracts phoneme data from Azure JSON for a specific word.
 * 
 * @param azureJson - Parsed Azure JSON data
 * @param wordIndex - Index of the word in the phrase
 * @param wordText - The word text to match
 * @returns Array of PhonemeFeedback or undefined if no data available
 */
function extractPhonemesFromAzureJson(
  azureJson: any,
  wordIndex: number,
  wordText: string
): PhonemeFeedback[] | undefined {
  const bestHypothesis = azureJson?.NBest?.[0];
  const words = bestHypothesis?.Words || [];
  
  // Find the word by index or by text match
  const wordData = words[wordIndex] || words.find((w: any) => 
    w.Word?.toLowerCase() === wordText.toLowerCase()
  );
  
  if (!wordData) {
    return undefined;
  }
  
  const phonemes = wordData.Phonemes;
  if (!phonemes || !Array.isArray(phonemes) || phonemes.length === 0) {
    return undefined;
  }
  
  // Map Azure phonemes to PhonemeFeedback
  return phonemes.map((phoneme: any) => 
    mapAzurePhonemeToPhonemeFeedback(phoneme, wordText)
  );
}

/**
 * Generates word-level feedback from phrase text and overall score.
 * Attempts to load real phoneme data from Azure JSON when available.
 * 
 * @param text - The phrase text
 * @param overallScore - The overall pronunciation score
 * @param azureJsonFile - Path to Azure JSON file (optional)
 * @returns Array of word feedback objects
 */
async function generateWordFeedback(
  text: string,
  overallScore: number,
  azureJsonFile?: string
): Promise<WordFeedback[]> {
  // Split text into words, removing punctuation
  const words = text.split(/\s+/).map(w => w.replace(/[.,!?;:]/g, '')).filter(w => w.length > 0);
  
  // Load Azure JSON if available
  let azureJson: any | null = null;
  if (azureJsonFile) {
    azureJson = await loadAzureJson(azureJsonFile);
  }
  
  return words.map((word, index) => {
    // Generate score around overall score with small random jitter (±10 points)
    // This is still synthetic since we don't have per-word scores in fixtures
    const jitter = (Math.random() - 0.5) * 20;
    const wordScore = Math.max(0, Math.min(100, overallScore + jitter));
    const level = mapScoreToLevel(wordScore);
    
    // Occasionally add error types for lower scores
    let errorType: string | undefined;
    if (wordScore < 70 && Math.random() < 0.3) {
      const errorTypes = ['mispronounced', 'omitted', 'extra'];
      errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    }
    
    const wordFeedback: WordFeedback = {
      index,
      text: word,
      score: Math.round(wordScore),
      level,
      errorType,
    };
    
    // Extract real phoneme data from Azure JSON if available
    if (azureJson) {
      const phonemes = extractPhonemesFromAzureJson(azureJson, index, word);
      if (phonemes && phonemes.length > 0) {
        wordFeedback.phonemes = phonemes;
      }
      // If no phonemes found, leave undefined (don't generate synthetic ones)
    }
    
    return wordFeedback;
  });
}

/**
 * Converts a PronunciationFixture to a PracticePhraseFromFixture.
 * 
 * @param fixture - The pronunciation fixture to convert
 * @returns A practice-ready phrase object
 */
export async function fixtureToPracticePhrase(fixture: PronunciationFixture): Promise<PracticePhraseFromFixture> {
  // Build audioUrl by ensuring it's a browser-usable path
  let audioUrl = fixture.audioFile;
  if (audioUrl.startsWith('data/')) {
    audioUrl = '/' + audioUrl;
  }

  // Create AttemptScore object from fixture scores
  const attempt: AttemptScore = {
    attemptId: fixture.id + '_fixture',
    sentenceId: fixture.id,
    overallAccuracy: fixture.scores.overall,
    fluency: fixture.scores.fluency ?? 0,
    completeness: fixture.scores.completeness ?? 0,
    prosody: fixture.scores.prosody ?? undefined,
    wordScores: [], // for now, leave empty; we're using fixtures mainly for overall UI
    createdAt: new Date().toISOString(),
    audioUrl,
  };

  // Generate word-level feedback with real phoneme data from Azure JSON if available
  const words = await generateWordFeedback(
    fixture.text,
    fixture.scores.overall,
    fixture.azureJsonFile
  );

  // Find matching sentence for native audio
  const matchingSentence = await findMatchingSentence(fixture.text);
  const nativeAudioUrl = getNativeAudioUrl(matchingSentence);

  // Build sentenceAudio with native and user variants
  const sentenceAudio: AudioVariant[] = [];
  
  // Add native audio if found
  if (nativeAudioUrl) {
    sentenceAudio.push({
      type: 'native',
      url: nativeAudioUrl,
    });
  } else {
    // Log warning in dev mode
    if (import.meta.env.DEV) {
      console.warn(
        `[PronunciationFixtureAdapter] No matching sentence found for fixture "${fixture.id}" with text "${fixture.text}". Native audio will not be available.`
      );
    }
  }
  
  // Always add user audio
  sentenceAudio.push({
    type: 'user',
    url: audioUrl, // existing fixture audio path
  });

  // Build wordAudios (optional, for future use)
  // Create both native and user variants for each word
  const wordAudios: WordAudioVariant[] = words.flatMap((_word, index) => [
    {
      type: 'native',
      wordIndex: index,
      url: `/audio/fixtures/native/${fixture.id}_word_${index}.wav`,
    },
    {
      type: 'user',
      wordIndex: index,
      url: `/audio/fixtures/user/${fixture.id}_word_${index}.wav`,
    },
  ]);

  return {
    id: fixture.id,
    text: fixture.text,
    difficulty: fixture.difficulty,
    audioUrl,
    attempt,
    sentenceAudio,
    wordAudios,
    words,
  };
}

/**
 * Gets all practice phrases from fixtures.
 * 
 * @returns Array of all practice phrases converted from fixtures
 */
export async function getAllPracticePhrasesFromFixtures(): Promise<PracticePhraseFromFixture[]> {
  return Promise.all(PRONUNCIATION_FIXTURES.map(fixtureToPracticePhrase));
}

/**
 * Gets practice phrases filtered by difficulty level.
 * 
 * @param difficulty - The difficulty level to filter by
 * @returns Array of practice phrases with the specified difficulty
 */
export async function getPracticePhrasesByDifficulty(difficulty: number): Promise<PracticePhraseFromFixture[]> {
  const fixtures = getFixturesByDifficulty(difficulty);
  return Promise.all(fixtures.map(fixtureToPracticePhrase));
}

/**
 * Gets a practice phrase by its ID.
 * 
 * @param id - The phrase ID (e.g. "phrase_1")
 * @returns The practice phrase if found, undefined otherwise
 */
export async function getPracticePhraseById(id: string): Promise<PracticePhraseFromFixture | undefined> {
  const fixture = getFixtureById(id);
  return fixture ? fixtureToPracticePhrase(fixture) : undefined;
}

