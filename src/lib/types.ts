/**
 * TypeScript types matching the actual JSON schema from STATIC DATA files.
 * These types represent the raw data structure before transformation.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

/**
 * Raw sentence structure from sentences.json
 */
export interface RawSentence {
  id: string;                    // e.g., "food_001"
  en: string;                     // English translation
  pt: string;                     // Portuguese text
  difficulty: Difficulty;
  pronunciation_notes?: string;
}

/**
 * Raw word structure from words.json
 */
export interface RawWord {
  id: string;                     // e.g., "food_word_001"
  pt: string;                      // Portuguese text
  en: string;                     // English translation
  pos: string;                    // Part of speech (noun, verb, etc.)
  difficulty: Difficulty;
  difficult_for_english: boolean;
  pronunciation_notes?: string;
}

/**
 * Raw category structure from sentences.json or words.json
 */
export interface RawCategory {
  id: string;                     // e.g., "food", "travel"
  label_en: string;              // English label
  label_pt: string;              // Portuguese label
  sentences?: RawSentence[];     // For sentences.json
  words?: RawWord[];             // For words.json
}

/**
 * Root structure of sentences.json
 */
export interface SentencesData {
  language_pair: string;
  version: string;
  categories: RawCategory[];
}

/**
 * Root structure of words.json
 */
export interface WordsData {
  language_pair: string;
  version: string;
  categories: RawCategory[];
}

/**
 * Audio index entry structure from audio_index.json
 */
export interface AudioIndexEntry {
  type: 'sentence' | 'word';
  sourceId: string;
  textPt: string;
  textEn: string;
  ptbr: {
    male: string;                 // Path like "audio/ptbr/male/food_001.wav"
    female: string;               // Path like "audio/ptbr/female/food_001.wav"
  };
}

/**
 * Audio index structure (keyed by audioId)
 */
export interface AudioIndex {
  [audioId: string]: AudioIndexEntry;
}

/**
 * Transformed sentence with audio URLs and category info
 */
export interface Sentence {
  id: string;
  textPt: string;
  translationEn: string;
  difficulty: Difficulty;
  categoryId: string;
  categoryLabelEn: string;
  categoryLabelPt: string;
  pronunciationNotes?: string;
  audioMaleUrl?: string;
  audioFemaleUrl?: string;
  audioId?: string;              // ID used to look up in audio_index.json
}

/**
 * Transformed word with audio URLs and category info
 */
export interface Word {
  id: string;
  textPt: string;
  translationEn: string;
  partOfSpeech: string;
  difficulty: Difficulty;
  difficultForEnglish: boolean;
  categoryId: string;
  categoryLabelEn: string;
  categoryLabelPt: string;
  pronunciationNotes?: string;
  audioMaleUrl?: string;
  audioFemaleUrl?: string;
  audioId?: string;               // ID used to look up in audio_index.json
}

/**
 * Category information
 */
export interface Category {
  id: string;
  labelEn: string;
  labelPt: string;
}

