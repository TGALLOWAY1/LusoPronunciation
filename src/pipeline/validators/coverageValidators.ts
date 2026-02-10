import dataQualityConfig from '../../../config/dataQuality.config';
import type { DatasetValidationInput, ValidationIssue } from './types';

export function validateCoverage(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const minWords = dataQualityConfig.coverage.minItemsPerCategory.words;
  const minSentences = dataQualityConfig.coverage.minItemsPerCategory.sentences;

  const wordCountByCategory = new Map<string, number>();
  for (const word of input.words) {
    wordCountByCategory.set(word.category, (wordCountByCategory.get(word.category) ?? 0) + 1);
  }

  const sentenceCountByCategory = new Map<string, number>();
  for (const sentence of input.sentences) {
    sentenceCountByCategory.set(sentence.category, (sentenceCountByCategory.get(sentence.category) ?? 0) + 1);
  }

  for (const category of input.categories) {
    const wordCount = wordCountByCategory.get(category.id) ?? 0;
    const sentenceCount = sentenceCountByCategory.get(category.id) ?? 0;
    if (wordCount > 0 && wordCount < minWords) {
      issues.push({
        severity: 'error',
        code: 'coverage.category.words',
        itemId: category.id,
        message: `Category "${category.id}" has ${wordCount} words, minimum is ${minWords}.`,
      });
    }
    if (sentenceCount > 0 && sentenceCount < minSentences) {
      issues.push({
        severity: 'error',
        code: 'coverage.category.sentences',
        itemId: category.id,
        message: `Category "${category.id}" has ${sentenceCount} sentences, minimum is ${minSentences}.`,
      });
    }
    if (wordCount === 0 && sentenceCount === 0) {
      issues.push({
        severity: 'warning',
        code: 'coverage.category.empty',
        itemId: category.id,
        message: `Category "${category.id}" has no words or sentences.`,
      });
    }
  }

  const tipsByPhoneme = new Map<string, number>();
  for (const tip of input.pronunciationTips) {
    tipsByPhoneme.set(tip.phonemeId, (tipsByPhoneme.get(tip.phonemeId) ?? 0) + 1);
  }

  const minTips = dataQualityConfig.coverage.minTipsPerPhoneme;
  const minExamples = dataQualityConfig.coverage.minExamplesPerPhoneme;

  for (const phoneme of input.phonemes) {
    const tipCount = tipsByPhoneme.get(phoneme.id) ?? 0;
    const exampleCount = Array.isArray(phoneme.exampleWords) ? phoneme.exampleWords.length : 0;
    if (tipCount < minTips) {
      issues.push({
        severity: 'error',
        code: 'coverage.phoneme.tips',
        itemId: phoneme.id,
        message: `Phoneme "${phoneme.id}" has ${tipCount} tips, minimum is ${minTips}.`,
      });
    }
    if (exampleCount < minExamples) {
      issues.push({
        severity: 'error',
        code: 'coverage.phoneme.examples',
        itemId: phoneme.id,
        message: `Phoneme "${phoneme.id}" has ${exampleCount} examples, minimum is ${minExamples}.`,
      });
    }
  }

  return issues;
}
