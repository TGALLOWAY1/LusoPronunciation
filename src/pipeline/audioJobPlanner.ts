/**
 * TTS job planner for the content generation pipeline.
 * 
 * Builds TTSJob arrays from MasterWord and MasterSentence arrays,
 * generating jobs for each item and each voice configuration.
 */

import { MasterWord, MasterSentence, TTSJob } from '../types/contentGeneration';

export interface VoiceConfig {
  name: string;
  gender: 'male' | 'female';
}

/**
 * Builds TTS jobs for words and sentences.
 * 
 * For each MasterWord and each voice:
 * - id = word.id
 * - itemType = "word"
 * - text = word.text
 * - outputPath = public/audio/ptbr/${gender}/${id}.wav
 * 
 * For each MasterSentence and each voice:
 * - id = sentence.id
 * - itemType = "sentence"
 * - text = sentence.text
 * - outputPath = public/audio/ptbr/${gender}/${id}.wav
 * 
 * This aligns with the fallback logic in src/lib/audio.ts which expects
 * /audio/ptbr/{gender}/{id}.wav (served from public/ directory).
 * 
 * @param words - Array of MasterWord entries
 * @param sentences - Array of MasterSentence entries
 * @param voices - Array of voice configurations
 * @returns Array of TTSJob entries
 */
export function buildTTSJobs(
  words: MasterWord[],
  sentences: MasterSentence[],
  voices: VoiceConfig[]
): TTSJob[] {
  const jobs: TTSJob[] = [];

  // Generate jobs for words
  for (const word of words) {
    for (const voice of voices) {
      jobs.push({
        id: word.id,
        itemType: 'word',
        text: word.text,
        voice: voice.name,
        gender: voice.gender,
        outputPath: `public/audio/ptbr/${voice.gender}/${word.id}.wav`,
      });
    }
  }

  // Generate jobs for sentences
  for (const sentence of sentences) {
    for (const voice of voices) {
      jobs.push({
        id: sentence.id,
        itemType: 'sentence',
        text: sentence.text,
        voice: voice.name,
        gender: voice.gender,
        outputPath: `public/audio/ptbr/${voice.gender}/${sentence.id}.wav`,
      });
    }
  }

  return jobs;
}

