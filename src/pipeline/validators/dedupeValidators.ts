import dataQualityConfig from '../../../config/dataQuality.config';
import type { DatasetValidationInput, ValidationIssue } from './types';

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(text: string): Set<string> {
  const normalized = normalizeText(text);
  const result = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i += 1) {
    result.add(normalized.slice(i, i + 2));
  }
  return result;
}

function diceSimilarity(a: string, b: string): number {
  const aSet = bigrams(a);
  const bSet = bigrams(b);
  if (aSet.size === 0 || bSet.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const bg of aSet) {
    if (bSet.has(bg)) overlap += 1;
  }
  return (2 * overlap) / (aSet.size + bSet.size);
}

function checkExactDuplicates(items: any[], field: string, entity: string, issues: ValidationIssue[]): void {
  const seen = new Map<string, string>();
  for (const item of items) {
    const normalized = normalizeText(String(item[field] ?? ''));
    if (!normalized) continue;
    const previousId = seen.get(normalized);
    if (previousId) {
      issues.push({
        severity: 'error',
        code: `dedupe.${entity}.exact`,
        itemId: item.id,
        message: `${entity} duplicates normalized text of ${previousId}.`,
      });
    } else {
      seen.set(normalized, item.id);
    }
  }
}

function checkNearDuplicates(items: any[], field: string, entity: string, issues: ValidationIssue[]): void {
  const threshold = dataQualityConfig.thresholds.nearDuplicateSimilarity;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = String(items[i][field] ?? '');
      const b = String(items[j][field] ?? '');
      if (!a || !b) continue;
      const score = diceSimilarity(a, b);
      if (score >= threshold) {
        issues.push({
          severity: 'warning',
          code: `dedupe.${entity}.near`,
          itemId: items[j].id,
          message: `${entity} "${items[j].id}" is near-duplicate of "${items[i].id}" (similarity ${score.toFixed(3)}).`,
        });
      }
    }
  }
}

export function validateDeduping(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  checkExactDuplicates(input.words, 'text', 'word', issues);
  checkExactDuplicates(input.sentences, 'text', 'sentence', issues);
  checkNearDuplicates(input.sentences, 'text', 'sentence', issues);

  return issues;
}
