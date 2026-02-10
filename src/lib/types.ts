/**
 * TypeScript types matching the actual JSON schema from STATIC DATA files.
 * These types represent the raw data structure before transformation.
 */

export type Difficulty = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Practice Logging and Progress Analytics Types
// ============================================================================

/**
 * Basic ID type aliases for practice logging
 */
export type SentenceId = string;
export type WordId = string;
export type PhonemeId = string;
export type DifficultyLevel = Difficulty; // Alias for 1 | 2 | 3 | 4 | 5
export type ContentCategory = string; // Category ID (e.g., "food", "travel")

/**
 * Raw sentence structure from sentences.json
 */
export interface RawSentence {
  id: string;                    // e.g., "food_001"
  en: string;                     // English translation
  pt: string;                     // Portuguese text
  categoryId?: string;            // Source category ID (e.g., "food")
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
  categoryId?: string;            // Source category ID (e.g., "food")
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
 * 
 * Canonical path scheme:
 * - Sentences: /audio/sentences/<voiceId>/<id>.wav
 * - Words: /audio/words/<voiceId>/<id>.wav
 * 
 * The `ptbr` field maintains backward compatibility with legacy paths.
 * The `voices` field provides canonical URLs per voice.
 */
export interface AudioIndexEntry {
  type: 'sentence' | 'word';
  sourceId: string;
  textPt: string;
  textEn: string;
  ptbr: {
    male: string;                 // Legacy path (e.g., "audio/ptbr/male/food_001.wav")
    female: string;               // Legacy path (e.g., "audio/ptbr/female/food_001.wav")
  };
  // Canonical voice URLs (new format)
  voices?: {
    [voiceId: string]: string;    // Canonical URL (e.g., "/audio/sentences/ptbr_male/food_001.wav")
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
  // Enriched fields (optional, from master datasets)
  phonemes?: string[];            // ARPABET or similar phoneme codes
  ipa?: string;                  // IPA representation
  tags?: string[];               // Additional tags
  difficultyScore?: number;      // Numeric difficulty score
  cefr?: string;                 // CEFR level (A1, A2, B1, B2, C1, C2)
  wordRefs?: {                   // References to words in this sentence
    wordId: string;
    tokenIndex: number;
  }[];
  hardForEnglish?: boolean;       // Whether this sentence is hard for English speakers
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
  // Enriched fields (optional, from master datasets)
  phonemes?: string[];            // ARPABET or similar phoneme codes
  ipa?: string;                  // IPA representation
  tags?: string[];               // Additional tags
  difficultyScore?: number;       // Numeric difficulty score
  cefr?: string;                 // CEFR level (A1, A2, B1, B2, C1, C2)
}

/**
 * Category information
 */
export interface Category {
  id: string;
  labelEn: string;
  labelPt: string;
}

// ============================================================================
// Practice Logging and Progress Analytics Types
// ============================================================================

// Re-export shared types for use in new code
export type {
  PronunciationAttempt,
  PracticeContentRef,
  ContentType,
  PracticeSessionMode,
} from '../shared/types';

/**
 * A practice session represents a continuous period of practice activity.
 * 
 * Note: For new backend code, consider using the shared PracticeSession type
 * from '../shared/types' which has a cleaner structure (id instead of sessionId,
 * optional endedAt, etc.). This interface is maintained for backward compatibility
 * with existing frontend code.
 */
export interface PracticeSession {
  sessionId: string;
  userId: string;
  startedAt: string; // ISO timestamp
  endedAt: string; // ISO timestamp
  durationSeconds: number;
  mode: "sentences" | "words" | "mixed" | "assessment";
  device?: "desktop" | "mobile";
  appVersion?: string;
  totalAttempts: number;
  sentenceAttempts: number;
  wordAttempts: number;
  avgOverallScore?: number;
  avgFluencyScore?: number;
  avgAccuracyScore?: number;
  avgCompletenessScore?: number;
  avgProsodyScore?: number;
  dailyStreakAfterSession?: number;
}

/**
 * A single attempt at practicing a sentence.
 */
export interface SentencePracticeAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  sentenceId: SentenceId;
  difficulty: DifficultyLevel;
  category: ContentCategory;
  createdAt: string; // ISO timestamp
  overallScore: number; // 0-100
  accuracyScore: number; // 0-100
  fluencyScore: number; // 0-100
  completenessScore: number; // 0-100
  prosodyScore?: number; // 0-100
  passed?: boolean;
  targetOverallThreshold?: number;
  targetAccuracyThreshold?: number;
  recordingDurationSeconds?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  confidenceLabel?: "unknown" | "learning" | "review" | "known";
  latencyMs?: number; // round-trip time for the Azure API call (ms)
  // recordingUrl is a blob URL scoped to the session. recordingDataUrl persists across reloads.
  recordingUrl?: string; // blob URL or stable recording reference for playback
  recordingDataUrl?: string; // base64 data URL fallback for persisted history playback
  wordScores?: {
    wordId?: WordId;
    token: string;
    overallScore: number;
    accuracyScore?: number;
    fluencyScore?: number;
    phonemeScores?: {
      phonemeId: PhonemeId;
      overallScore: number;
    }[];
  }[];
}

/**
 * A single attempt at practicing a word.
 */
export interface WordPracticeAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  wordId: WordId;
  difficulty: DifficultyLevel;
  category: ContentCategory;
  createdAt: string; // ISO timestamp
  overallScore: number; // 0-100
  accuracyScore: number; // 0-100
  fluencyScore?: number; // 0-100
  completenessScore?: number; // 0-100
  prosodyScore?: number; // 0-100
  passed?: boolean;
  targetOverallThreshold?: number;
  recordingDurationSeconds?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  phonemeScores?: {
    phonemeId: PhonemeId;
    overallScore: number;
  }[];
  // New fields for vocabulary recall and self-rating modes (all optional for backward compatibility)
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  practiceMode?: 'pronunciation' | 'text-mcq' | 'listening-mcq' | 'self-rating';
  isCorrect?: boolean; // For MCQ modes: whether the user selected the correct answer
  latencyMs?: number; // Response time in milliseconds (for MCQ modes)
  selfRating?: 'know' | 'dont_know'; // For self-rating mode
}

/**
 * Aggregate progress tracking for a sentence.
 */
export interface SentenceProgress {
  userId: string;
  sentenceId: SentenceId;
  attempts: number;
  successfulAttempts: number;
  lastPracticedAt?: string; // ISO timestamp
  firstPracticedAt?: string; // ISO timestamp
  bestOverallScore?: number; // 0-100
  bestAccuracyScore?: number; // 0-100
  avgOverallScore?: number; // 0-100
  avgAccuracyScore?: number; // 0-100
  avgFluencyScore?: number; // 0-100
  avgCompletenessScore?: number; // 0-100
  status: "new" | "learning" | "review" | "known";
  easeFactor?: number; // For spaced repetition algorithms
  intervalDays?: number; // Days until next review
  nextReviewDueAt?: string; // ISO timestamp
  difficulty: DifficultyLevel;
  category: ContentCategory;
}

/**
 * Aggregate progress tracking for a word.
 */
export interface WordProgress {
  userId: string;
  wordId: WordId;
  attempts: number;
  successfulAttempts: number;
  lastPracticedAt?: string; // ISO timestamp
  firstPracticedAt?: string; // ISO timestamp
  bestOverallScore?: number; // 0-100
  avgOverallScore?: number; // 0-100
  avgAccuracyScore?: number; // 0-100
  status: "new" | "learning" | "review" | "known";
  difficulty: DifficultyLevel;
  category: ContentCategory;
  weaknessScore: number; // 0-100, higher = weaker (computed from attempts)
}

/**
 * Global statistics aggregated across all user practice activity.
 */
export interface UserGlobalStats {
  userId: string;
  totalPracticeSessions: number;
  totalPracticeSeconds: number;
  totalSentenceAttempts: number;
  totalWordAttempts: number;
  totalSentencesAvailable: number;
  totalWordsAvailable: number;
  sentencesPracticedCount: number;
  wordsPracticedCount: number;
  sentencesKnownCount: number;
  sentencesLearningCount: number;
  sentencesReviewCount: number;
  sentencesNewCount: number;
  wordsKnownCount: number;
  wordsLearningCount: number;
  wordsReviewCount: number;
  wordsNewCount: number;
  rolling7DayAvgOverallScore?: number; // 0-100
  rolling30DayAvgOverallScore?: number; // 0-100
  rolling7DayPracticeMinutes?: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastPracticeDate?: string; // ISO date string (YYYY-MM-DD)
  estimatedCEFR?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
}

/**
 * Statistics aggregated by difficulty level.
 */
export interface DifficultyStats {
  userId: string;
  difficulty: DifficultyLevel;
  sentenceAttempts: number;
  wordAttempts: number;
  avgOverallScore?: number; // 0-100
  avgAccuracyScore?: number; // 0-100
  sentencesKnownCount: number;
  wordsKnownCount: number;
}

/**
 * Statistics aggregated by content category.
 */
export interface CategoryStats {
  userId: string;
  category: ContentCategory;
  sentenceAttempts: number;
  wordAttempts: number;
  avgOverallScore?: number; // 0-100
  avgAccuracyScore?: number; // 0-100
  sentencesKnownCount: number;
  wordsKnownCount: number;
}

/**
 * Statistics aggregated by phoneme.
 */
export interface PhonemeStats {
  userId: string;
  phonemeId: PhonemeId;
  attempts: number;
  avgOverallScore?: number; // 0-100
  bestOverallScore?: number; // 0-100
  lastPracticedAt?: string; // ISO timestamp
  weaknessLabel?: "weak" | "ok" | "strong";
}
