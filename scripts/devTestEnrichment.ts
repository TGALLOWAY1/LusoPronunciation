#!/usr/bin/env node

/**
 * Development test script for the enrichment pipeline.
 * 
 * This script smoke-tests the enrichment pipeline up to the point of writing
 * canonical datasets. It's useful for interim validation during development.
 * 
 * This script will be replaced by the final orchestrator later, but it's
 * useful for validating the enrichment stages.
 * 
 * Usage:
 *   npm run dev:test-enrichment
 *   tsx scripts/devTestEnrichment.ts
 */

import generationPipelineConfig from '../config/generationPipeline.config';
import { loadRawWords, loadRawSentences } from '../src/pipeline/loadSourceLists';
import { enrichWords, enrichSentences } from '../src/pipeline/enrichItems';
import { writeMasterWords, writeMasterSentences } from '../src/pipeline/writeCanonicalDatasets';

/**
 * Runs the enrichment pipeline smoke test.
 */
async function runDevTestEnrichment(): Promise<void> {
  console.log('🧪 Starting enrichment pipeline smoke test...\n');
  console.log('Config:', {
    rawWordsPath: generationPipelineConfig.paths.rawWordsJsonPath,
    rawSentencesPath: generationPipelineConfig.paths.rawSentencesJsonPath,
    masterWordsPath: generationPipelineConfig.paths.masterWordsPath,
    masterSentencesPath: generationPipelineConfig.paths.masterSentencesPath,
    maxWords: generationPipelineConfig.limits.maxWords ?? 'unlimited',
    maxSentences: generationPipelineConfig.limits.maxSentences ?? 'unlimited',
  });
  console.log('');

  try {
    // Step 1: Load raw data
    console.log('📥 Step 1: Loading raw data...');
    const rawWords = await loadRawWords(generationPipelineConfig);
    const rawSentences = await loadRawSentences(generationPipelineConfig);
    console.log(`   ✓ Loaded ${rawWords.length} raw words`);
    console.log(`   ✓ Loaded ${rawSentences.length} raw sentences\n`);

    // Step 2: Enrich words
    console.log('✨ Step 2: Enriching words...');
    const enrichedWords = enrichWords(rawWords, generationPipelineConfig);
    console.log(`   ✓ Enriched ${enrichedWords.length} words`);
    
    // Show sample enriched word
    if (enrichedWords.length > 0) {
      const sample = enrichedWords[0];
      console.log(`   Sample word: "${sample.text}"`);
      console.log(`     - Category: ${sample.category}`);
      console.log(`     - Part of speech: ${sample.partOfSpeech}`);
      console.log(`     - Tags: ${sample.tags?.join(', ') || 'none'}`);
      console.log(`     - CEFR: ${sample.cefr || 'not set'}`);
      console.log(`     - Difficulty score: ${sample.difficultyScore ?? 'not set'}`);
      console.log(`     - Phonemes: ${sample.phonemes.length} found`);
    }
    console.log('');

    // Step 3: Enrich sentences
    console.log('✨ Step 3: Enriching sentences...');
    const enrichedSentences = enrichSentences(rawSentences, enrichedWords, generationPipelineConfig);
    console.log(`   ✓ Enriched ${enrichedSentences.length} sentences`);
    
    // Show sample enriched sentence
    if (enrichedSentences.length > 0) {
      const sample = enrichedSentences[0];
      console.log(`   Sample sentence: "${sample.text}"`);
      console.log(`     - Category: ${sample.category}`);
      console.log(`     - Tags: ${sample.tags?.join(', ') || 'none'}`);
      console.log(`     - CEFR: ${sample.cefr || 'not set'}`);
      console.log(`     - Difficulty score: ${sample.difficultyScore ?? 'not set'}`);
      console.log(`     - Word refs: ${sample.wordRefs?.length ?? 0} words matched`);
    }
    console.log('');

    // Step 4: Write canonical datasets
    console.log('💾 Step 4: Writing canonical datasets...');
    await writeMasterWords(enrichedWords, generationPipelineConfig);
    await writeMasterSentences(enrichedSentences, generationPipelineConfig);
    console.log('');

    // Summary
    console.log('✅ Enrichment pipeline smoke test completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log(`   - Words processed: ${enrichedWords.length}`);
    console.log(`   - Sentences processed: ${enrichedSentences.length}`);
    console.log(`   - Master words written to: ${generationPipelineConfig.paths.masterWordsPath}`);
    console.log(`   - Master sentences written to: ${generationPipelineConfig.paths.masterSentencesPath}`);
    console.log('');

  } catch (error) {
    console.error('❌ Error during enrichment pipeline test:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  runDevTestEnrichment().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runDevTestEnrichment };

