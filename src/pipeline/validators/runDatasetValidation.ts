import { validateAzureCompatibility } from './azureCompatibilityValidators';
import { validateCoverage } from './coverageValidators';
import { validateDeduping } from './dedupeValidators';
import { validateIntegrity } from './integrityValidators';
import { validateLocaleConsistency } from './localeValidators';
import { validateCoreSchemas } from './schemaValidators';
import type { DatasetValidationInput, DatasetValidationReport, ValidationIssue } from './types';

export function runDatasetValidation(
  version: string,
  input: DatasetValidationInput
): DatasetValidationReport {
  const allIssues: ValidationIssue[] = [];

  allIssues.push(...validateCoreSchemas(input));
  allIssues.push(...validateLocaleConsistency(input));
  allIssues.push(...validateDeduping(input));
  allIssues.push(...validateCoverage(input));
  allIssues.push(...validateIntegrity(input));
  allIssues.push(...validateAzureCompatibility(input));

  const errors = allIssues.filter((issue) => issue.severity === 'error');
  const warnings = allIssues.filter((issue) => issue.severity === 'warning');

  return {
    generatedAt: new Date().toISOString(),
    version,
    summary: {
      errors: errors.length,
      warnings: warnings.length,
      words: input.words.length,
      sentences: input.sentences.length,
      categories: input.categories.length,
      phonemes: input.phonemes.length,
      tips: input.pronunciationTips.length,
      audioIndexEntries: Object.keys(input.audioIndex).length,
    },
    errors,
    warnings,
  };
}
