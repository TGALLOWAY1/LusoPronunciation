/**
 * Development harness for testing the content generation pipeline.
 * 
 * This is a simple integration function that loads, enriches, and writes datasets.
 * It's intended for development/testing purposes only. The full orchestrator script
 * will be created in a later dedicated prompt.
 * 
 * Usage:
 *   import { runDevHarness } from './pipeline/devHarness';
 *   await runDevHarness();
 */

import { loadRawWords, loadRawSentences } from './loadSourceLists';
import { buildMasterWords, buildMasterSentences } from './enrichItems';
import { writeMasterWords, writeMasterSentences } from './writeCanonicalDatasets';
import generationPipelineConfig from '../../config/generationPipeline.config';

/**
 * Runs the full pipeline: load → enrich → write.
 * 
 * Uses the default limits from generationPipelineConfig.
 * This is a development/testing function, not the production orchestrator.
 */
export async function runDevHarness(): Promise<void> {
  console.log('Starting development harness...');
  console.log('Config:', {
    wordLimit: generationPipelineConfig.wordLimit,
    sentenceLimit: generationPipelineConfig.sentenceLimit,
    enableWords: generationPipelineConfig.enableWords,
    enableSentences: generationPipelineConfig.enableSentences,
  });

  // Load raw data
  console.log('\n--- Loading raw data ---');
  const rawWords = await loadRawWords();
  const rawSentences = await loadRawSentences();

  // Enrich words
  console.log('\n--- Enriching words ---');
  const masterWords = buildMasterWords(
    rawWords,
    generationPipelineConfig.wordLimit
  );
  console.log(`Enriched ${masterWords.length} words`);

  // Enrich sentences
  console.log('\n--- Enriching sentences ---');
  const masterSentences = buildMasterSentences(
    rawSentences,
    masterWords,
    generationPipelineConfig.sentenceLimit
  );
  console.log(`Enriched ${masterSentences.length} sentences`);

  // Write datasets
  console.log('\n--- Writing datasets ---');
  await writeMasterWords(masterWords);
  await writeMasterSentences(masterSentences);

  console.log('\n✅ Development harness completed successfully!');
  console.log(`   - ${masterWords.length} master words written`);
  console.log(`   - ${masterSentences.length} master sentences written`);
}

