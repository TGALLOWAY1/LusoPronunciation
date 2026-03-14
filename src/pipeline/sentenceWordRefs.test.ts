import { describe, expect, it } from 'vitest';
import { buildWordRefs, computeSentenceWordRefs } from './sentenceWordRefs';

describe('sentenceWordRefs', () => {
  it('prefers longest phrase matches over single-token matches', () => {
    const words = [
      {
        id: 'food_word_005',
        text: 'café',
        normalizedText: 'café',
      },
      {
        id: 'food_word_017',
        text: 'café da manhã',
        normalizedText: 'café da manhã',
      },
    ];

    const refs = buildWordRefs('Já tomou café da manhã?', words);

    expect(refs).toEqual([
      expect.objectContaining({
        wordId: 'food_word_017',
        tokenIndex: 2,
      }),
    ]);
  });

  it('computes phrase refs for enriched sentences', () => {
    const sentences = [
      {
        id: 'sentence_001',
        text: 'Você aceita cartão de crédito?',
        normalizedText: 'você aceita cartão de crédito?',
        en: 'Do you accept credit card?',
        category: 'shopping',
        difficulty: 3 as const,
      },
    ];

    const words = [
      {
        id: 'misc_accepts',
        text: 'aceita',
        normalizedText: 'aceita',
        en: 'accepts',
        category: 'misc_common_words',
        partOfSpeech: 'verb',
        difficulty: 2 as const,
        difficultForEnglish: false,
        phonemes: [],
      },
      {
        id: 'misc_credit_card',
        text: 'cartão de crédito',
        normalizedText: 'cartão de crédito',
        en: 'credit card',
        category: 'misc_common_words',
        partOfSpeech: 'noun',
        difficulty: 3 as const,
        difficultForEnglish: true,
        phonemes: [],
      },
    ];

    const result = computeSentenceWordRefs(sentences as never, words as never);

    expect(result[0].wordRefs).toEqual([
      { wordId: 'misc_accepts', tokenIndex: 1 },
      { wordId: 'misc_credit_card', tokenIndex: 2 },
    ]);
  });

  it('matches alternate surface forms to canonical words', () => {
    const words = [
      {
        id: 'misc_para',
        text: 'para',
        normalizedText: 'para',
        forms: ['pra'],
      },
      {
        id: 'verb_fazer',
        text: 'fazer',
        normalizedText: 'fazer',
        forms: ['faço', 'faz', 'fez'],
      },
    ];

    const refs = buildWordRefs('Dá pra ver quem faz isso?', words as never);

    expect(refs).toEqual([
      expect.objectContaining({ wordId: 'misc_para', tokenIndex: 1 }),
      expect.objectContaining({ wordId: 'verb_fazer', tokenIndex: 4 }),
    ]);
  });
});
