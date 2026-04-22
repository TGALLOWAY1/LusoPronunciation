/**
 * Shared DTO types for the Custom Sentence Builder feature.
 *
 * These types are used by both the server (request/response shapes) and the
 * client (API module + UI state). Keep this file free of runtime imports so
 * Vite and tsx can both consume it.
 */

export type TokenConfidence = 'high' | 'medium' | 'low';

export type TokenResolutionType =
  | 'exact_match'
  | 'lemma_match'
  | 'generated'
  | 'unresolved';

export type CustomSentenceStatus =
  | 'ready'
  | 'partial_support'
  | 'needs_review';

export type TranslationProvider = 'azure_translator';

export interface TranslationResult {
  textPt: string;
  provider: TranslationProvider;
  confidence: number;
  detectedSourceLanguage?: string;
}

export interface CustomSentenceTokenDto {
  position: number;
  surfaceForm: string;
  normalizedForm: string;
  resolutionType: TokenResolutionType;
  wordEntryId?: string;
  generatedPronunciationId?: string;
  confidence: TokenConfidence;
}

export interface CustomSentenceDto {
  id: string;
  userId: string;
  sourceTextEn: string;
  targetTextPt: string;
  normalizedTextPt: string;
  locale: 'pt-BR';
  ttsAudioUrl: string;
  status: CustomSentenceStatus;
  tokens: CustomSentenceTokenDto[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomSentenceRequest {
  englishText: string;
}

export interface CreateCustomSentenceResponse {
  sentence: CustomSentenceDto;
  tokens: CustomSentenceTokenDto[];
  audioUrl: string;
  status: CustomSentenceStatus;
}
