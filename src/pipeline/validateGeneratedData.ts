/**
 * Validation layer for the content generation pipeline.
 * 
 * Validates master data (words and sentences) against the audio index for consistency.
 * Checks for missing audio files, missing phonemes, and missing word references.
 * 
 * The validator operates on in-memory arrays and does not perform file I/O itself.
 * The orchestrator should load the data and pass it to the validator, then use
 * writeValidationReport() to generate a human-readable report.
 * 
 * Note: The pipeline's orchestrator may choose to exit with a non-zero status code
 * if certain validation thresholds are exceeded (e.g., too many missing audio files).
 * This allows CI/CD pipelines to fail on data quality issues.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { MasterWord, MasterSentence } from '../types/contentGeneration';
import { AudioIndex } from '../lib/types';

export interface ValidationResult {
  totalWords: number;
  totalSentences: number;
  wordsMissingAudio: string[];
  sentencesMissingAudio: string[];
  wordsMissingPhonemes: string[];
  sentencesMissingWordRefs: string[];
}

/**
 * Validates master data against the audio index for consistency.
 * 
 * Checks:
 * - Words and sentences have corresponding audio index entries with valid paths
 * - Words have phoneme data
 * - Sentences have word references
 * 
 * @param words - Array of MasterWord entries
 * @param sentences - Array of MasterSentence entries
 * @param audioIndex - AudioIndex object (keyed by item ID)
 * @returns ValidationResult with counts and lists of issues
 */
export function validate(
  words: MasterWord[],
  sentences: MasterSentence[],
  audioIndex: AudioIndex
): ValidationResult {
  const result: ValidationResult = {
    totalWords: words.length,
    totalSentences: sentences.length,
    wordsMissingAudio: [],
    sentencesMissingAudio: [],
    wordsMissingPhonemes: [],
    sentencesMissingWordRefs: [],
  };

  // Validate words
  for (const word of words) {
    // Check for audio index entry
    const audioEntry = audioIndex[word.id];
    if (!audioEntry) {
      result.wordsMissingAudio.push(word.id);
    } else {
      // Check if audio paths are valid (non-empty)
      const hasValidPath =
        (audioEntry.ptbr.male && audioEntry.ptbr.male.trim().length > 0) ||
        (audioEntry.ptbr.female && audioEntry.ptbr.female.trim().length > 0);
      if (!hasValidPath) {
        result.wordsMissingAudio.push(word.id);
      }
    }

    // Check for phonemes
    if (!word.phonemes || word.phonemes.length === 0) {
      result.wordsMissingPhonemes.push(word.id);
    }
  }

  // Validate sentences
  for (const sentence of sentences) {
    // Check for audio index entry
    const audioEntry = audioIndex[sentence.id];
    if (!audioEntry) {
      result.sentencesMissingAudio.push(sentence.id);
    } else {
      // Check if audio paths are valid (non-empty)
      const hasValidPath =
        (audioEntry.ptbr.male && audioEntry.ptbr.male.trim().length > 0) ||
        (audioEntry.ptbr.female && audioEntry.ptbr.female.trim().length > 0);
      if (!hasValidPath) {
        result.sentencesMissingAudio.push(sentence.id);
      }
    }

    // Check for word references
    if (!sentence.wordRefs || sentence.wordRefs.length === 0) {
      result.sentencesMissingWordRefs.push(sentence.id);
    }
  }

  return result;
}

/**
 * Writes a validation report to a markdown file.
 * 
 * Generates a human-readable report with:
 * - Overall counts
 * - Summary of issues (missing audio, phonemes, word refs)
 * - Lists of affected IDs (truncated if too long)
 * 
 * @param result - ValidationResult from validate()
 */
export async function writeValidationReport(
  result: ValidationResult
): Promise<void> {
  const outputDir = path.join(process.cwd(), 'data', 'generated');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, 'generation_report.md');

  // Build markdown report
  const lines: string[] = [];

  lines.push('# Content Generation Validation Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  // Overall summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Total Words**: ${result.totalWords}`);
  lines.push(`- **Total Sentences**: ${result.totalSentences}`);
  lines.push('');

  // Issues summary
  const totalIssues =
    result.wordsMissingAudio.length +
    result.sentencesMissingAudio.length +
    result.wordsMissingPhonemes.length +
    result.sentencesMissingWordRefs.length;

  if (totalIssues === 0) {
    lines.push('✅ **All validations passed!**');
    lines.push('');
  } else {
    lines.push('## Issues Found');
    lines.push('');
    lines.push(`**Total Issues**: ${totalIssues}`);
    lines.push('');

    // Words missing audio
    if (result.wordsMissingAudio.length > 0) {
      lines.push(`### Words Missing Audio (${result.wordsMissingAudio.length})`);
      lines.push('');
      if (result.wordsMissingAudio.length <= 20) {
        lines.push('IDs:');
        for (const id of result.wordsMissingAudio) {
          lines.push(`- \`${id}\``);
        }
      } else {
        lines.push(`First 20 of ${result.wordsMissingAudio.length} IDs:`);
        for (const id of result.wordsMissingAudio.slice(0, 20)) {
          lines.push(`- \`${id}\``);
        }
        lines.push(`\n... and ${result.wordsMissingAudio.length - 20} more`);
      }
      lines.push('');
    }

    // Sentences missing audio
    if (result.sentencesMissingAudio.length > 0) {
      lines.push(`### Sentences Missing Audio (${result.sentencesMissingAudio.length})`);
      lines.push('');
      if (result.sentencesMissingAudio.length <= 20) {
        lines.push('IDs:');
        for (const id of result.sentencesMissingAudio) {
          lines.push(`- \`${id}\``);
        }
      } else {
        lines.push(`First 20 of ${result.sentencesMissingAudio.length} IDs:`);
        for (const id of result.sentencesMissingAudio.slice(0, 20)) {
          lines.push(`- \`${id}\``);
        }
        lines.push(`\n... and ${result.sentencesMissingAudio.length - 20} more`);
      }
      lines.push('');
    }

    // Words missing phonemes
    if (result.wordsMissingPhonemes.length > 0) {
      lines.push(`### Words Missing Phonemes (${result.wordsMissingPhonemes.length})`);
      lines.push('');
      if (result.wordsMissingPhonemes.length <= 20) {
        lines.push('IDs:');
        for (const id of result.wordsMissingPhonemes) {
          lines.push(`- \`${id}\``);
        }
      } else {
        lines.push(`First 20 of ${result.wordsMissingPhonemes.length} IDs:`);
        for (const id of result.wordsMissingPhonemes.slice(0, 20)) {
          lines.push(`- \`${id}\``);
        }
        lines.push(`\n... and ${result.wordsMissingPhonemes.length - 20} more`);
      }
      lines.push('');
    }

    // Sentences missing word refs
    if (result.sentencesMissingWordRefs.length > 0) {
      lines.push(`### Sentences Missing Word References (${result.sentencesMissingWordRefs.length})`);
      lines.push('');
      if (result.sentencesMissingWordRefs.length <= 20) {
        lines.push('IDs:');
        for (const id of result.sentencesMissingWordRefs) {
          lines.push(`- \`${id}\``);
        }
      } else {
        lines.push(`First 20 of ${result.sentencesMissingWordRefs.length} IDs:`);
        for (const id of result.sentencesMissingWordRefs.slice(0, 20)) {
          lines.push(`- \`${id}\``);
        }
        lines.push(`\n... and ${result.sentencesMissingWordRefs.length - 20} more`);
      }
      lines.push('');
    }
  }

  // Write report
  const reportContent = lines.join('\n');
  await fs.writeFile(outputPath, reportContent, 'utf-8');

  console.log(`Validation report written to: ${outputPath}`);
  console.log(`Total issues found: ${totalIssues}`);
}

