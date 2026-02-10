import type { DatasetValidationInput, ValidationIssue } from './types';

export function validateIntegrity(input: DatasetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const wordIds = new Set(input.words.map((w) => w.id));
  const categoryIds = new Set(input.categories.map((c) => c.id));
  const audioIds = new Set(Object.keys(input.audioIndex));

  for (const word of input.words) {
    if (!categoryIds.has(word.category)) {
      issues.push({
        severity: 'error',
        code: 'integrity.word.category_ref',
        itemId: word.id,
        message: `Word references missing category "${word.category}".`,
      });
    }
    if (!audioIds.has(word.id)) {
      issues.push({
        severity: 'error',
        code: 'integrity.word.audio_ref',
        itemId: word.id,
        message: `Word is missing audio index entry "${word.id}".`,
      });
    }
  }

  for (const sentence of input.sentences) {
    if (!categoryIds.has(sentence.category)) {
      issues.push({
        severity: 'error',
        code: 'integrity.sentence.category_ref',
        itemId: sentence.id,
        message: `Sentence references missing category "${sentence.category}".`,
      });
    }
    if (!audioIds.has(sentence.id)) {
      issues.push({
        severity: 'error',
        code: 'integrity.sentence.audio_ref',
        itemId: sentence.id,
        message: `Sentence is missing audio index entry "${sentence.id}".`,
      });
    }
    if (Array.isArray(sentence.wordRefs)) {
      for (const ref of sentence.wordRefs) {
        if (!wordIds.has(ref.wordId)) {
          issues.push({
            severity: 'error',
            code: 'integrity.sentence.word_ref',
            itemId: sentence.id,
            message: `Sentence references missing word "${ref.wordId}".`,
          });
        }
      }
    }
  }

  return issues;
}
