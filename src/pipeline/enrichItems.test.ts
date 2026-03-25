import { describe, expect, it } from 'vitest';
import generationPipelineConfig from '../../config/generationPipeline.config';
import { enrichSentences, enrichWords } from './enrichItems';

describe('enrichItems category preservation', () => {
  it('preserves source categories when raw items provide them', () => {
    const rawWords = [
      {
        id: 'food_word_test',
        pt: 'cafe',
        en: 'coffee',
        pos: 'noun',
        category: 'food',
        difficulty: 2 as const,
        difficult_for_english: false,
      },
    ];

    const enrichedWords = enrichWords(rawWords, generationPipelineConfig);
    expect(enrichedWords[0].category).toBe('food');

    const rawSentences = [
      {
        id: 'question_sentence_test',
        pt: 'Qual voce recomenda?',
        en: 'Which one do you recommend?',
        category: 'questions',
        difficulty: 3 as const,
      },
    ];

    const enrichedSentences = enrichSentences(rawSentences, enrichedWords, generationPipelineConfig);
    expect(enrichedSentences[0].category).toBe('questions');
  });

  it('falls back to heuristic inference when source categories are missing', () => {
    const rawWords = [
      {
        id: 'travel_word_test',
        pt: 'hotel',
        en: 'hotel',
        pos: 'noun',
        difficulty: 2 as const,
        difficult_for_english: false,
      },
    ];

    const enrichedWords = enrichWords(rawWords, generationPipelineConfig);
    expect(enrichedWords[0].category).toBe('travel');

    const rawSentences = [
      {
        id: 'travel_sentence_test',
        pt: 'Onde fica o hotel?',
        en: 'Where is the hotel?',
        difficulty: 2 as const,
      },
    ];

    const enrichedSentences = enrichSentences(rawSentences, enrichedWords, generationPipelineConfig);
    expect(enrichedSentences[0].category).toBe('travel');
  });
});
