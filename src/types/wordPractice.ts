/**
 * Synthetic word-level practice dataset types.
 * 
 * This dataset combines:
 * - Sentence text and metadata from sentences.json
 * - Word difficulty and dictionary entries from words.json
 * - Azure pronunciation assessment data from phrase_*_JSON.json files
 */

export interface SyntheticWordPracticeEntry {
  id: string;                  // "<phraseId>-w<index>"
  phraseId: string;            // e.g. "phrase_1"
  sentenceTextPt: string;
  sentenceTextEn?: string;

  wordIndex: number;
  wordText: string;
  normalizedWordText: string;

  wordsJsonId?: string;
  difficulty?: number;

  startTimeMs?: number;
  endTimeMs?: number;

  overallScore?: number;
  accuracyScore?: number;
  errorType?: string;
}

export type SyntheticWordPracticeDataset = SyntheticWordPracticeEntry[];

