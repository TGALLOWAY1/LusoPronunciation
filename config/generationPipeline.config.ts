/**
 * Configuration for the content generation pipeline.
 * 
 * This config defines defaults for generating words, sentences, TTS audio,
 * and pronunciation assessments. Values can be overridden programmatically
 * or via environment variables in the pipeline scripts.
 */

export interface GenerationPipelineConfig {
  azureRegion: string;
  voices: {
    name: string;
    gender: "male" | "female";
  }[];
  wordLimit: number;
  sentenceLimit: number;
  concurrency: number;
  enableWords: boolean;
  enableSentences: boolean;
  enableTTS: boolean;
  enableAssessment: boolean;
}

/**
 * Default configuration for the generation pipeline.
 * 
 * Note: Azure region and keys should be provided via environment variables
 * in the pipeline scripts that use this config, not in this file.
 */
const generationPipelineConfig: GenerationPipelineConfig = {
  azureRegion: "brazilsouth",
  voices: [
    {
      name: "pt-BR-FranciscaNeural",
      gender: "female",
    },
    {
      name: "pt-BR-AntonioNeural",
      gender: "male",
    },
  ],
  wordLimit: 2000,
  sentenceLimit: 1000,
  concurrency: 4,
  enableWords: true,
  enableSentences: true,
  enableTTS: true,
  enableAssessment: true,
};

export default generationPipelineConfig;

