export type CategoryId = string;

export type WordId = string;

export type SentenceId = string;

/**
 * A topic grouping for words and sentences.
 * Examples: "Foods", "Travel", "Family & Friends".
 */
export interface Category {
  id: CategoryId;        // e.g. "foods", "travel"
  name: string;          // Human-readable name
  description?: string;
  sortOrder?: number;    // For ordering in the UI
}

/**
 * A single Portuguese vocabulary word.
 */
export interface Word {
  id: WordId;              // e.g. "word_001"
  textPt: string;          // "pão"
  translationEn: string;   // "bread"
  categories: CategoryId[]; // e.g. ["foods"]
  difficulty: 1 | 2 | 3 | 4 | 5;
  trickyFeature?: string;  // "nasal ão", "rr", "lh", etc.
  notes?: string;          // Any extra tips for me
}

/**
 * A full sentence used for pronunciation practice.
 */
export interface Sentence {
  id: SentenceId;          // e.g. "sent_001"
  textPt: string;          // "Eu gosto de pão com queijo."
  translationEn?: string;  // "I like bread with cheese."
  difficulty: 1 | 2 | 3 | 4 | 5;
  categories: CategoryId[]; // e.g. ["foods"]
  tags?: string[];         // ["nasal", "present-tense"]
  wordIds?: WordId[];      // Optional linkage to Word entries
}

