/**
 * Unified audio index builder for the content generation pipeline.
 * 
 * This module replaces the manual index maintenance logic previously done in
 * scripts/generate_audio.js. It generates data/audio_index.json from master
 * datasets (masterWords.json and masterSentences.json) using a standardized
 * path format compatible with src/lib/audio.ts.
 * 
 * The generated index is a keyed object where each key is the item ID and the
 * value is an AudioIndexEntry containing type, sourceId, text fields, and
 * audio paths for each voice/gender.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { MasterWord, MasterSentence } from '../types/contentGeneration';
import { AudioIndex, AudioIndexEntry } from '../lib/types';

export interface VoiceConfig {
  name: string;
  gender: 'male' | 'female';
}

/**
 * Builds an audio index from master words and sentences.
 * 
 * For each MasterWord:
 * - Creates an AudioIndexEntry with type="word"
 * - Uses word.id as the key and sourceId
 * - Sets textPt to word.text and textEn to word.englishGloss
 * - Generates paths: audio/ptbr/{gender}/{id}.wav for each voice
 * 
 * For each MasterSentence:
 * - Creates an AudioIndexEntry with type="sentence"
 * - Uses sentence.id as the key and sourceId
 * - Sets textPt to sentence.text and textEn to sentence.englishTranslation
 * - Generates paths: audio/ptbr/{gender}/{id}.wav for each voice
 * 
 * Path format: "audio/ptbr/{gender}/{id}.wav" (no leading slash, no "public/" prefix)
 * This matches the format expected by src/lib/audio.ts and the existing audio_index.json structure.
 * 
 * @param words - Array of MasterWord entries
 * @param sentences - Array of MasterSentence entries
 * @param voices - Array of voice configurations (must include both male and female)
 * @returns AudioIndex object keyed by item ID
 */
export function buildAudioIndex(
  words: MasterWord[],
  sentences: MasterSentence[],
  voices: VoiceConfig[]
): AudioIndex {
  const index: AudioIndex = {};

  // Build index entries for words
  for (const word of words) {
    const ptbr: { male: string; female: string } = {
      male: '',
      female: '',
    };

    // Generate paths for each voice/gender
    for (const voice of voices) {
      const path = `audio/ptbr/${voice.gender}/${word.id}.wav`;
      if (voice.gender === 'male') {
        ptbr.male = path;
      } else if (voice.gender === 'female') {
        ptbr.female = path;
      }
    }

    const entry: AudioIndexEntry = {
      type: 'word',
      sourceId: word.id,
      textPt: word.text,
      textEn: word.englishGloss,
      ptbr,
    };

    index[word.id] = entry;
  }

  // Build index entries for sentences
  for (const sentence of sentences) {
    const ptbr: { male: string; female: string } = {
      male: '',
      female: '',
    };

    // Generate paths for each voice/gender
    for (const voice of voices) {
      const path = `audio/ptbr/${voice.gender}/${sentence.id}.wav`;
      if (voice.gender === 'male') {
        ptbr.male = path;
      } else if (voice.gender === 'female') {
        ptbr.female = path;
      }
    }

    const entry: AudioIndexEntry = {
      type: 'sentence',
      sourceId: sentence.id,
      textPt: sentence.text,
      textEn: sentence.englishTranslation,
      ptbr,
    };

    index[sentence.id] = entry;
  }

  return index;
}

/**
 * Writes the audio index to data/audio_index.json.
 * 
 * The index is written as a keyed JSON object compatible with the existing
 * audio_index.json format and src/lib/audio.ts expectations.
 * 
 * @param index - AudioIndex object to write
 */
export async function writeAudioIndex(index: AudioIndex): Promise<void> {
  const outputPath = path.join(process.cwd(), 'data', 'audio_index.json');
  const jsonContent = JSON.stringify(index, null, 2);

  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  console.log(`Wrote audio index with ${Object.keys(index).length} entries to ${outputPath}`);
}

