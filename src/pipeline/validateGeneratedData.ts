/**
 * Validation layer for the content generation pipeline.
 * 
 * Validates enriched data (words and sentences) against the audio index for consistency.
 * Checks for missing audio files, missing phonemes, invalid word references, and more.
 * 
 * The validator operates on in-memory arrays and does not perform file I/O itself.
 * The orchestrator should load the data and pass it to the validator, then use
 * logValidationReport() for console output or writeValidationReport() for file output.
 * 
 * Note: Use assertValidOrThrow() to exit with non-zero status code on critical errors.
 * This allows CI/CD pipelines to fail on data quality issues.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type { EnrichedWord, EnrichedSentence, AudioIndexEntryExtended, ValidationReport } from '../types/contentGeneration';
import type { GenerationPipelineConfig } from '../../config/generationPipeline.config';
import { getPhonemeById } from '../lib/phonemeMetadata';

const NASAL_VOWEL_IDS = new Set(['AN_NASAL', 'EN_NASAL', 'IN_NASAL', 'ON_NASAL', 'UN_NASAL']);
const PATTERN_VOWELS = new Set([
  'a', 'á', 'à', 'â', 'ã',
  'e', 'é', 'ê',
  'i', 'í',
  'o', 'ó', 'ô', 'õ',
  'u', 'ú',
]);
const SOFT_C_TRIGGERS = new Set(['e', 'é', 'ê', 'i', 'í']);

/**
 * Detects whether the orthography contains a vowel + coda m/n (word-final or
 * pre-consonant), which pt-BR always realises as a nasal vowel. Mirrors the coda
 * logic in phonemeMapper (intervocalic m/n and the "nh" digraph are excluded).
 */
function hasNasalCodaPattern(text: string): boolean {
  for (let i = 0; i < text.length - 1; i++) {
    if (!PATTERN_VOWELS.has(text[i])) continue;
    const next = text[i + 1];
    if (next !== 'm' && next !== 'n') continue;
    const after = i + 2 < text.length ? text[i + 2] : '';
    const isNhDigraph = next === 'n' && after === 'h';
    const isCoda = !isNhDigraph && (after === '' || after === ' ' || !PATTERN_VOWELS.has(after));
    if (isCoda) return true;
  }
  return false;
}

/** True if the word contains a soft-c (ce/ci) or a cedilla, both of which yield /s/. */
function hasSoftCOrCedilla(text: string): boolean {
  if (text.includes('ç')) return true;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === 'c' && SOFT_C_TRIGGERS.has(text[i + 1])) return true;
  }
  return false;
}

/** True if the word contains "qu" before e/i, where the u is silent but /k/ remains. */
function hasQuBeforeFrontVowel(text: string): boolean {
  for (let i = 0; i < text.length - 2; i++) {
    if (text[i] === 'q' && text[i + 1] === 'u' && SOFT_C_TRIGGERS.has(text[i + 2])) return true;
  }
  return false;
}

/** True if `letter` (t or d) is directly followed by an orthographic i/í somewhere. */
function hasConsonantBeforeI(text: string, letter: string): boolean {
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === letter && (text[i + 1] === 'i' || text[i + 1] === 'í')) return true;
  }
  return false;
}

/**
 * Pattern-level phoneme validation: asserts that a word's generated phonemes are
 * consistent with unambiguous pt-BR orthographic rules. Catches G2P regressions
 * such as a nasal coda that failed to nasalise or "ch" that failed to map to SH.
 *
 * @param words - Words to check (needs id, normalizedText/text, and phonemes)
 * @returns Array of human-readable violation messages (empty when all pass)
 */
export function validatePhonemePatterns(
  words: Array<{ id: string; normalizedText?: string; text?: string; phonemes?: string[] }>
): string[] {
  const violations: string[] = [];

  for (const word of words) {
    const text = (word.normalizedText ?? word.text ?? '').toLowerCase();
    const phonemes = word.phonemes ?? [];
    if (!text) continue;

    // (a) vowel + coda m/n must produce a nasal vowel
    if (hasNasalCodaPattern(text) && !phonemes.some((p) => NASAL_VOWEL_IDS.has(p))) {
      violations.push(`${word.id} ("${text}"): nasal coda present but no *_NASAL phoneme in [${phonemes.join(', ')}]`);
    }

    // (b) "ch" must produce SH
    if (text.includes('ch') && !phonemes.includes('SH')) {
      violations.push(`${word.id} ("${text}"): contains "ch" but no SH phoneme in [${phonemes.join(', ')}]`);
    }

    // (c) soft c (ce/ci) or ç must produce S
    if (hasSoftCOrCedilla(text) && !phonemes.includes('S')) {
      violations.push(`${word.id} ("${text}"): soft c / ç present but no S phoneme in [${phonemes.join(', ')}]`);
    }

    // (d) "qu" before e/i must keep K
    if (hasQuBeforeFrontVowel(text) && !phonemes.includes('K')) {
      violations.push(`${word.id} ("${text}"): "qu"+e/i present but no K phoneme in [${phonemes.join(', ')}]`);
    }

    // (e) "rr" digraph must produce HH (strong guttural rhotic)
    if (text.includes('rr') && !phonemes.includes('HH')) {
      violations.push(`${word.id} ("${text}"): contains "rr" but no HH phoneme in [${phonemes.join(', ')}]`);
    }

    // (f) word-initial "r" must render as HH (first phoneme)
    if (text.startsWith('r') && phonemes[0] !== 'HH') {
      violations.push(`${word.id} ("${text}"): word-initial "r" but first phoneme is not HH in [${phonemes.join(', ')}]`);
    }

    // (g) orthographic "ti"/"di" must affricate to CH/JH respectively
    if (hasConsonantBeforeI(text, 't') && !phonemes.includes('CH')) {
      violations.push(`${word.id} ("${text}"): "ti" present but no CH phoneme in [${phonemes.join(', ')}]`);
    }
    if (hasConsonantBeforeI(text, 'd') && !phonemes.includes('JH')) {
      violations.push(`${word.id} ("${text}"): "di" present but no JH phoneme in [${phonemes.join(', ')}]`);
    }
  }

  return violations;
}

/**
 * Validates generated data against expectations and consistency checks.
 * 
 * Checks performed:
 * - Count validation: compare word/sentence counts to config.limits (if set)
 * - Missing phoneme sequences: words without phonemes array or empty array
 * - Missing IPA: words without IPA (warning, not fatal)
 * - Missing audio entries: items with no corresponding audio index entry
 * - Invalid word references: sentence wordRefs that refer to non-existent word IDs
 * - Missing phoneme IDs: phonemes not found in phoneme_metadata.json
 * 
 * @param params - Validation parameters
 * @param params.words - Array of enriched words
 * @param params.sentences - Array of enriched sentences
 * @param params.audioIndex - Array of audio index entries (extended format)
 * @param params.config - Generation pipeline configuration
 * @returns ValidationReport with counts and lists of issues
 */
export function validateGeneratedData(params: {
  words: EnrichedWord[];
  sentences: EnrichedSentence[];
  audioIndex: AudioIndexEntryExtended[];
  config: GenerationPipelineConfig;
}): ValidationReport {
  const { words, sentences, audioIndex, config } = params;
  
  const report: ValidationReport = {
    wordCount: words.length,
    sentenceCount: sentences.length,
    audioVariantCount: audioIndex.length,
    missingAudioIds: [],
    missingPhonemeIds: [],
    invalidWordRefs: [],
    phonemePatternViolations: [],
    otherErrors: [],
  };
  
  // Create lookup maps for efficient checking
  const audioIndexMap = new Map<string, AudioIndexEntryExtended>();
  for (const entry of audioIndex) {
    audioIndexMap.set(entry.id, entry);
  }
  
  const wordIdMap = new Map<string, EnrichedWord>();
  for (const word of words) {
    wordIdMap.set(word.id, word);
  }
  
  // Count validation (if limits are set)
  if (config.limits.maxWords !== undefined) {
    if (words.length > config.limits.maxWords) {
      report.otherErrors?.push(
        `Word count (${words.length}) exceeds configured limit (${config.limits.maxWords})`
      );
    }
  }
  
  if (config.limits.maxSentences !== undefined) {
    if (sentences.length > config.limits.maxSentences) {
      report.otherErrors?.push(
        `Sentence count (${sentences.length}) exceeds configured limit (${config.limits.maxSentences})`
      );
    }
  }
  
  // Validate words
  for (const word of words) {
    // Check for audio index entry
    const audioEntry = audioIndexMap.get(word.id);
    if (!audioEntry) {
      report.missingAudioIds.push(word.id);
    }
    
    // Check for phoneme sequences
    if (!word.phonemes || word.phonemes.length === 0) {
      report.missingPhonemeIds.push(word.id);
    } else {
      // Check if phoneme IDs exist in phoneme_metadata.json (canonical source)
      // NOTE: Currently non-blocking (warnings only). Strict validation will be enabled later.
      for (const phonemeId of word.phonemes) {
        const phonemeMetadata = getPhonemeById(phonemeId);
        if (!phonemeMetadata) {
          // Missing phoneme ID in canonical metadata - log as warning (non-critical)
          // TODO: Enable strict validation in future pipeline runs
          if (!report.otherErrors) {
            report.otherErrors = [];
          }
          const warningMsg = `WARNING: Phoneme ID "${phonemeId}" not found in phoneme_metadata.json (word: ${word.id})`;
          if (!report.otherErrors.includes(warningMsg)) {
            report.otherErrors.push(warningMsg);
          }
        }
      }
    }
    
    // Missing IPA is a warning (not fatal), so we don't add it to critical errors
    // But we could track it in otherErrors if needed
  }
  
  // Pattern-level phoneme validation (nasal codas, ch→SH, soft c/ç→S, qu→K).
  // Guards against G2P regressions in the generated phoneme arrays.
  report.phonemePatternViolations = validatePhonemePatterns(words);

  // Validate sentences
  for (const sentence of sentences) {
    // Check for audio index entry
    const audioEntry = audioIndexMap.get(sentence.id);
    if (!audioEntry) {
      report.missingAudioIds.push(sentence.id);
    }
    
    // Check word references
    if (sentence.wordRefs && sentence.wordRefs.length > 0) {
      for (const wordRef of sentence.wordRefs) {
        if (!wordIdMap.has(wordRef.wordId)) {
          // Invalid word reference - word ID doesn't exist
          report.invalidWordRefs.push(sentence.id);
          break; // Only add sentence ID once
        }
      }
    }
  }
  
  return report;
}

/**
 * Determines if the validation report has critical errors.
 * 
 * Critical errors are:
 * - Missing audio entries (items can't be used without audio)
 * - Missing phoneme sequences (words need phonemes for pronunciation practice)
 * - Invalid word references (broken sentence-word relationships)
 * 
 * Non-critical (warnings):
 * - Missing IPA (nice to have but not required)
 * - Count mismatches (informational)
 * - Missing phoneme IDs in phoneme_metadata.json (data quality issue but not blocking)
 *   NOTE: Currently non-blocking. Strict validation will be enabled in future pipeline runs.
 * 
 * @param report - Validation report
 * @returns true if there are critical errors
 */
function hasCriticalErrors(report: ValidationReport): boolean {
  return (
    report.missingAudioIds.length > 0 ||
    report.missingPhonemeIds.length > 0 ||
    report.invalidWordRefs.length > 0 ||
    (report.phonemePatternViolations?.length ?? 0) > 0
  );
}

/**
 * Logs a validation report to the console in a human-readable format.
 * 
 * Prints:
 * - Overall counts and summary
 * - Critical errors (if any) clearly marked
 * - Warnings and non-critical issues
 * - Lists of affected IDs (truncated if too long)
 * 
 * @param report - ValidationReport from validateGeneratedData()
 */
export function logValidationReport(report: ValidationReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 Validation Report');
  console.log('='.repeat(60));
  console.log('');
  
  // Summary counts
  console.log('Summary:');
  console.log(`  Words: ${report.wordCount}`);
  console.log(`  Sentences: ${report.sentenceCount}`);
  console.log(`  Audio Variants: ${report.audioVariantCount}`);
  console.log('');
  
  // Check for critical errors
  const critical = hasCriticalErrors(report);
  
  if (critical) {
    console.log('❌ CRITICAL ERRORS FOUND:');
    console.log('');
  } else {
    console.log('✅ No critical errors found.');
    console.log('');
  }
  
  // Missing audio entries (CRITICAL)
  if (report.missingAudioIds.length > 0) {
    console.log(`❌ Missing Audio Entries: ${report.missingAudioIds.length} items`);
    if (report.missingAudioIds.length <= 10) {
      console.log('   IDs:', report.missingAudioIds.join(', '));
    } else {
      console.log('   First 10 IDs:', report.missingAudioIds.slice(0, 10).join(', '));
      console.log(`   ... and ${report.missingAudioIds.length - 10} more`);
    }
    console.log('');
  }
  
  // Missing phoneme sequences (CRITICAL)
  if (report.missingPhonemeIds.length > 0) {
    console.log(`❌ Missing Phoneme Sequences: ${report.missingPhonemeIds.length} words`);
    if (report.missingPhonemeIds.length <= 10) {
      console.log('   Word IDs:', report.missingPhonemeIds.join(', '));
    } else {
      console.log('   First 10 IDs:', report.missingPhonemeIds.slice(0, 10).join(', '));
      console.log(`   ... and ${report.missingPhonemeIds.length - 10} more`);
    }
    console.log('');
  }
  
  // Invalid word references (CRITICAL)
  if (report.invalidWordRefs.length > 0) {
    console.log(`❌ Invalid Word References: ${report.invalidWordRefs.length} sentences`);
    if (report.invalidWordRefs.length <= 10) {
      console.log('   Sentence IDs:', report.invalidWordRefs.join(', '));
    } else {
      console.log('   First 10 IDs:', report.invalidWordRefs.slice(0, 10).join(', '));
      console.log(`   ... and ${report.invalidWordRefs.length - 10} more`);
    }
    console.log('');
  }
  
  // Phoneme pattern violations (CRITICAL)
  if (report.phonemePatternViolations && report.phonemePatternViolations.length > 0) {
    console.log(`❌ Phoneme Pattern Violations: ${report.phonemePatternViolations.length} words`);
    const shown = report.phonemePatternViolations.slice(0, 10);
    for (const v of shown) {
      console.log(`   - ${v}`);
    }
    if (report.phonemePatternViolations.length > 10) {
      console.log(`   ... and ${report.phonemePatternViolations.length - 10} more`);
    }
    console.log('');
  }

  // Other errors (warnings/non-critical)
  if (report.otherErrors && report.otherErrors.length > 0) {
    console.log('⚠️  Warnings/Non-Critical Issues:');
    for (const error of report.otherErrors) {
      console.log(`   - ${error}`);
    }
    console.log('');
  }
  
  // Final status
  if (critical) {
    console.log('❌ Validation FAILED - Critical errors must be fixed before proceeding.');
  } else {
    console.log('✅ Validation PASSED - No critical errors found.');
  }
  
  console.log('='.repeat(60));
  console.log('');
}

/**
 * Asserts that the validation report has no critical errors, throwing if it does.
 * 
 * Use this in orchestrator scripts to exit with non-zero status code on critical errors.
 * 
 * @param report - Validation report
 * @throws {Error} If hasCriticalErrors is true, with a descriptive message
 */
export function assertValidOrThrow(report: ValidationReport): void {
  if (hasCriticalErrors(report)) {
    const errors: string[] = [];
    
    if (report.missingAudioIds.length > 0) {
      errors.push(`${report.missingAudioIds.length} items missing audio entries`);
    }
    
    if (report.missingPhonemeIds.length > 0) {
      errors.push(`${report.missingPhonemeIds.length} words missing phoneme sequences`);
    }
    
    if (report.invalidWordRefs.length > 0) {
      errors.push(`${report.invalidWordRefs.length} sentences with invalid word references`);
    }

    if ((report.phonemePatternViolations?.length ?? 0) > 0) {
      errors.push(`${report.phonemePatternViolations!.length} words with phoneme pattern violations`);
    }

    throw new Error(
      `Validation failed with critical errors: ${errors.join('; ')}. ` +
      `Run logValidationReport() for details.`
    );
  }
}

/**
 * Writes a validation report to a markdown file.
 * 
 * Generates a human-readable report with:
 * - Overall counts
 * - Summary of issues (missing audio, phonemes, word refs)
 * - Lists of affected IDs (truncated if too long)
 * 
 * @param result - ValidationResult from validate() (legacy function, kept for backward compatibility)
 */
export async function writeValidationReport(
  result: any
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

