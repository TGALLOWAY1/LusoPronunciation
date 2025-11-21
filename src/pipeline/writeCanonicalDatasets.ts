/**
 * Master dataset writers for the content generation pipeline.
 * 
 * Writes enriched MasterWord and MasterSentence arrays to canonical JSON files
 * that serve as the source of truth for the application.
 * 
 * Output files:
 * - data/masterWords.json: Array of MasterWord entries
 * - data/masterSentences.json: Array of MasterSentence entries
 * 
 * Expected output sizes with default limits (from generationPipelineConfig):
 * - masterWords.json: ~2000 words (wordLimit default)
 * - masterSentences.json: ~1000 sentences (sentenceLimit default)
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { MasterWord, MasterSentence } from '../types/contentGeneration';

/**
 * Ensures a directory exists, creating it if necessary.
 * 
 * @param dirPath - The directory path to ensure
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Writes MasterWord array to data/masterWords.json.
 * 
 * @param words - Array of MasterWord entries to write
 */
export async function writeMasterWords(words: MasterWord[]): Promise<void> {
  const outputDir = path.join(process.cwd(), 'data');
  await ensureDirectoryExists(outputDir);

  const outputPath = path.join(outputDir, 'masterWords.json');
  const jsonContent = JSON.stringify(words, null, 2);

  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  console.log(`Wrote ${words.length} master words to ${outputPath}`);
}

/**
 * Writes MasterSentence array to data/masterSentences.json.
 * 
 * @param sentences - Array of MasterSentence entries to write
 */
export async function writeMasterSentences(
  sentences: MasterSentence[]
): Promise<void> {
  const outputDir = path.join(process.cwd(), 'data');
  await ensureDirectoryExists(outputDir);

  const outputPath = path.join(outputDir, 'masterSentences.json');
  const jsonContent = JSON.stringify(sentences, null, 2);

  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  console.log(`Wrote ${sentences.length} master sentences to ${outputPath}`);
}

