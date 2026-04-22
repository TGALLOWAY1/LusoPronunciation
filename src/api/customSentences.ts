/**
 * Custom Sentence Builder API client.
 *
 * Thin wrapper around the /api/sentences/custom endpoint. Attaches the
 * stored JWT through `authenticatedFetch` and surfaces a typed error on
 * non-2xx responses so the UI can render a meaningful message instead of
 * a generic failure.
 */

import { authenticatedFetch } from './auth';
import type {
  CreateCustomSentenceRequest,
  CreateCustomSentenceResponse,
} from '@/shared/types/customSentence';

export class CustomSentenceApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string }) {
    super(message);
    this.name = 'CustomSentenceApiError';
    this.status = options.status;
    this.code = options.code;
  }
}

export async function createCustomSentence(
  payload: CreateCustomSentenceRequest
): Promise<CreateCustomSentenceResponse> {
  const response = await authenticatedFetch('/api/sentences/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new CustomSentenceApiError(
      body.message || body.error || `Request failed with ${response.status}`,
      { status: response.status, code: body.error }
    );
  }

  return response.json();
}

export interface ListCustomSentencesResponse {
  sentences: import('@/shared/types/customSentence').CustomSentenceDto[];
  total: number;
  limit: number;
  offset: number;
}

export async function listCustomSentences(
  params: { limit?: number; offset?: number } = {}
): Promise<ListCustomSentencesResponse> {
  const query = new URLSearchParams();
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  const qs = query.toString();
  const url = qs ? `/api/sentences/custom?${qs}` : '/api/sentences/custom';

  const response = await authenticatedFetch(url, { method: 'GET' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new CustomSentenceApiError(
      body.message || body.error || `Request failed with ${response.status}`,
      { status: response.status, code: body.error }
    );
  }
  return response.json();
}

export async function getCustomSentence(
  id: string
): Promise<import('@/shared/types/customSentence').CustomSentenceDto> {
  const response = await authenticatedFetch(`/api/sentences/custom/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new CustomSentenceApiError(
      body.message || body.error || `Request failed with ${response.status}`,
      { status: response.status, code: body.error }
    );
  }
  return response.json();
}

export async function deleteCustomSentence(id: string): Promise<void> {
  const response = await authenticatedFetch(`/api/sentences/custom/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({}));
    throw new CustomSentenceApiError(
      body.message || body.error || `Request failed with ${response.status}`,
      { status: response.status, code: body.error }
    );
  }
}
