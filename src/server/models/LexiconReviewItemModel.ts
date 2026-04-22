import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Per-surface-form review queue. The daily aggregator upserts rows here
 * (keyed by normalized surfaceForm) so admins can see which unknown words
 * show up most often and manually promote them into the curated lexicon
 * or reject them (typos, proper nouns, etc.).
 *
 * A promoted item carries the curated fields (phonemes, pronunciation
 * notes, POS, English gloss) the admin validated — the master word index
 * reads promoted items from this collection at boot so new entries become
 * effective at runtime without re-deploying the static masterWords.json.
 */
export interface ILexiconReviewExample {
  sentenceId: mongoose.Types.ObjectId;
  contextText: string;
  observedAt: Date;
}

export interface ILexiconReviewPromotedFields {
  text: string;
  normalizedText: string;
  en?: string;
  partOfSpeech?: string;
  phonemes: string[];
  ipa?: string;
  pronunciationNotes: string;
  promotedBy: mongoose.Types.ObjectId;
  promotedAt: Date;
}

export interface ILexiconReviewRejectedFields {
  reason?: string;
  rejectedBy: mongoose.Types.ObjectId;
  rejectedAt: Date;
}

export type LexiconReviewStatus = 'pending' | 'promoted' | 'rejected';

export interface ILexiconReviewItemDocument extends Document {
  _id: mongoose.Types.ObjectId;
  surfaceForm: string;
  displayForm: string; // preferred capitalization / most frequent raw form
  frequency: number;
  uniqueUsers: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  examples: ILexiconReviewExample[];
  generatedPronunciationId?: mongoose.Types.ObjectId;
  lastResolutionType: 'generated' | 'unresolved';
  status: LexiconReviewStatus;
  promoted?: ILexiconReviewPromotedFields;
  rejected?: ILexiconReviewRejectedFields;
  createdAt: Date;
  updatedAt: Date;
}

const ExampleSchema = new Schema<ILexiconReviewExample>(
  {
    sentenceId: { type: Schema.Types.ObjectId, required: true },
    contextText: { type: String, required: true, maxlength: 1000 },
    observedAt: { type: Date, required: true },
  },
  { _id: false }
);

const PromotedSchema = new Schema<ILexiconReviewPromotedFields>(
  {
    text: { type: String, required: true },
    normalizedText: { type: String, required: true },
    en: String,
    partOfSpeech: String,
    phonemes: { type: [String], default: [] },
    ipa: String,
    pronunciationNotes: { type: String, required: true, maxlength: 500 },
    promotedBy: { type: Schema.Types.ObjectId, required: true },
    promotedAt: { type: Date, required: true },
  },
  { _id: false }
);

const RejectedSchema = new Schema<ILexiconReviewRejectedFields>(
  {
    reason: { type: String, maxlength: 500 },
    rejectedBy: { type: Schema.Types.ObjectId, required: true },
    rejectedAt: { type: Date, required: true },
  },
  { _id: false }
);

const LexiconReviewItemSchema = new Schema<ILexiconReviewItemDocument>(
  {
    surfaceForm: { type: String, required: true, unique: true, index: true },
    displayForm: { type: String, required: true },
    frequency: { type: Number, required: true, default: 0, min: 0 },
    uniqueUsers: { type: Number, required: true, default: 0, min: 0 },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    examples: { type: [ExampleSchema], default: [] },
    generatedPronunciationId: {
      type: Schema.Types.ObjectId,
      ref: 'GeneratedPronunciation',
    },
    lastResolutionType: {
      type: String,
      enum: ['generated', 'unresolved'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'promoted', 'rejected'],
      required: true,
      default: 'pending',
      index: true,
    },
    promoted: { type: PromotedSchema },
    rejected: { type: RejectedSchema },
  },
  { timestamps: true }
);

LexiconReviewItemSchema.index({ status: 1, frequency: -1 });

export const LexiconReviewItemModel: Model<ILexiconReviewItemDocument> =
  mongoose.models.LexiconReviewItem ||
  mongoose.model<ILexiconReviewItemDocument>(
    'LexiconReviewItem',
    LexiconReviewItemSchema
  );
