/**
 * TTS job runner for the content generation pipeline.
 * 
 * Executes TTS jobs with concurrency control, retry logic, and failure tracking.
 * 
 * Resuming partial runs:
 * - The runner is idempotent: if an output file already exists and is non-empty, that job is skipped.
 * - To resume a partial run, simply re-run the same job list. Existing files will be
 *   skipped automatically, and only missing files will be synthesized.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { textToSpeechToFile } from './azureTTSClient';
import type { TTSJob } from './audioJobPlanner';

/**
 * Runs TTS jobs with concurrency control.
 * 
 * Processes jobs in batches (concurrency limit), skipping files that already exist.
 * Logs progress and collects successes and failures.
 * 
 * @param jobs - Array of TTSJob entries to process
 * @param options - Optional configuration
 * @param options.concurrency - Maximum number of jobs to process concurrently (default: 4)
 * @returns Promise resolving to success and failure IDs
 */
export async function runTTSJobs(
  jobs: TTSJob[],
  options?: { concurrency?: number }
): Promise<{ successIds: string[]; failedIds: string[]; skippedIds: string[] }> {
  const concurrency = options?.concurrency ?? 4;
  const successIds: string[] = [];
  const failedIds: string[] = [];
  const skippedIds: string[] = [];
  let processed = 0;
  let skipped = 0;

  console.log(`Starting TTS job processing: ${jobs.length} jobs, concurrency: ${concurrency}`);

  // Process jobs in batches
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency);
    const batchPromises = batch.map(async (job) => {
      const outputPath = path.join(process.cwd(), job.outputPath);

      try {
        // textToSpeechToFile handles idempotent behavior (skips if file exists and is non-empty)
        const result = await textToSpeechToFile({
          text: job.text,
          voiceName: job.voiceName,
          outputPath,
        });

        if (result.skipped) {
          skippedIds.push(job.id);
          skipped++;
          return;
        }

        // Check if file exists and is non-empty after synthesis
        try {
          const stats = await fs.stat(outputPath);
          if (stats.size > 0) {
            // File was synthesized successfully
            successIds.push(job.id);
            processed++;
          } else {
            // File exists but is empty (shouldn't happen, but handle it)
            failedIds.push(job.id);
            processed++;
          }
        } catch {
          // File doesn't exist (shouldn't happen after successful synthesis)
          failedIds.push(job.id);
          processed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failedIds.push(job.id);
        processed++;
        console.error(
          `✗ Failed: ${job.itemType} "${job.itemId}" (${job.voiceId}): ${errorMessage}`
        );
      }
    });

    await Promise.all(batchPromises);

    // Log progress every batch
    const totalProcessed = processed + skipped;
    if (totalProcessed % 10 === 0 || totalProcessed === jobs.length) {
      console.log(
        `Progress: ${totalProcessed}/${jobs.length} (${successIds.length} succeeded, ${skipped} skipped, ${failedIds.length} failed)`
      );
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('TTS Job Summary:');
  console.log(`  Total jobs: ${jobs.length}`);
  console.log(`  Succeeded: ${successIds.length}`);
  console.log(`  Skipped (existing): ${skipped}`);
  console.log(`  Failed: ${failedIds.length}`);
  console.log('='.repeat(60));

  return { successIds, failedIds, skippedIds };
}
