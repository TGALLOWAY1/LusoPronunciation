/**
 * Client for the admin-only lexicon review endpoints
 * (/api/admin/lexicon/*). Access is gated server-side by
 * `LEXICON_ADMIN_USER_IDS`; in dev with an empty allowlist any signed-in
 * user passes through.
 */

import { authenticatedFetch } from './auth';

export type LexiconReviewStatus = 'pending' | 'promoted' | 'rejected';

export interface LexiconReviewExample {
  sentenceId: string;
  contextText: string;
  observedAt: string;
}

export interface LexiconReviewItemDto {
  id: string;
  surfaceForm: string;
  displayForm: string;
  frequency: number;
  uniqueUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastResolutionType: 'generated' | 'unresolved';
  status: LexiconReviewStatus;
  examples: LexiconReviewExample[];
  generatedPronunciationId?: string;
  promoted?: {
    text: string;
    en?: string;
    partOfSpeech?: string;
    phonemes: string[];
    ipa?: string;
    pronunciationNotes: string;
    promotedBy: string;
    promotedAt: string;
  };
  rejected?: {
    reason?: string;
    rejectedBy: string;
    rejectedAt: string;
  };
}

export interface ListLexiconReviewResponse {
  items: LexiconReviewItemDto[];
  total: number;
  limit: number;
  offset: number;
  status: LexiconReviewStatus;
}

export interface PromotePayload {
  text: string;
  en?: string;
  partOfSpeech?: string;
  phonemes: string[];
  ipa?: string;
  pronunciationNotes: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.message || body.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

export function listReviewItems(params: {
  status?: LexiconReviewStatus;
  limit?: number;
  offset?: number;
} = {}): Promise<ListLexiconReviewResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit !== undefined) query.set('limit', String(params.limit));
  if (params.offset !== undefined) query.set('offset', String(params.offset));
  const qs = query.toString();
  return request<ListLexiconReviewResponse>(
    qs ? `/api/admin/lexicon/review?${qs}` : '/api/admin/lexicon/review'
  );
}

export function promoteReviewItem(
  id: string,
  payload: PromotePayload
): Promise<LexiconReviewItemDto> {
  return request<LexiconReviewItemDto>(
    `/api/admin/lexicon/review/${encodeURIComponent(id)}/promote`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export function rejectReviewItem(
  id: string,
  reason?: string
): Promise<LexiconReviewItemDto> {
  return request<LexiconReviewItemDto>(
    `/api/admin/lexicon/review/${encodeURIComponent(id)}/reject`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }
  );
}

export interface AggregateSummary {
  observations: number;
  groups: number;
  upserted: number;
  skippedNonPending: number;
}

export function triggerAggregation(): Promise<AggregateSummary> {
  return request<AggregateSummary>('/api/admin/lexicon/aggregate', {
    method: 'POST',
  });
}
