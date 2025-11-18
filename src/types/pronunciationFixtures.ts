export type PronunciationFixtureScores = {
  overall: number;
  accuracy: number;
  fluency?: number;
  completeness?: number;
  prosody?: number;
};

export type PronunciationFixture = {
  id: string;              // e.g. "phrase_1"
  phraseNumber: number;    // 1–10
  text: string;            // Portuguese phrase text
  difficulty: number;      // from phrase_ids.csv
  audioFile: string;       // relative path to WAV
  azureJsonFile: string;   // relative path to Azure JSON
  scores: PronunciationFixtureScores;
};

export type PronunciationFixtureSet = {
  phrases: PronunciationFixture[];
};

