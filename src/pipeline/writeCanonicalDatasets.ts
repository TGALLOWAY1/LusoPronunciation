/**
 * Master dataset writers for the content generation pipeline.
 * 
 * Writes enriched EnrichedWord and EnrichedSentence arrays to canonical JSON files
 * that serve as the source of truth for the application.
 * 
 * Output files are configured via GenerationPipelineConfig paths.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';

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
 * Writes EnrichedWord array to the configured master words path.
 * 
 * @param words - Array of EnrichedWord entries to write
 * @param config - Generation pipeline configuration
 */
export async function writeMasterWords(
  words: EnrichedWord[],
  config: GenerationPipelineConfig
): Promise<void> {
  const outputPath = path.join(process.cwd(), config.paths.masterWordsPath);
  const outputDir = path.dirname(outputPath);
  
  // Ensure the directory structure exists
  await ensureDirectoryExists(outputDir);

  // Write pretty-printed JSON for readability
  const jsonContent = JSON.stringify(words, null, 2);
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  
  console.log(`Wrote ${words.length} master words to ${outputPath}`);
}

/**
 * Writes EnrichedSentence array to the configured master sentences path.
 * 
 * @param sentences - Array of EnrichedSentence entries to write
 * @param config - Generation pipeline configuration
 */
export async function writeMasterSentences(
  sentences: EnrichedSentence[],
  config: GenerationPipelineConfig
): Promise<void> {
  const outputPath = path.join(process.cwd(), config.paths.masterSentencesPath);
  const outputDir = path.dirname(outputPath);
  
  // Ensure the directory structure exists
  await ensureDirectoryExists(outputDir);

  // Write pretty-printed JSON for readability
  const jsonContent = JSON.stringify(sentences, null, 2);
  await fs.writeFile(outputPath, jsonContent, 'utf-8');
  
  console.log(`Wrote ${sentences.length} master sentences to ${outputPath}`);
}

