export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  itemId?: string;
  path?: string;
}

export interface DatasetValidationInput {
  words: any[];
  sentences: any[];
  categories: any[];
  phonemes: any[];
  pronunciationTips: any[];
  azureAssessmentConfigs: any[];
  audioIndex: Record<string, any>;
}

export interface DatasetValidationReport {
  generatedAt: string;
  version: string;
  summary: {
    errors: number;
    warnings: number;
    words: number;
    sentences: number;
    categories: number;
    phonemes: number;
    tips: number;
    audioIndexEntries: number;
  };
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
