/**
 * Read/write operations for the LexiconReviewItem queue.
 *
 * The promotion path is the only place that materializes a curated entry
 * from an unknown word — it requires the admin to hand over the manually
 * validated fields (phonemes, tip text, POS, English gloss). The service
 * refuses to promote an item without a non-empty phonemes array and a
 * non-empty pronunciationNotes string, which enforces the "require
 * validation" constraint at the service boundary.
 */

import mongoose from 'mongoose';
import {
  LexiconReviewItemModel,
  type ILexiconReviewItemDocument,
  type LexiconReviewStatus,
} from '../models/LexiconReviewItemModel';

export class LexiconReviewError extends Error {
  readonly code:
    | 'NOT_FOUND'
    | 'INVALID_STATE'
    | 'INVALID_PAYLOAD';

  constructor(code: LexiconReviewError['code'], message: string) {
    super(message);
    this.name = 'LexiconReviewError';
    this.code = code;
  }
}

export interface ListReviewItemsOptions {
  status?: LexiconReviewStatus;
  limit?: number;
  offset?: number;
}

export async function listReviewItems(
  opts: ListReviewItemsOptions = {}
): Promise<{
  items: ILexiconReviewItemDocument[];
  total: number;
}> {
  const status = opts.status ?? 'pending';
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const [items, total] = await Promise.all([
    LexiconReviewItemModel.find({ status })
      .sort({ frequency: -1, surfaceForm: 1 })
      .limit(limit)
      .skip(offset)
      .exec(),
    LexiconReviewItemModel.countDocuments({ status }),
  ]);

  return { items, total };
}

export async function getReviewItem(
  id: string
): Promise<ILexiconReviewItemDocument> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new LexiconReviewError('NOT_FOUND', 'Review item not found');
  }
  const doc = await LexiconReviewItemModel.findById(id);
  if (!doc) {
    throw new LexiconReviewError('NOT_FOUND', 'Review item not found');
  }
  return doc;
}

export interface PromotePayload {
  text: string;
  en?: string;
  partOfSpeech?: string;
  phonemes: string[];
  ipa?: string;
  pronunciationNotes: string;
}

export async function promoteReviewItem(params: {
  id: string;
  payload: PromotePayload;
  adminUserId: string;
}): Promise<ILexiconReviewItemDocument> {
  const { payload } = params;

  // Validation: we explicitly refuse to promote without all the signals a
  // curated entry needs. The whole point of this endpoint is to require
  // the admin to validate the pronunciation data.
  if (!payload || typeof payload !== 'object') {
    throw new LexiconReviewError('INVALID_PAYLOAD', 'Payload is required');
  }
  if (!payload.text || !payload.text.trim()) {
    throw new LexiconReviewError('INVALID_PAYLOAD', 'text is required');
  }
  if (
    !Array.isArray(payload.phonemes) ||
    payload.phonemes.length === 0 ||
    payload.phonemes.some((p) => typeof p !== 'string' || !p.trim())
  ) {
    throw new LexiconReviewError(
      'INVALID_PAYLOAD',
      'phonemes must be a non-empty array of strings'
    );
  }
  if (!payload.pronunciationNotes || !payload.pronunciationNotes.trim()) {
    throw new LexiconReviewError(
      'INVALID_PAYLOAD',
      'pronunciationNotes is required'
    );
  }

  const doc = await getReviewItem(params.id);
  if (doc.status !== 'pending') {
    throw new LexiconReviewError(
      'INVALID_STATE',
      `Cannot promote an item in state "${doc.status}"`
    );
  }

  doc.status = 'promoted';
  doc.promoted = {
    text: payload.text.trim(),
    normalizedText: doc.surfaceForm,
    en: payload.en?.trim() || undefined,
    partOfSpeech: payload.partOfSpeech?.trim() || undefined,
    phonemes: payload.phonemes.map((p) => p.trim()),
    ipa: payload.ipa?.trim() || undefined,
    pronunciationNotes: payload.pronunciationNotes.trim(),
    promotedBy: new mongoose.Types.ObjectId(params.adminUserId),
    promotedAt: new Date(),
  };

  await doc.save();
  return doc;
}

export async function rejectReviewItem(params: {
  id: string;
  reason?: string;
  adminUserId: string;
}): Promise<ILexiconReviewItemDocument> {
  const doc = await getReviewItem(params.id);
  if (doc.status !== 'pending') {
    throw new LexiconReviewError(
      'INVALID_STATE',
      `Cannot reject an item in state "${doc.status}"`
    );
  }

  doc.status = 'rejected';
  doc.rejected = {
    reason: params.reason?.trim() || undefined,
    rejectedBy: new mongoose.Types.ObjectId(params.adminUserId),
    rejectedAt: new Date(),
  };
  await doc.save();
  return doc;
}
