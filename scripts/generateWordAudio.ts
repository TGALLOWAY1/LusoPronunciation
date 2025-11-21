#!/usr/bin/env node

/**
 * Generate Azure TTS Audio for All Words
 * 
 * TODO: This script will be replaced or wrapped by the new unified pipeline.
 * See: src/pipeline/azureTTSClient.ts, src/pipeline/audioJobPlanner.ts, src/pipeline/runTTSJobs.ts
 * 
 * Synthesizes pronunciation audio for every word in words.json
 * using male and female Brazilian Portuguese voices.
 * 
 * Features:
 * - Resumable (skips existing files)
 * - Handles throttling with retries and exponential backoff
 * - Sequential processing with rate limiting
 * - Voice selection (male/female/both)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { config } from 'dotenv';

// Load .env file (but don't override existing env vars)
config({ override: false });

// Voice configuration
const MALE_VOICE = 'pt-BR-AntonioNeural';
const FEMALE_VOICE = 'pt-BR-FranciscaNeural';

// Retry configuration
const MAX_RETRIES = 3;
const DELAY_BETWEEN_REQUESTS_MS = 300; // Rate limiting delay

// Types
type WordEntry = {
  id: string;
  pt: string;
  en?: string;
  pos?: string;
  difficulty?: number;
  difficult_for_english?: boolean;
  pronunciation_notes?: string;
};

type WordsJson = {
  language_pair: string;
  version: string;
  categories: Array<{
    id: string;
    label_en: string;
    label_pt: string;
    words: WordEntry[];
  }>;
};

type VoiceOption = 'male' | 'female' | 'both';

type FailedEntry = {
  wordId: string;
  voice: string;
};

// Global speech config (created once, reused)
let speechConfig: sdk.SpeechConfig | null = null;

/**
 * Initialize speech config (called once)
 */
function initializeSpeechConfig(): void {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new Error(
      'Missing Azure Speech credentials. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION environment variables.'
    );
  }

  speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
  speechConfig.speechSynthesisLanguage = 'pt-BR';
}

/**
 * Delay helper for rate limiting and backoff
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize token for filename (replace spaces with underscores)
 */
function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"()…«»""'']/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

/**
 * Load words.json and extract all word entries
 */
function loadWords(): WordEntry[] {
  const wordsPath = path.resolve(__dirname, '..', 'STATIC DATA', 'words.json');
  
  if (!fs.existsSync(wordsPath)) {
    throw new Error(`Words file not found: ${wordsPath}`);
  }

  const content = fs.readFileSync(wordsPath, 'utf-8');
  const data: WordsJson = JSON.parse(content);

  // Flatten categories into a single array
  const words: WordEntry[] = [];
  for (const category of data.categories) {
    words.push(...category.words);
  }

  return words;
}

/**
 * Single synthesis attempt (wraps Speech SDK call)
 */
async function synthesizeOnce(
  text: string,
  voiceName: string,
  outputPath: string
): Promise<void> {
  if (!speechConfig) {
    throw new Error('Speech config not initialized');
  }

  // Ensure target directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Set voice for this request
  speechConfig.speechSynthesisVoiceName = voiceName;

  // Create audio config for WAV file output
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);

  // Create synthesizer
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  try {
    const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (res) => resolve(res),
        (err) => reject(err)
      );
    });

    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      return;
    }

    if (result.reason === sdk.ResultReason.Canceled) {
      const details = sdk.CancellationDetails.fromResult(result);
      const errorDetails = details.errorDetails || 'Unknown error';
      throw new Error(
        `Synthesis canceled: ${details.reason} – ${errorDetails}`
      );
    }

    throw new Error(`Unexpected synthesis result: ${result.reason}`);
  } finally {
    synthesizer.close();
  }
}

/**
 * Synthesize with retries and exponential backoff
 */
async function synthesizeWithRetries(
  text: string,
  voiceName: string,
  outputPath: string
): Promise<boolean> {
  let attempt = 0;
  let backoffMs = 1000; // Start at 1 second

  while (attempt <= MAX_RETRIES) {
    try {
      await synthesizeOnce(text, voiceName, outputPath);
      return true;
    } catch (err) {
      attempt++;
      const isLastAttempt = attempt > MAX_RETRIES;

      const message = (err as Error).message ?? String(err);

      // Log the error
      console.warn(
        `[TTS ERROR] attempt ${attempt} for "${text.slice(0, 30)}..." (${voiceName}) failed:`,
        message
      );

      // If this was our last attempt, give up
      if (isLastAttempt) {
        return false;
      }

      // If it looks like throttling / quota / 429, wait longer
      const looksLikeThrottling =
        message.includes('429') ||
        message.toLowerCase().includes('throttl') ||
        message.toLowerCase().includes('quota') ||
        message.toLowerCase().includes('rate limit');

      if (looksLikeThrottling) {
        console.warn(
          `[TTS] Likely throttled, backing off for ${backoffMs}ms before retry...`
        );
        await delay(backoffMs);
        backoffMs *= 2; // Exponential backoff
      } else {
        // For other transient errors, still wait a bit, but smaller
        console.warn(
          `[TTS] Transient error, backing off for 1000ms before retry...`
        );
        await delay(1000);
      }
    }
  }

  return false;
}

/**
 * Parse CLI arguments
 */
function parseArgs(): { force: boolean; voice: VoiceOption } {
  const args = process.argv.slice(2);
  
  const force = args.includes('--force');
  
  let voice: VoiceOption = 'both';
  const voiceArg = args.find(arg => arg.startsWith('--voice='));
  if (voiceArg) {
    const voiceValue = voiceArg.split('=')[1]?.toLowerCase();
    if (voiceValue === 'male' || voiceValue === 'female' || voiceValue === 'both') {
      voice = voiceValue as VoiceOption;
    } else {
      console.warn(`Invalid --voice value: ${voiceValue}. Using 'both' as default.`);
    }
  }

  return { force, voice };
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse CLI arguments
    const { force, voice } = parseArgs();

    console.log('🎤 Azure TTS Word Audio Generation\n');
    console.log('='.repeat(60));

    // Initialize speech config
    initializeSpeechConfig();

    const speechKey = process.env.AZURE_SPEECH_KEY!;
    const speechRegion = process.env.AZURE_SPEECH_REGION!;

    console.log('Azure Speech Configuration:');
    console.log(`  Region: ${speechRegion}`);
    console.log(`  Key: ${speechKey.slice(0, 5)}*****`);
    console.log(`  Male Voice: ${MALE_VOICE}`);
    console.log(`  Female Voice: ${FEMALE_VOICE}`);
    console.log(`  Force Mode: ${force ? 'ON (will overwrite existing files)' : 'OFF (will skip existing files)'}`);
    console.log(`  Voice Selection: ${voice}`);
    console.log(`  Max Retries: ${MAX_RETRIES}`);
    console.log(`  Delay Between Requests: ${DELAY_BETWEEN_REQUESTS_MS}ms`);
    console.log('='.repeat(60) + '\n');

    // Load words
    console.log('Loading words from STATIC DATA/words.json...');
    const words = loadWords();
    console.log(`Found ${words.length} words\n`);

    // Setup output directory
    const outputDir = path.resolve(__dirname, '..', 'public', 'audio', 'words');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created output directory: ${outputDir}\n`);
    }

    // Process each word
    let total = 0;
    let skipped = 0;
    let succeeded = 0;
    const failed: FailedEntry[] = [];

    for (let index = 0; index < words.length; index++) {
      const word = words[index];
      const baseName = word.id || normalizeToken(word.pt).replace(/\s+/g, '_');
      const malePath = path.join(outputDir, `${baseName}_male.wav`);
      const femalePath = path.join(outputDir, `${baseName}_female.wav`);

      const wordText = word.pt;
      const displayText = wordText.length > 40 ? wordText.slice(0, 40) + '...' : wordText;

      console.log(`[${index + 1}/${words.length}] Processing: ${baseName}`);
      console.log(`  Text: ${wordText}`);

      // Process male voice
      if (voice === 'male' || voice === 'both') {
        total++;
        if (fs.existsSync(malePath) && !force) {
          console.log(`  ⊘ Skipping male (file exists)`);
          skipped++;
        } else {
          console.log(`  Synthesizing "${displayText}" (male)...`);
          const success = await synthesizeWithRetries(wordText, MALE_VOICE, malePath);
          if (success) {
            console.log(`  ✔ Generated: ${path.basename(malePath)}`);
            succeeded++;
            // Rate limiting delay after successful synthesis
            await delay(DELAY_BETWEEN_REQUESTS_MS);
          } else {
            console.error(`  ✗ Failed to generate male audio after ${MAX_RETRIES} retries`);
            failed.push({ wordId: baseName, voice: 'male' });
          }
        }
      }

      // Process female voice
      if (voice === 'female' || voice === 'both') {
        total++;
        if (fs.existsSync(femalePath) && !force) {
          console.log(`  ⊘ Skipping female (file exists)`);
          skipped++;
        } else {
          console.log(`  Synthesizing "${displayText}" (female)...`);
          const success = await synthesizeWithRetries(wordText, FEMALE_VOICE, femalePath);
          if (success) {
            console.log(`  ✔ Generated: ${path.basename(femalePath)}`);
            succeeded++;
            // Rate limiting delay after successful synthesis
            await delay(DELAY_BETWEEN_REQUESTS_MS);
          } else {
            console.error(`  ✗ Failed to generate female audio after ${MAX_RETRIES} retries`);
            failed.push({ wordId: baseName, voice: 'female' });
          }
        }
      }

      console.log(''); // Blank line between words
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('========== TTS SUMMARY ==========');
    console.log(`Total words processed: ${words.length}`);
    console.log(`Total audio files attempted: ${total}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Skipped (already had files): ${skipped}`);
    console.log(`Failed: ${failed.length}`);

    if (failed.length > 0) {
      console.log('\nFailed entries:');
      for (const f of failed) {
        console.log(`  - ${f.wordId} (${f.voice})`);
      }
      console.log('\nYou can re-run the script to retry failed entries.');
      process.exitCode = 1;
    } else {
      console.log('\n✅ All audio files generated successfully!');
    }
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Fatal error:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Unhandled error:', error);
  process.exit(1);
});
