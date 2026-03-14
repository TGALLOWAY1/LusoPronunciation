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
 * Note: This pipeline is intended to eventually replace the legacy scripts:
 * - scripts/generate_audio.js
 * - scripts/generateWordAudio.ts
 * 
 * These legacy scripts remain intact and can continue to be used independently.
 * 
 * Usage:
 *   npm run generation:pipeline
 *   npm run generation:pipeline -- --stage=enrich
 *   npm run generation:pipeline -- --stage=tts
 *   npm run generation:pipeline -- --stage=validate
 *   npm run generation:pipeline -- --stage=all --dry-run
 */

import { config } from 'dotenv';
import { promises as fs } from 'fs';
import * as path from 'path';
import generationPipelineConfig from '../config/generationPipeline.config';
import { loadRawWords, loadRawSentences } from '../src/pipeline/loadSourceLists';
import { enrichWords, enrichSentences } from '../src/pipeline/enrichItems';
import { writeMasterWords, writeMasterSentences } from '../src/pipeline/writeCanonicalDatasets';
import { planTTSJobs } from '../src/pipeline/audioJobPlanner';
import { runTTSJobs } from '../src/pipeline/runTTSJobs';
import { buildAudioIndex, writeAudioIndex } from '../src/pipeline/buildAudioIndex';
import { generatePronunciationFixtures } from '../src/pipeline/generateAssessmentFixtures';
import { validateGeneratedData, logValidationReport, assertValidOrThrow } from '../src/pipeline/validateGeneratedData';
import type { EnrichedWord, EnrichedSentence, AudioIndexEntryExtended } from '../src/types/contentGeneration';
import type { AudioIndex } from '../src/lib/types';

// Load .env file (but don't override existing env vars)
config({ override: false });

/**
 * Pipeline stage type.
 */
type PipelineStage = 'all' | 'enrich' | 'tts' | 'index' | 'fixtures' | 'validate';

/**
 * Parses command-line arguments for pipeline flags.
 */
function parseArgs(): {
  stage: PipelineStage;
  dryRun: boolean;
} {
  const args = process.argv.slice(2);
  
  // Parse --stage flag
  let stage: PipelineStage = 'all';
  const stageArg = args.find(arg => arg.startsWith('--stage='));
  if (stageArg) {
    const stageValue = stageArg.split('=')[1];
    if (['all', 'enrich', 'tts', 'index', 'fixtures', 'validate'].includes(stageValue)) {
      stage = stageValue as PipelineStage;
    } else {
      console.warn(`Unknown stage "${stageValue}", defaulting to "all"`);
    }
  }
  
  // Parse --dry-run flag
  const dryRun = args.includes('--dry-run');
  
  return { stage, dryRun };
}

/**
 * Main pipeline orchestrator function.
 */
async function main() {
  const flags = parseArgs();
  const config = generationPipelineConfig;

  console.log('🚀 Starting Content Generation Pipeline');
  console.log('='.repeat(60));
  console.log('Configuration:');
  console.log(`  Stage: ${flags.stage}`);
  console.log(`  Dry Run: ${flags.dryRun ? 'YES' : 'NO'}`);
  console.log(`  Max Words: ${config.limits.maxWords ?? 'unlimited'}`);
  console.log(`  Max Sentences: ${config.limits.maxSentences ?? 'unlimited'}`);
  console.log(`  Voices: ${config.voices.length} configured`);
  console.log('='.repeat(60));
  console.log('');

  if (flags.dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be written');
    console.log('');
  }

  try {
    let enrichedWords: EnrichedWord[] = [];
    let enrichedSentences: EnrichedSentence[] = [];
    let audioIndexEntries: AudioIndexEntryExtended[] = [];

    // Stage: Load and Enrich (always needed for other stages)
    if (flags.stage === 'all' || flags.stage === 'enrich' || flags.stage === 'tts' || flags.stage === 'index' || flags.stage === 'fixtures' || flags.stage === 'validate') {
      // Step 1: Load raw data
      console.log('📥 Step 1: Loading raw data...');
      const rawWords = await loadRawWords(config);
      const rawSentences = await loadRawSentences(config);
      console.log(`   Loaded ${rawWords.length} raw words, ${rawSentences.length} raw sentences\n`);

      // Step 2: Enrich into master datasets
      console.log('🔧 Step 2: Enriching data...');
      enrichedWords = enrichWords(rawWords, config);
      enrichedSentences = enrichSentences(rawSentences, enrichedWords, config);
      console.log(`   Enriched ${enrichedWords.length} words, ${enrichedSentences.length} sentences\n`);

      // Step 3: Write master datasets (unless dry-run)
      if (!flags.dryRun) {
        console.log('💾 Step 3: Writing master datasets...');
        await writeMasterWords(enrichedWords, config);
        await writeMasterSentences(enrichedSentences, config);
        console.log('   Master datasets written\n');
      } else {
        console.log('💾 Step 3: [DRY RUN] Would write master datasets\n');
      }
    }

    // Stage: TTS Generation
    if (flags.stage === 'all' || flags.stage === 'tts') {
      if (enrichedWords.length === 0 && enrichedSentences.length === 0) {
        console.log('⏭️  Step 4: Skipping TTS (no enriched data available)\n');
      } else {
        console.log('🎤 Step 4: Generating TTS audio...');
        const jobs = planTTSJobs(enrichedWords, enrichedSentences, config);
        console.log(`   Created ${jobs.length} TTS jobs`);
        
        if (!flags.dryRun) {
          const result = await runTTSJobs(jobs, { concurrency: 4 });
          console.log(
            `   TTS audio generation complete: ${result.successIds.length} synthesized, ${result.skippedIds.length} skipped, ${result.failedIds.length} failed\n`
          );
        } else {
          console.log('   [DRY RUN] Would generate TTS audio files\n');
        }
      }
    }

    // Stage: Build Audio Index
    if (flags.stage === 'all' || flags.stage === 'index') {
      if (enrichedWords.length === 0 && enrichedSentences.length === 0) {
        console.log('⏭️  Step 5: Skipping audio index (no enriched data available)\n');
      } else {
        console.log('📇 Step 5: Building audio index...');
        audioIndexEntries = await buildAudioIndex({
          words: enrichedWords,
          sentences: enrichedSentences,
          config,
        });
        
        if (!flags.dryRun) {
          await writeAudioIndex(audioIndexEntries, config);
          console.log(`   Audio index built with ${audioIndexEntries.length} entries\n`);
        } else {
          console.log(`   [DRY RUN] Would write audio index with ${audioIndexEntries.length} entries\n`);
        }
      }
    }

    // Stage: Generate Assessment Fixtures
    if (flags.stage === 'all' || flags.stage === 'fixtures') {
      if (enrichedSentences.length === 0 && enrichedWords.length === 0) {
        console.log('⏭️  Step 6: Skipping assessment fixtures (no enriched data available)\n');
      } else {
        console.log('🧪 Step 6: Generating assessment fixtures...');
        if (!flags.dryRun) {
          await generatePronunciationFixtures({
            sentences: enrichedSentences,
            words: enrichedWords,
            config,
            limit: 10, // Default limit
          });
          console.log('   Assessment fixtures generated\n');
        } else {
          console.log('   [DRY RUN] Would generate assessment fixtures\n');
        }
      }
    }

    // Stage: Validate
    if (flags.stage === 'all' || flags.stage === 'validate') {
      // Load enriched data if not already loaded
      if (enrichedWords.length === 0 && enrichedSentences.length === 0) {
        // Try to load from master files
        try {
          const masterWordsPath = path.join(process.cwd(), config.paths.masterWordsPath);
          const masterSentencesPath = path.join(process.cwd(), config.paths.masterSentencesPath);
          
          const wordsContent = await fs.readFile(masterWordsPath, 'utf-8');
          const sentencesContent = await fs.readFile(masterSentencesPath, 'utf-8');
          
          enrichedWords = JSON.parse(wordsContent) as EnrichedWord[];
          enrichedSentences = JSON.parse(sentencesContent) as EnrichedSentence[];
          
          console.log(`   Loaded ${enrichedWords.length} words and ${enrichedSentences.length} sentences from master files\n`);
        } catch (error) {
          console.log(`⚠️  Step 7: Cannot load master datasets for validation: ${error instanceof Error ? error.message : String(error)}\n`);
          console.log('   Run --stage=enrich first to generate master datasets.\n');
          return;
        }
      }
      
      // Load audio index if not already built
      if (audioIndexEntries.length === 0) {
        // Try to load from file if it exists
        try {
          const audioIndexPath = path.join(process.cwd(), config.paths.audioIndexPath);
          const audioIndexContent = await fs.readFile(audioIndexPath, 'utf-8');
          const audioIndex = JSON.parse(audioIndexContent) as AudioIndex;
          
          // Convert AudioIndex (old format) to AudioIndexEntryExtended[]
          // Map old format to extended format
          audioIndexEntries = Object.entries(audioIndex).map(([id, entry]) => ({
            id,
            type: entry.type,
            sourceId: entry.sourceId,
            textPt: entry.textPt,
            textEn: entry.textEn,
            ptbr: entry.ptbr,
            voice: 'ptbr', // Default voice identifier
            path: entry.ptbr?.male || entry.ptbr?.female || '',
            text: entry.textPt, // Use textPt as text
          })) as AudioIndexEntryExtended[];
          
          console.log(`   Loaded ${audioIndexEntries.length} audio index entries from file\n`);
        } catch (error) {
          console.log(`⚠️  Step 7: Cannot load audio index: ${error instanceof Error ? error.message : String(error)}\n`);
          console.log('   Run --stage=index first to generate audio index.\n');
          return;
        }
      }
      
      console.log('✅ Step 7: Validating data...');
      const report = validateGeneratedData({
        words: enrichedWords,
        sentences: enrichedSentences,
        audioIndex: audioIndexEntries,
        config,
      });
      
      logValidationReport(report);
      
      if (!flags.dryRun) {
        assertValidOrThrow(report);
      } else {
        console.log('   [DRY RUN] Would assert validation (skipped)\n');
      }
    }

    // Final summary
    if (flags.stage === 'all') {
      console.log('='.repeat(60));
      console.log('📊 Pipeline Summary');
      console.log('='.repeat(60));
      console.log(`Total Words: ${enrichedWords.length}`);
      console.log(`Total Sentences: ${enrichedSentences.length}`);
      console.log(`Audio Index Entries: ${audioIndexEntries.length}`);
      console.log('='.repeat(60));
      console.log('✅ Pipeline completed successfully!');
      console.log('');
    }
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
