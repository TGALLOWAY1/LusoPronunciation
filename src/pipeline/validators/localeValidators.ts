import type { DatasetValidationInput, ValidationIssue } from './types';

const REQUIRED_LOCALE = 'pt-BR';

export function validateLocaleConsistency(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const checkLocale = (entity: string, items: any[]) => {
    for (const item of items) {
      const locale = item.locale;
      if (locale !== REQUIRED_LOCALE) {
        issues.push({
          severity: 'error',
          code: `locale.${entity}.mismatch`,
          itemId: item?.id,
          message: `${entity} locale must be ${REQUIRED_LOCALE}, received "${String(locale)}".`,
        });
      }
    }
  };

  checkLocale('word', input.words);
  checkLocale('sentence', input.sentences);
  checkLocale('category', input.categories);
  checkLocale('phoneme', input.phonemes);
  checkLocale('pronunciationTip', input.pronunciationTips);
  checkLocale('azureAssessmentConfig', input.azureAssessmentConfigs);

  return issues;
}
