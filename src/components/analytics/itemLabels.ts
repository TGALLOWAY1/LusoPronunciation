import { getPhonemeById } from '@/lib/phonemeMetadata';
import type { ImprovementItem } from '@/lib/types';

/**
 * Resolves an analytics item id to a human-readable label.
 * - phonemes → IPA symbol (falling back to the id)
 * - words / sentences → text from the provided lookup maps (falling back to the id)
 */
export function resolveItemLabel(
  item: Pick<ImprovementItem, 'id' | 'kind'>,
  wordLabels: Map<string, string>,
  sentenceLabels: Map<string, string>,
): string {
  switch (item.kind) {
    case 'phoneme':
      return getPhonemeById(item.id)?.ipa ?? item.id;
    case 'word':
      return wordLabels.get(item.id) ?? item.id;
    case 'sentence':
      return sentenceLabels.get(item.id) ?? item.id;
  }
}

export const KIND_LABEL: Record<ImprovementItem['kind'], string> = {
  phoneme: 'Sound',
  word: 'Word',
  sentence: 'Phrase',
};
