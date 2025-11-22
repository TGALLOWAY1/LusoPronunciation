/**
 * Configuration for the content generation pipeline.
 * 
 * This config defines defaults for generating words, sentences, TTS audio,
 * and pronunciation assessments. This is a pure configuration file with no side effects.
 */

import type { GenerationConfigVoice, GenerationPathsConfig } from '../src/types/contentGeneration';

export interface GenerationPipelineConfig {
  voices: GenerationConfigVoice[];
  paths: GenerationPathsConfig;
  limits: {
    maxWords?: number;
    maxSentences?: number;
  };
  // Backward compatibility properties (will be removed in later refactoring)
  wordLimit: number;
  sentenceLimit: number;
  enableWords: boolean;
  enableSentences: boolean;
}

/**
 * Default configuration for the generation pipeline.
 * 
 * This is a pure configuration object with no side effects.
 * Azure region and keys should be provided via environment variables
 * in the pipeline scripts that use this config, not in this file.
 */
const generationPipelineConfig: GenerationPipelineConfig = {
  voices: [
    {
      id: "ptbr_male",
      azureVoiceName: "pt-BR-AntonioNeural",
      gender: "male",
    },
    {
      id: "ptbr_female",
      azureVoiceName: "pt-BR-FranciscaNeural",
      gender: "female",
    },
  ],
  paths: {
    rawWordsJsonPath: "STATIC DATA/words.json",
    rawSentencesJsonPath: "data/sentences.json",
    masterWordsPath: "data/masterWords.json",
    masterSentencesPath: "data/masterSentences.json",
    audioBaseDir: "public/audio",
    audioIndexPath: "data/audio_index.json",
    testDataBaseDir: "data/test_data",
  },
  limits: {
    maxWords: undefined,
    maxSentences: undefined,
  },
  // Backward compatibility properties (will be removed in later refactoring)
  wordLimit: 2000,
  sentenceLimit: 1000,
  enableWords: true,
  enableSentences: true,
};

export default generationPipelineConfig;

