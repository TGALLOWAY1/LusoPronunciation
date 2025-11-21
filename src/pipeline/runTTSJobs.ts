/**
 * TTS job runner for the content generation pipeline.
 * 
 * Executes TTS jobs with concurrency control, retry logic, and failure tracking.
 * 
 * Resuming partial runs:
 * - The runner is idempotent: if an output file already exists, that job is skipped.
 * - To resume a partial run, simply re-run the same job list. Existing files will be
 *   skipped automatically, and only missing files will be synthesized.
 * - Failed jobs are written to data/generated/tts_failures.json for later retry.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { TTSJob } from '../types/contentGeneration';
import { synthesizeToWav } from './azureTTSClient';

interface FailedJob {
  job: TTSJob;
  error: string;
  timestamp: string;
}

/**
 * Runs TTS jobs with concurrency control.
 * 
 * Processes jobs in batches (concurrency limit), skipping files that already exist.
 * Logs progress and collects failures for later retry.
 * 
 * @param jobs - Array of TTSJob entries to process
 * @param concurrency - Maximum number of jobs to process concurrently
 */
export async function runTTSJobs(
  jobs: TTSJob[],
  concurrency: number
): Promise<void> {
  const failed: FailedJob[] = [];
  let processed = 0;
  let skipped = 0;
  let succeeded = 0;

  console.log(`Starting TTS job processing: ${jobs.length} jobs, concurrency: ${concurrency}`);

  // Process jobs in batches
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    const batchPromises = batch.map(async (job) => {
      const outputPath = path.join(process.cwd(), job.outputPath);

      // Check if file already exists (idempotent behavior)
      try {
        await fs.access(outputPath);
        skipped++;
        return;
      } catch {
        // File doesn't exist, proceed with synthesis
      }

      try {
        await synthesizeToWav(job.text, job.voice, outputPath);
        succeeded++;
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failed.push({
          job,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        processed++;
        console.error(
          `✗ Failed: ${job.itemType} "${job.id}" (${job.gender}): ${errorMessage}`
        );
      }
    });

    await Promise.all(batchPromises);

    // Log progress every batch
    const totalProcessed = processed + skipped;
    if (totalProcessed % 10 === 0 || totalProcessed === jobs.length) {
      console.log(
        `Progress: ${totalProcessed}/${jobs.length} (${succeeded} succeeded, ${skipped} skipped, ${failed.length} failed)`
      );
    }
  }

  // Write failures to file if any
  if (failed.length > 0) {
    const failuresDir = path.join(process.cwd(), 'data', 'generated');
    await fs.mkdir(failuresDir, { recursive: true });

    const failuresPath = path.join(failuresDir, 'tts_failures.json');
    await fs.writeFile(
      failuresPath,
      JSON.stringify(failed, null, 2),
      'utf-8'
    );
    console.log(`\n⚠️  ${failed.length} jobs failed. Failures written to: ${failuresPath}`);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('TTS Job Summary:');
  console.log(`  Total jobs: ${jobs.length}`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Failed: ${failed.length}`);
  console.log('='.repeat(60));

  if (failed.length > 0) {
    throw new Error(`${failed.length} TTS jobs failed. Check data/generated/tts_failures.json for details.`);
  }
}

