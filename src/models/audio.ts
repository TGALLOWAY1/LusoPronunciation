import type { SentenceId } from "./content";

export type AudioId = string;

export type AudioKind = "native_sentence" | "user_sentence";

export interface Audio {
  id: AudioId;
  kind: AudioKind;
  sentenceId: SentenceId;
  url: string;           // Path or URL to the audio file/blob
  durationMs?: number;
  sampleRate?: number;
  createdAt: string;     // ISO timestamp
}

