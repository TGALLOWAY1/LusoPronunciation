/**
 * Unified audio index builder for the content generation pipeline.
 * 
 * This module generates data/audio_index.json from enriched words and sentences,
 * using paths that align with audioJobPlanner's output structure and mapping
 * them to the format expected by src/lib/audio.ts.
 * 
 * The generated index is compatible with the existing AudioIndex structure
 * where each key is the item ID and the value is an AudioIndexEntry containing
 * type, sourceId, text fields, and audio paths for each voice/gender.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { EnrichedWord, EnrichedSentence, AudioIndexEntryExtended } from '../types/contentGeneration';
import type { AudioIndex, AudioIndexEntry } from '../lib/types';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';

/**
 * Builds the old format path expected by src/lib/audio.ts.
 * 
 * @param itemId - The item ID (word or sentence)
 * @param gender - The gender ("male" or "female")
 * @returns Path in old format (e.g., "audio/ptbr/male/word_001.wav")
 */
function buildOldFormatPath(itemId: string, gender: 'male' | 'female'): string {
  return `audio/ptbr/${gender}/${itemId}.wav`;
}

/**
 * Builds an audio index from enriched words and sentences.
 * 
 * For each EnrichedWord and EnrichedSentence, and for each configured voice:
 * - Constructs paths matching audioJobPlanner's output structure
 * - Maps paths to the format expected by src/lib/audio.ts
 * - Groups by itemId (not by voice) - each entry has both male and female paths
 * 
 * Path mapping:
 * - New format: public/audio/words/ptbr_male/word_001.wav
 * - Old format: audio/ptbr/male/word_001.wav
 * 
 * @param params - Build parameters
 * @param params.words - Array of enriched words
 * @param params.sentences - Array of enriched sentences
 * @param params.config - Generation pipeline configuration
 * @returns Array of AudioIndexEntryExtended entries (for internal use) and AudioIndex (for writing)
 */
export async function buildAudioIndex(params: {
  words: EnrichedWord[];
  sentences: EnrichedSentence[];
  config: GenerationPipelineConfig;
}): Promise<AudioIndexEntryExtended[]> {
  const { words, sentences, config } = params;
  const audioBaseDir = config.paths.audioBaseDir;
  const entries: AudioIndexEntryExtended[] = [];
  
  // Track distinct voices for logging
  const voiceIds = new Set<string>();
  
  // Build entries for words
  for (const word of words) {
    const ptbr: { male: string; female: string } = {
      male: '',
      female: '',
    };
    
    // Track paths for each voice (for extended entries)
    const voicePaths: Array<{ voiceId: string; path: string; gender: 'male' | 'female' }> = [];
    
    // Generate paths for each voice
    for (const voice of config.voices) {
      voiceIds.add(voice.id);
      
      // Build path matching audioJobPlanner format (for reference)
      const newPath = path.join(
        audioBaseDir,
        'words',
        voice.id,
        `${word.id}.wav`
      ).replace(/\\/g, '/');
      
      // Build old format path expected by src/lib/audio.ts
      const oldPath = buildOldFormatPath(word.id, voice.gender);
      
      // Set path based on gender
      if (voice.gender === 'male') {
        ptbr.male = oldPath;
      } else if (voice.gender === 'female') {
        ptbr.female = oldPath;
      }
      
      voicePaths.push({ voiceId: voice.id, path: newPath, gender: voice.gender });
    }
    
    // Create one extended entry per voice (for internal tracking)
    for (const voicePath of voicePaths) {
      entries.push({
        id: word.id,
        type: 'word',
        sourceId: word.id,
        textPt: word.text,
        textEn: '', // English translation not available in EnrichedWord
        ptbr: {
          male: voicePath.gender === 'male' ? ptbr.male : '',
          female: voicePath.gender === 'female' ? ptbr.female : '',
        },
        voice: voicePath.voiceId,
        path: voicePath.path,
        text: word.text,
        metadata: {
          category: word.category,
          tags: word.tags,
          cefr: word.cefr,
        },
      });
    }
  }
  
  // Build entries for sentences
  for (const sentence of sentences) {
    const ptbr: { male: string; female: string } = {
      male: '',
      female: '',
    };
    
    // Track paths for each voice (for extended entries)
    const voicePaths: Array<{ voiceId: string; path: string; gender: 'male' | 'female' }> = [];
    
    // Generate paths for each voice
    for (const voice of config.voices) {
      voiceIds.add(voice.id);
      
      // Build path matching audioJobPlanner format (for reference)
      const newPath = path.join(
        audioBaseDir,
        'sentences',
        voice.id,
        `${sentence.id}.wav`
      ).replace(/\\/g, '/');
      
      // Build old format path expected by src/lib/audio.ts
      const oldPath = buildOldFormatPath(sentence.id, voice.gender);
      
      // Set path based on gender
      if (voice.gender === 'male') {
        ptbr.male = oldPath;
      } else if (voice.gender === 'female') {
        ptbr.female = oldPath;
      }
      
      voicePaths.push({ voiceId: voice.id, path: newPath, gender: voice.gender });
    }
    
    // Create one extended entry per voice (for internal tracking)
    for (const voicePath of voicePaths) {
      entries.push({
        id: sentence.id,
        type: 'sentence',
        sourceId: sentence.id,
        textPt: sentence.text,
        textEn: '', // English translation not available in EnrichedSentence
        ptbr: {
          male: voicePath.gender === 'male' ? ptbr.male : '',
          female: voicePath.gender === 'female' ? ptbr.female : '',
        },
        voice: voicePath.voiceId,
        path: voicePath.path,
        text: sentence.text,
        metadata: {
          category: sentence.category,
          tags: sentence.tags,
          cefr: sentence.cefr,
        },
      });
    }
  }
  
  // Log summary
  const wordEntries = entries.filter(e => e.type === 'word').length / config.voices.length;
  const sentenceEntries = entries.filter(e => e.type === 'sentence').length / config.voices.length;
  console.log(`Built audio index: ${wordEntries} word entries, ${sentenceEntries} sentence entries, ${voiceIds.size} distinct voices`);
  
  return entries;
}

/**
 * Converts AudioIndexEntryExtended array to AudioIndex format (grouped by itemId).
 * 
 * Groups entries by itemId and combines male/female paths into a single entry.
 * 
 * @param entries - Array of extended entries
 * @returns AudioIndex object keyed by item ID
 */
function convertToAudioIndex(entries: AudioIndexEntryExtended[]): AudioIndex {
  const index: AudioIndex = {};
  
  // Group entries by itemId
  const grouped = new Map<string, AudioIndexEntryExtended[]>();
  for (const entry of entries) {
    const key = entry.id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }
  
  // Combine entries for each itemId
  for (const [itemId, itemEntries] of grouped.entries()) {
    const firstEntry = itemEntries[0];
    const ptbr: { male: string; female: string } = {
      male: '',
      female: '',
    };
    
    // Combine paths from all voices
    for (const entry of itemEntries) {
      if (entry.ptbr.male) {
        ptbr.male = entry.ptbr.male;
      }
      if (entry.ptbr.female) {
        ptbr.female = entry.ptbr.female;
      }
    }
    
    const audioEntry: AudioIndexEntry = {
      type: firstEntry.type,
      sourceId: firstEntry.sourceId,
      textPt: firstEntry.textPt,
      textEn: firstEntry.textEn,
      ptbr,
    };
    
    index[itemId] = audioEntry;
  }
  
  return index;
}

/**
 * Writes the audio index to the configured path.
 * 
 * Converts AudioIndexEntryExtended array to AudioIndex format and writes
 * as a keyed JSON object compatible with the existing audio_index.json format
 * and src/lib/audio.ts expectations.
 * 
 * @param entries - Array of extended audio index entries
 * @param config - Generation pipeline configuration
 */
export async function writeAudioIndex(
  entries: AudioIndexEntryExtended[],
  config: GenerationPipelineConfig
): Promise<void> {
  const index = convertToAudioIndex(entries);
  const outputPath = path.join(process.cwd(), config.paths.audioIndexPath);
  const outputDir = path.dirname(outputPath);
  
  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  // Write pretty-printed JSON
  const jsonContent = JSON.stringify(index, null, 2);
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  
  console.log(`Wrote audio index with ${Object.keys(index).length} entries to ${outputPath}`);
}

