/**
 * Types for the content generation pipeline.
 * 
 * These types represent the data structures used throughout the generation
 * process, from raw input data to final master records that feed into
 * the existing audio index and content types.
 * 
 * TODO: Future integration - When generating audio index entries, we'll need
 * to import and use `AudioIndexEntry` from `src/lib/types.ts` to ensure
 * compatibility with the existing audio index structure.
 */

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

