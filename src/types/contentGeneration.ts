/**
 * Types for the content generation pipeline.
 * 
 * These types represent the data structures used throughout the generation
 * process, from raw input data to final master records that feed into
 * the existing audio index and content types.
 */

import type { AudioIndexEntry } from '../lib/types';

/**
 * Raw word input data before processing.
 * This represents the initial data source (e.g., from a CSV, JSON, or API).
 */
export interface RawWordInput {
  pt: string;
  english: string;
  frequencyRank?: number;
  partOfSpeech?: string;
  category?: string;
}

/**
 * Raw sentence input data before processing.
 * This represents the initial data source (e.g., from a CSV, JSON, or API).
 */
export interface RawSentenceInput {
  pt: string;
  english: string;
  frequencyRank?: number;
  category?: string;
}

/**
 * Master word record after full processing.
 * This is the canonical word structure that feeds into the app's content types
 * and audio index.
 */
export interface MasterWord {
  id: string;
  text: string;              // PT-BR
  forms?: string[];
  englishGloss: string;
  partOfSpeech: string;
  frequencyRank?: number;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1";
  category: string;
  isHardForEnglishSpeakers: boolean;
  ipa?: string;
  phonemes?: string[];       // keys into phoneme_metadata
}

/**
 * Reference to a word within a sentence.
 * Used to link sentences to their constituent words.
 */
export interface WordRef {
  wordId: string;
  tokenIndex: number;
  startChar: number;
  endChar: number;
}

/**
 * Master sentence record after full processing.
 * This is the canonical sentence structure that feeds into the app's content types
 * and audio index.
 */
export interface MasterSentence {
  id: string;
  text: string;              // PT-BR
  englishTranslation: string;
  frequencyRank?: number;
  difficulty: "A1" | "A2" | "B1" | "B2" | "C1";
  category: string;
  tags: string[];
  wordRefs: WordRef[];
}

/**
 * TTS job specification for generating audio files.
 * Represents a single audio generation task.
 */
export interface TTSJob {
  id: string;
  itemType: "word" | "sentence";
  text: string;
  voice: string;
  gender: "male" | "female";
  outputPath: string;        // public/audio/ptbr/{gender}/{id}.wav
}

// ============================================================================
// Generation Configuration Types
// ============================================================================

/**
 * Voice configuration for TTS generation.
 * Describes a voice with its Azure voice name and gender.
 */
export interface GenerationConfigVoice {
  id: string;                    // e.g., "ptbr_male", "ptbr_female"
  azureVoiceName: string;        // e.g., "pt-BR-AntonioNeural"
  gender: "male" | "female";
}

/**
 * Paths configuration for the generation pipeline.
 * Defines all input/output paths for words, sentences, audio, and indices.
 */
export interface GenerationPathsConfig {
  rawWordsJsonPath: string;      // e.g., "STATIC DATA/words.json"
  rawSentencesJsonPath: string | string[];   // e.g., "data/sentences.json" or ["data/sentences.json", "data/sentence_expansions/phase5_batch_01.json"]
  masterWordsPath: string;        // e.g., "data/masterWords.json"
  masterSentencesPath: string;    // e.g., "data/masterSentences.json"
  audioBaseDir: string;           // e.g., "public/audio"
  audioIndexPath: string;         // e.g., "data/audio_index.json"
  testDataBaseDir: string;        // e.g., "data/test_data"
}

// ============================================================================
// Enriched Content Types (Canonical Records)
// ============================================================================

/**
 * Canonical word record with all enrichment data.
 * This is the enriched word structure used throughout the generation pipeline.
 * 
 * Includes all fields needed by the UI to avoid data loss when switching from legacy to pipeline data.
 */
export interface EnrichedWord {
  id: string;
  text: string;                   // Portuguese text (pt)
  normalizedText: string;            // Normalized version for matching
  forms?: string[];                  // Alternate surface forms used in sentences
  en: string;                        // English translation (required for UI)
  baseForm?: string;                 // Optional base/infinitive form
  category: string;                  // Category ID
  partOfSpeech: string;              // Part of speech
  difficulty: 2 | 3 | 4;    // Difficulty level (1-5 scale, required for UI)
  difficultForEnglish: boolean;      // Whether this word is difficult for English speakers
  pronunciationNotes?: string;       // Pronunciation guidance notes (optional)
  englishDifficultyFlag?: boolean;   // Alias for difficultForEnglish (kept for backward compatibility)
  phonemes: string[];                // ARPABET or similar phoneme codes
  ipa?: string;                      // IPA representation
  tags?: string[];                   // Additional tags
  cefr?: string;                     // CEFR level (A1, A2, B1, B2, C1, C2)
  difficultyScore?: number;          // Numeric difficulty score (0-100, optional)
}

/**
 * Canonical sentence record with all enrichment data.
 * This is the enriched sentence structure used throughout the generation pipeline.
 * 
 * Includes all fields needed by the UI to avoid data loss when switching from legacy to pipeline data.
 */
export interface EnrichedSentence {
  id: string;
  text: string;                    // Portuguese text (pt)
  normalizedText: string;          // Normalized version for matching
  en: string;                      // English translation (required for UI)
  category: string;                 // Category ID
  difficulty: 2 | 3 | 4;   // Difficulty level (1-5 scale, required for UI)
  pronunciationNotes?: string;     // Pronunciation guidance notes (optional)
  tags?: string[];                 // Additional tags
  hardForEnglish?: boolean;        // Whether this sentence is hard for English speakers
  wordRefs?: {                     // References to words in this sentence
    wordId: string;
    tokenIndex: number;
  }[];
  cefr?: string;                   // CEFR level (A1, A2, B1, B2, C1, C2)
  difficultyScore?: number;        // Numeric difficulty score (0-100, optional)
}

// ============================================================================
// Audio Variant Types
// ============================================================================

/**
 * Describes a specific audio variant for a word or sentence.
 * Represents a single audio file with its voice and path.
 */
export interface TTSAudioVariant {
  itemId: string;                 // ID of the word or sentence
  itemType: "word" | "sentence";
  voiceName: string;              // Azure voice name
  gender: "male" | "female";
  filePath: string;               // Relative path to public/ (e.g., "audio/ptbr/male/word_001.wav")
}

/**
 * Extended audio index entry that aligns with AudioIndexEntry
 * but is suitable for both words and sentences with optional metadata.
 */
export interface AudioIndexEntryExtended extends AudioIndexEntry {
  id: string;                     // Item ID (word or sentence)
  type: "word" | "sentence";
  voice: string;                  // Voice identifier (e.g., "ptbr_male")
  path: string;                   // Physical file path (e.g., "public/audio/words/ptbr_male/word_001.wav")
  text: string;                   // Portuguese text
  voices?: Record<string, string>; // Canonical URLs per voice (e.g., { "ptbr_male": "/audio/words/ptbr_male/word_001.wav" })
  metadata?: {                    // Optional additional metadata
    [key: string]: unknown;
  };
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation report for generated data.
 * Used to track validation results including counts and missing items.
 */
export interface ValidationReport {
  wordCount: number;
  sentenceCount: number;
  audioVariantCount: number;
  missingAudioIds: string[];     // IDs of items missing audio files
  missingPhonemeIds: string[];    // Phoneme IDs not found in phoneme_metadata
  invalidWordRefs: string[];      // Sentence IDs with invalid word references
  otherErrors?: string[];         // Other validation errors
}
