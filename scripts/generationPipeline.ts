#!/usr/bin/env node

/**
 * Content Generation Pipeline Orchestrator
 * 
 * This script orchestrates the complete content generation pipeline:
 * 1. Load raw data from JSON files
 * 2. Enrich into master datasets
 * 3. Write master datasets
 * 4. Generate TTS audio files (optional)
 * 5. Build audio index
 * 6. Generate assessment fixtures (optional)
 * 7. Validate and report
 * 
 * This script aims to supersede the legacy scripts:
 * - scripts/generate_audio.js
 * - scripts/generateWordAudio.ts
 * 
 * Usage:
 *   npm run generate:pipeline
 *   npm run generate:pipeline -- --skip-tts
 *   npm run generate:pipeline -- --skip-assessment
 *   npm run generate:pipeline -- --words-only
 *   npm run generate:pipeline -- --sentences-only
 * 
 * Note: Currently runs with tsx. In the future, this might be compiled to
 * dist/scripts/generationPipeline.js and run with node.
 */

import { config } from 'dotenv';
import generationPipelineConfig from '../config/generationPipeline.config';
import { loadRawWords, loadRawSentences } from '../src/pipeline/loadSourceLists';
import { buildMasterWords, buildMasterSentences } from '../src/pipeline/enrichItems';
import { writeMasterWords, writeMasterSentences } from '../src/pipeline/writeCanonicalDatasets';
import { buildTTSJobs } from '../src/pipeline/audioJobPlanner';
import { runTTSJobs } from '../src/pipeline/runTTSJobs';
import { buildAudioIndex, writeAudioIndex } from '../src/pipeline/buildAudioIndex';
import { generateAssessmentFixtures } from '../src/pipeline/generateAssessmentFixtures';
import { validate, writeValidationReport } from '../src/pipeline/validateGeneratedData';

// Load .env file (but don't override existing env vars)
config({ override: false });

/**
 * Parses command-line arguments for pipeline flags.
 */
function parseArgs(): {
  skipTTS: boolean;
  skipAssessment: boolean;
  wordsOnly: boolean;
  sentencesOnly: boolean;
} {
  const args = process.argv.slice(2);
  return {
    skipTTS: args.includes('--skip-tts'),
    skipAssessment: args.includes('--skip-assessment'),
    wordsOnly: args.includes('--words-only'),
    sentencesOnly: args.includes('--sentences-only'),
  };
}

/**
 * Main pipeline orchestrator function.
 */
async function main() {
  const flags = parseArgs();
  const config = { ...generationPipelineConfig };

  // Override config based on CLI flags
  if (flags.skipTTS) {
    config.enableTTS = false;
  }
  if (flags.skipAssessment) {
    config.enableAssessment = false;
  }
  if (flags.wordsOnly) {
    config.enableSentences = false;
  }
  if (flags.sentencesOnly) {
    config.enableWords = false;
  }

  console.log('🚀 Starting Content Generation Pipeline');
  console.log('='.repeat(60));
  console.log('Configuration:');
  console.log(`  Word Limit: ${config.wordLimit}`);
  console.log(`  Sentence Limit: ${config.sentenceLimit}`);
  console.log(`  Enable Words: ${config.enableWords}`);
  console.log(`  Enable Sentences: ${config.enableSentences}`);
  console.log(`  Enable TTS: ${config.enableTTS}`);
  console.log(`  Enable Assessment: ${config.enableAssessment}`);
  console.log(`  Concurrency: ${config.concurrency}`);
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Load raw data
    console.log('📥 Step 1: Loading raw data...');
    const rawWords = config.enableWords ? await loadRawWords() : [];
    const rawSentences = config.enableSentences ? await loadRawSentences() : [];
    console.log(`   Loaded ${rawWords.length} raw words, ${rawSentences.length} raw sentences\n`);

    // Step 2: Enrich into master datasets
    console.log('🔧 Step 2: Enriching data...');
    const masterWords = config.enableWords
      ? buildMasterWords(rawWords, config.wordLimit)
      : [];
    const masterSentences = config.enableSentences
      ? buildMasterSentences(rawSentences, masterWords, config.sentenceLimit)
      : [];
    console.log(`   Enriched ${masterWords.length} words, ${masterSentences.length} sentences\n`);

    // Step 3: Write master datasets
    console.log('💾 Step 3: Writing master datasets...');
    if (config.enableWords) {
      await writeMasterWords(masterWords);
    }
    if (config.enableSentences) {
      await writeMasterSentences(masterSentences);
    }
    console.log('   Master datasets written\n');

    // Step 4: Generate TTS audio (optional)
    if (config.enableTTS && (masterWords.length > 0 || masterSentences.length > 0)) {
      console.log('🎤 Step 4: Generating TTS audio...');
      const jobs = buildTTSJobs(masterWords, masterSentences, config.voices);
      console.log(`   Created ${jobs.length} TTS jobs`);
      await runTTSJobs(jobs, config.concurrency);
      console.log('   TTS audio generation complete\n');
    } else {
      console.log('⏭️  Step 4: Skipping TTS (disabled or no data)\n');
    }

    // Step 5: Build audio index
    console.log('📇 Step 5: Building audio index...');
    const audioIndex = buildAudioIndex(masterWords, masterSentences, config.voices);
    await writeAudioIndex(audioIndex);
    console.log(`   Audio index built with ${Object.keys(audioIndex).length} entries\n`);

    // Step 6: Generate assessment fixtures (optional)
    if (config.enableAssessment && masterSentences.length > 0) {
      console.log('🧪 Step 6: Generating assessment fixtures...');
      await generateAssessmentFixtures(masterSentences, {
        count: 50,
        gender: 'male',
      });
      console.log('   Assessment fixtures generated\n');
    } else {
      console.log('⏭️  Step 6: Skipping assessment fixtures (disabled or no sentences)\n');
    }

    // Step 7: Validate and report
    console.log('✅ Step 7: Validating data...');
    const validationResult = validate(masterWords, masterSentences, audioIndex);
    await writeValidationReport(validationResult);
    console.log('   Validation complete\n');

    // Final summary
    console.log('='.repeat(60));
    console.log('📊 Pipeline Summary');
    console.log('='.repeat(60));
    console.log(`Total Words: ${validationResult.totalWords}`);
    console.log(`Total Sentences: ${validationResult.totalSentences}`);
    console.log(`Words Missing Audio: ${validationResult.wordsMissingAudio.length}`);
    console.log(`Sentences Missing Audio: ${validationResult.sentencesMissingAudio.length}`);
    console.log(`Words Missing Phonemes: ${validationResult.wordsMissingPhonemes.length}`);
    console.log(`Sentences Missing Word Refs: ${validationResult.sentencesMissingWordRefs.length}`);
    console.log('='.repeat(60));

    const totalIssues =
      validationResult.wordsMissingAudio.length +
      validationResult.sentencesMissingAudio.length +
      validationResult.wordsMissingPhonemes.length +
      validationResult.sentencesMissingWordRefs.length;

    if (totalIssues === 0) {
      console.log('✅ Pipeline completed successfully with no issues!');
    } else {
      console.log(`⚠️  Pipeline completed with ${totalIssues} issues. Check validation report for details.`);
    }

    console.log('');
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the pipeline
main().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});

