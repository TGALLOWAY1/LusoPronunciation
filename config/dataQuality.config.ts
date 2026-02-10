export interface DataQualityConfig {
  locale: 'pt-BR';
  thresholds: {
    nearDuplicateSimilarity: number;
    acceptConfidence: number;
    reviewConfidence: number;
  };
  azure: {
    maxWordChars: number;
    maxSentenceChars: number;
    allowedTextPattern: RegExp;
    allowedPunctuationPattern: RegExp;
    bannedEmojiPattern: RegExp;
  };
  coverage: {
    minItemsPerCategory: {
      words: number;
      sentences: number;
    };
    minTipsPerPhoneme: number;
    minExamplesPerPhoneme: number;
  };
}

const dataQualityConfig: DataQualityConfig = {
  locale: 'pt-BR',
  thresholds: {
    nearDuplicateSimilarity: 0.92,
    acceptConfidence: 0.85,
    reviewConfidence: 0.7,
  },
  azure: {
    maxWordChars: 40,
    maxSentenceChars: 180,
    // Portuguese letters + common punctuation and whitespace
    allowedTextPattern: /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s.,!?;:'"()\-/%]+$/u,
    allowedPunctuationPattern: /^[\s.,!?;:'"()\-/%]+$/u,
    // Broad emoji ranges
    bannedEmojiPattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  },
  coverage: {
    minItemsPerCategory: {
      words: 5,
      sentences: 5,
    },
    minTipsPerPhoneme: 1,
    minExamplesPerPhoneme: 1,
  },
};

export default dataQualityConfig;
