/**
 * Word Pronunciation Scoring
 * 
 * Shared wrapper for scoring word pronunciation using the same pipeline
 * as sentence scoring. Reuses the pronunciation assessment API.
 */

import type { AttemptScore } from '@/types/pronunciation';
import { getAuthHeader } from '@/api/auth';
import { buildApiUrl } from '@/api/apiUrl';

/**
 * Scores word pronunciation using the shared pronunciation assessment API.
 * 
 * @param wordText - The word text to use as reference
 * @param blob - The audio recording blob
 * @param wordId - The word ID for tracking
 * @returns Promise resolving to AttemptScore
 * @throws Error if scoring fails
 */
export async function scoreWordPronunciation(
  wordText: string,
  blob: Blob,
  wordId: string
): Promise<AttemptScore> {
  // Build FormData (same structure as sentence scoring)
  const formData = new FormData();
  formData.append('audio', blob, `${wordId}-attempt.ogg`);
  formData.append('sentenceId', wordId); // API uses 'sentenceId' field but accepts word IDs
  formData.append('referenceText', wordText);
  formData.append('language', 'pt-BR');

  // POST to API endpoint (same endpoint as sentences)
  const headers: Record<string, string> = {};
  const authHeader = getAuthHeader();
  if (!authHeader) {
    throw new Error('Please log in to use pronunciation assessment.');
  }
  headers['Authorization'] = authHeader;

  const response = await fetch(buildApiUrl('/api/pronunciation/assessment'), {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  const { rawAzure, attemptScore } = await response.json();

  // Log rawAzure in development for debugging
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.debug('Azure pronunciation assessment response (word):', rawAzure);
  }

  return attemptScore;
}

