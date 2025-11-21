/**
 * Types for word drill logging functionality
 */

export type WordDrillLogEntry = {
  id: string;            // unique log id (e.g., `${wordId}-${timestamp}`)
  wordId: string;
  wordText: string;
  translation: string;
  known: boolean;        // true if user marked they knew it
  timestamp: string;     // ISO string
  mode: "word-drill";    // to distinguish from other modes in future
};

