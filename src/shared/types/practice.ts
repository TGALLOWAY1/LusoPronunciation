/**
 * Shared Practice type definitions
 * Used by both frontend and backend
 */

/**
 * Content type union
 */
export type ContentType = 'sentence' | 'word';

/**
 * Reference to practice content (sentence or word)
 */
export interface PracticeContentRef {
  contentId: string;
  contentType: ContentType;
  textPt: string;
  textEn?: string;
}

/**
 * Pronunciation scores from assessment engine
 */
export interface PronunciationScores {
  overall: number; // 0-100
  accuracy: number; // 0-100
  fluency?: number; // 0-100
  completeness?: number; // 0-100
  prosody?: number; // 0-100
}

/**
 * Word-level scores within an attempt
 */
export interface WordScore {
  wordId?: string;
  token: string;
  overallScore: number; // 0-100
  accuracyScore?: number; // 0-100
  fluencyScore?: number; // 0-100
  errorType?: 'none' | 'mispronounced' | 'omitted' | 'extra';
  phonemeScores?: {
    phonemeId: string;
    overallScore: number;
  }[];
}

/**
 * Assessment engine type
 */
export type AssessmentEngine = 'mock' | 'azure_speech';

/**
 * Pronunciation attempt - unified type for both sentences and words
 */
export interface PronunciationAttempt {
  id: string;
  userId: string;
  sessionId?: string;
  content: PracticeContentRef;
  engine: AssessmentEngine;
  scores: PronunciationScores;
  wordScores?: WordScore[];
  rawAssessment?: any; // Raw response from assessment engine
  createdAt: string; // ISO timestamp
  
  // Optional metadata
  recordingUrl?: string; // blob URL or stable recording reference
  recordingDataUrl?: string; // base64 data URL fallback
  recordingDurationSeconds?: number;
  latencyMs?: number; // round-trip time for API call (ms)
  passed?: boolean;
  targetOverallThreshold?: number;
  targetAccuracyThreshold?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  confidenceLabel?: 'unknown' | 'learning' | 'review' | 'known';
  
  // Word-specific fields (optional for backward compatibility)
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  practiceMode?: 'pronunciation' | 'text-mcq' | 'listening-mcq' | 'self-rating';
  isCorrect?: boolean; // For MCQ modes
  selfRating?: 'know' | 'dont_know'; // For self-rating mode
}

/**
 * Practice session mode
 */
export type PracticeSessionMode = 'sentences' | 'words' | 'mixed';

/**
 * Practice session - represents a continuous period of practice activity
 * 
 * Note: This is the canonical type for backend use. The frontend may use
 * a slightly different structure (with sessionId instead of id, required endedAt, etc.)
 * for backward compatibility. Mappers handle the conversion.
 */
export interface PracticeSession {
  id: string;
  userId: string;
  mode: PracticeSessionMode;
  startedAt: string; // ISO timestamp
  endedAt?: string; // ISO timestamp (optional when session is active)
  createdAt: string; // ISO timestamp
  
  // Optional metadata
  device?: 'desktop' | 'mobile';
  appVersion?: string;
  totalAttempts?: number;
  sentenceAttempts?: number;
  wordAttempts?: number;
  avgOverallScore?: number;
  avgFluencyScore?: number;
  avgAccuracyScore?: number;
  avgCompletenessScore?: number;
  avgProsodyScore?: number;
  dailyStreakAfterSession?: number;
}

/**
 * Legacy types for backward compatibility
 * These map to the existing SentencePracticeAttempt and WordPracticeAttempt
 */
export interface SentencePracticeAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  sentenceId: string;
  difficulty: 2 | 3 | 4;
  category: string;
  createdAt: string;
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  prosodyScore?: number;
  passed?: boolean;
  targetOverallThreshold?: number;
  targetAccuracyThreshold?: number;
  recordingDurationSeconds?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  confidenceLabel?: 'unknown' | 'learning' | 'review' | 'known';
  latencyMs?: number;
  recordingUrl?: string;
  recordingDataUrl?: string;
  wordScores?: WordScore[];
}

export interface WordPracticeAttempt {
  attemptId: string;
  userId: string;
  sessionId: string;
  wordId: string;
  difficulty: 2 | 3 | 4;
  category: string;
  createdAt: string;
  overallScore: number;
  accuracyScore: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  passed?: boolean;
  targetOverallThreshold?: number;
  recordingDurationSeconds?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  phonemeScores?: {
    phonemeId: string;
    overallScore: number;
  }[];
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  practiceMode?: 'pronunciation' | 'text-mcq' | 'listening-mcq' | 'self-rating';
  isCorrect?: boolean;
  latencyMs?: number;
  selfRating?: 'know' | 'dont_know';
}
