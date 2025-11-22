/**
 * Pronunciation assessment fixture generator for the content generation pipeline.
 * 
 * Generates Azure Pronunciation Assessment fixtures by:
 * 1. Selecting a subset of words/sentences
 * 2. Generating TTS audio for each
 * 3. Assessing the pronunciation using Azure API
 * 4. Writing fixture files (JSON + audio) following existing naming conventions
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { EnrichedWord, EnrichedSentence } from '../types/contentGeneration';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';
import { assessPronunciation } from './azurePronunciationClient';
import { textToSpeechToFile } from './azureTTSClient';

/**
 * Generates pronunciation assessment fixtures for words and sentences.
 * 
 * For each selected item:
 * 1. Generates TTS audio using the first configured voice
 * 2. Assesses the pronunciation using Azure API
 * 3. Writes the raw Azure JSON response to a fixture file
 * 4. Writes the audio file
 * 
 * Fixture naming conventions:
 * - Sentences: phrase_{id}_JSON.json and Phrase {number} Audio.wav
 * - Words: word_{id}_JSON.json and Word {id} Audio.wav
 * 
 * @param params - Generation parameters
 * @param params.sentences - Array of enriched sentences
 * @param params.words - Array of enriched words
 * @param params.config - Generation pipeline configuration
 * @param params.limit - Optional limit on number of items to process (default: 10)
 */
export async function generatePronunciationFixtures(params: {
  sentences: EnrichedSentence[];
  words: EnrichedWord[];
  config: GenerationPipelineConfig;
  limit?: number;
}): Promise<void> {
  const { sentences, words, config, limit = 10 } = params;
  const testDataDir = path.join(process.cwd(), config.paths.testDataBaseDir);
  
  // Ensure test data directory exists
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Select subset of items (first N of each type, or based on tags)
  const selectedSentences = sentences.slice(0, limit);
  const selectedWords = words.slice(0, limit);
  
  // Use first configured voice for TTS generation
  const voice = config.voices[0];
  if (!voice) {
    throw new Error('No voices configured in pipeline config');
  }
  
  console.log(`Generating pronunciation fixtures for ${selectedSentences.length} sentences and ${selectedWords.length} words...`);
  
  // Process sentences
  let sentenceNumber = 1;
  for (const sentence of selectedSentences) {
    try {
      console.log(`Processing sentence ${sentenceNumber}: "${sentence.text}"`);
      
      // Generate TTS audio
      const audioFileName = `Phrase ${sentenceNumber} Audio.wav`;
      const audioPath = path.join(testDataDir, audioFileName);
      
      await textToSpeechToFile({
        text: sentence.text,
        voiceName: voice.azureVoiceName,
        outputPath: audioPath,
      });
      
      // Assess pronunciation
      const rawAzure = await assessPronunciation({
        text: sentence.text,
        referenceAudioPath: audioPath,
        locale: 'pt-BR',
      });
      
      // Write Azure JSON fixture
      const jsonFileName = `phrase_${sentenceNumber}_JSON.json`;
      const jsonPath = path.join(testDataDir, jsonFileName);
      await fs.writeFile(
        jsonPath,
        JSON.stringify(rawAzure, null, 2),
        'utf-8'
      );
      
      console.log(`  ✓ Generated: ${audioFileName} and ${jsonFileName}`);
      
      sentenceNumber++;
    } catch (error) {
      console.error(`  ✗ Failed to generate fixture for sentence "${sentence.text}":`, error);
    }
  }
  
  // Process words
  for (const word of selectedWords) {
    try {
      console.log(`Processing word: "${word.text}"`);
      
      // Generate TTS audio
      const audioFileName = `Word ${word.id} Audio.wav`;
      const audioPath = path.join(testDataDir, audioFileName);
      
      await textToSpeechToFile({
        text: word.text,
        voiceName: voice.azureVoiceName,
        outputPath: audioPath,
      });
      
      // Assess pronunciation
      const rawAzure = await assessPronunciation({
        text: word.text,
        referenceAudioPath: audioPath,
        locale: 'pt-BR',
      });
      
      // Write Azure JSON fixture
      const jsonFileName = `word_${word.id}_JSON.json`;
      const jsonPath = path.join(testDataDir, jsonFileName);
      await fs.writeFile(
        jsonPath,
        JSON.stringify(rawAzure, null, 2),
        'utf-8'
      );
      
      console.log(`  ✓ Generated: ${audioFileName} and ${jsonFileName}`);
    } catch (error) {
      console.error(`  ✗ Failed to generate fixture for word "${word.text}":`, error);
    }
  }
  
  console.log(`\n✅ Pronunciation fixture generation completed!`);
  console.log(`   Fixtures written to: ${testDataDir}`);
}
