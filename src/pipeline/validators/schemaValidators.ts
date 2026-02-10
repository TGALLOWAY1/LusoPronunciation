import type { DatasetValidationInput, ValidationIssue } from './types';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function ensureArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function pushMissingField(
  issues: ValidationIssue[],
  entity: string,
  item: any,
  field: string
): void {
  issues.push({
    severity: 'error',
    code: `schema.${entity}.missing_${field}`,
    itemId: item?.id,
    message: `${entity} is missing required field "${field}"`,
  });
}

export function validateCoreSchemas(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const word of input.words) {
    if (!isNonEmptyString(word.id)) pushMissingField(issues, 'word', word, 'id');
    if (!isNonEmptyString(word.text)) pushMissingField(issues, 'word', word, 'text');
    if (!isNonEmptyString(word.en)) pushMissingField(issues, 'word', word, 'en');
    if (!isNonEmptyString(word.category)) pushMissingField(issues, 'word', word, 'category');
    if (!isNumber(word.difficulty)) pushMissingField(issues, 'word', word, 'difficulty');
    if (!ensureArray(word.phonemes)) pushMissingField(issues, 'word', word, 'phonemes');
    if (!isNonEmptyString(word.azureAssessmentConfigId)) {
      pushMissingField(issues, 'word', word, 'azureAssessmentConfigId');
    }
  }

  for (const sentence of input.sentences) {
    if (!isNonEmptyString(sentence.id)) pushMissingField(issues, 'sentence', sentence, 'id');
    if (!isNonEmptyString(sentence.text)) pushMissingField(issues, 'sentence', sentence, 'text');
    if (!isNonEmptyString(sentence.en)) pushMissingField(issues, 'sentence', sentence, 'en');
    if (!isNonEmptyString(sentence.category)) pushMissingField(issues, 'sentence', sentence, 'category');
    if (!isNumber(sentence.difficulty)) pushMissingField(issues, 'sentence', sentence, 'difficulty');
    if (!ensureArray(sentence.wordRefs)) pushMissingField(issues, 'sentence', sentence, 'wordRefs');
    if (!isNonEmptyString(sentence.azureAssessmentConfigId)) {
      pushMissingField(issues, 'sentence', sentence, 'azureAssessmentConfigId');
    }
  }

  for (const category of input.categories) {
    if (!isNonEmptyString(category.id)) pushMissingField(issues, 'category', category, 'id');
    if (!isNonEmptyString(category.labelEn)) pushMissingField(issues, 'category', category, 'labelEn');
    if (!isNonEmptyString(category.labelPt)) pushMissingField(issues, 'category', category, 'labelPt');
  }

  for (const phoneme of input.phonemes) {
    if (!isNonEmptyString(phoneme.id)) pushMissingField(issues, 'phoneme', phoneme, 'id');
    if (!isNonEmptyString(phoneme.ipa)) pushMissingField(issues, 'phoneme', phoneme, 'ipa');
    if (!ensureArray(phoneme.exampleWords)) pushMissingField(issues, 'phoneme', phoneme, 'exampleWords');
  }

  for (const tip of input.pronunciationTips) {
    if (!isNonEmptyString(tip.id)) pushMissingField(issues, 'pronunciationTip', tip, 'id');
    if (!isNonEmptyString(tip.phonemeId)) pushMissingField(issues, 'pronunciationTip', tip, 'phonemeId');
    if (!isNonEmptyString(tip.instruction)) pushMissingField(issues, 'pronunciationTip', tip, 'instruction');
  }

  for (const cfg of input.azureAssessmentConfigs) {
    if (!isNonEmptyString(cfg.id)) pushMissingField(issues, 'azureAssessmentConfig', cfg, 'id');
    if (!isNonEmptyString(cfg.locale)) pushMissingField(issues, 'azureAssessmentConfig', cfg, 'locale');
    if (!isNonEmptyString(cfg.granularity)) pushMissingField(issues, 'azureAssessmentConfig', cfg, 'granularity');
    if (!isNumber(cfg.maxReferenceChars)) pushMissingField(issues, 'azureAssessmentConfig', cfg, 'maxReferenceChars');
  }

  if (!input.audioIndex || typeof input.audioIndex !== 'object') {
    issues.push({
      severity: 'error',
      code: 'schema.audioIndex.invalid',
      message: 'audio_index.json must be an object keyed by content ID.',
    });
  }

  return issues;
}
