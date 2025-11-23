/**
 * TTS job planner for the content generation pipeline.
 * 
 * Builds TTSJob arrays from EnrichedWord and EnrichedSentence arrays,
 * generating jobs for each item and each voice configuration.
 */

import * as path from 'path';
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';

/**
 * TTS job specification for generating audio files.
 */
export interface TTSJob {
  id: string;                    // Unique job ID (e.g., "word_001_male", "sentence_002_female")
  itemId: string;                // ID of the word or sentence
  itemType: "word" | "sentence";
  text: string;                  // Portuguese text to synthesize
  voiceId: string;               // Voice ID from config (e.g., "ptbr_male")
  voiceName: string;             // Azure voice name (e.g., "pt-BR-AntonioNeural")
  outputPath: string;            // Relative path to public/ (e.g., "audio/words/ptbr_male/word_001.wav")
}

/**
 * Plans TTS jobs for words and sentences.
 * 
 * Canonical file naming scheme:
 * - Words: {audioBaseDir}/words/{voiceId}/{wordId}.wav
 *   → URL: /audio/words/{voiceId}/{wordId}.wav
 * - Sentences: {audioBaseDir}/sentences/{voiceId}/{sentenceId}.wav
 *   → URL: /audio/sentences/{voiceId}/{sentenceId}.wav
 * 
 * This ensures paths are consistent with what data/audio_index.json will contain.
 * 
 * @param words - Array of enriched words
 * @param sentences - Array of enriched sentences
 * @param config - Generation pipeline configuration
 * @returns Array of TTSJob entries
 */
export function planTTSJobs(
  words: EnrichedWord[],
  sentences: EnrichedSentence[],
  config: GenerationPipelineConfig
): TTSJob[] {
  const jobs: TTSJob[] = [];
  const audioBaseDir = config.paths.audioBaseDir;

  // Generate jobs for words
  for (const word of words) {
    for (const voice of config.voices) {
      // Build canonical output path: {audioBaseDir}/words/{voiceId}/{wordId}.wav
      // This maps to URL: /audio/words/{voiceId}/{wordId}.wav
      const outputPath = path.join(
        audioBaseDir,
        'words',
        voice.id,
        `${word.id}.wav`
      ).replace(/\\/g, '/'); // Normalize to forward slashes

      jobs.push({
        id: `${word.id}_${voice.id}`,
        itemId: word.id,
        itemType: 'word',
        text: word.text,
        voiceId: voice.id,
        voiceName: voice.azureVoiceName,
        outputPath,
      });
    }
  }

  // Generate jobs for sentences
  for (const sentence of sentences) {
    for (const voice of config.voices) {
      // Build canonical output path: {audioBaseDir}/sentences/{voiceId}/{sentenceId}.wav
      // This maps to URL: /audio/sentences/{voiceId}/{sentenceId}.wav
      const outputPath = path.join(
        audioBaseDir,
        'sentences',
        voice.id,
        `${sentence.id}.wav`
      ).replace(/\\/g, '/'); // Normalize to forward slashes

      jobs.push({
        id: `${sentence.id}_${voice.id}`,
        itemId: sentence.id,
        itemType: 'sentence',
        text: sentence.text,
        voiceId: voice.id,
        voiceName: voice.azureVoiceName,
        outputPath,
      });
    }
  }

  return jobs;
}

