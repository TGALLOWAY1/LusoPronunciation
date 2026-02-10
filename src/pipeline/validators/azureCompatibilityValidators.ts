import dataQualityConfig from '../../../config/dataQuality.config';
import type { DatasetValidationInput, ValidationIssue } from './types';

function hasInvalidCharacters(text: string): boolean {
  return !dataQualityConfig.azure.allowedTextPattern.test(text);
}

function hasEmoji(text: string): boolean {
  return dataQualityConfig.azure.bannedEmojiPattern.test(text);
}

export function validateAzureCompatibility(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const configIds = new Set(input.azureAssessmentConfigs.map((cfg) => cfg.id));

  for (const word of input.words) {
    const text = String(word.text ?? '');
    if (!text) continue;
    if (text.length > dataQualityConfig.azure.maxWordChars) {
      issues.push({
        severity: 'error',
        code: 'azure.word.max_length',
        itemId: word.id,
        message: `Word exceeds max length (${text.length} > ${dataQualityConfig.azure.maxWordChars}).`,
      });
    }
    if (hasInvalidCharacters(text)) {
      issues.push({
        severity: 'error',
        code: 'azure.word.invalid_chars',
        itemId: word.id,
        message: 'Word contains unsupported characters for Azure prompt text.',
      });
    }
    if (hasEmoji(text)) {
      issues.push({
        severity: 'error',
        code: 'azure.word.emoji',
        itemId: word.id,
        message: 'Word contains emoji, which is not allowed in Azure prompt text.',
      });
    }
    if (!configIds.has(word.azureAssessmentConfigId)) {
      issues.push({
        severity: 'error',
        code: 'azure.word.missing_config',
        itemId: word.id,
        message: `Word references missing AzureAssessmentConfig "${word.azureAssessmentConfigId}".`,
      });
    }
  }

  for (const sentence of input.sentences) {
    const text = String(sentence.text ?? '');
    if (!text) continue;
    if (text.length > dataQualityConfig.azure.maxSentenceChars) {
      issues.push({
        severity: 'error',
        code: 'azure.sentence.max_length',
        itemId: sentence.id,
        message: `Sentence exceeds max length (${text.length} > ${dataQualityConfig.azure.maxSentenceChars}).`,
      });
    }
    if (hasInvalidCharacters(text)) {
      issues.push({
        severity: 'error',
        code: 'azure.sentence.invalid_chars',
        itemId: sentence.id,
        message: 'Sentence contains unsupported characters for Azure prompt text.',
      });
    }
    if (hasEmoji(text)) {
      issues.push({
        severity: 'error',
        code: 'azure.sentence.emoji',
        itemId: sentence.id,
        message: 'Sentence contains emoji, which is not allowed in Azure prompt text.',
      });
    }
    if (!configIds.has(sentence.azureAssessmentConfigId)) {
      issues.push({
        severity: 'error',
        code: 'azure.sentence.missing_config',
        itemId: sentence.id,
        message: `Sentence references missing AzureAssessmentConfig "${sentence.azureAssessmentConfigId}".`,
      });
    }
  }

  return issues;
}
