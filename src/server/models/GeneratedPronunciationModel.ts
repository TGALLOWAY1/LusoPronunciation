import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Cache record for phonemeMapper-generated pronunciations.
 *
 * Keyed by a normalized surface form (lowercase, diacritics stripped) so the
 * same user-entered word produces the same record across users. Created on
 * demand by `generatedPronunciationService` and referenced from embedded
 * tokens on `CustomSentenceModel`.
 */
export interface IGeneratedPronunciationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  surfaceForm: string;
  phonemes: string[];
  ipa?: string;
  syllables: string[];
  tipText: string;
  confidence: number;
  needsReview: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeneratedPronunciationSchema = new Schema<IGeneratedPronunciationDocument>(
  {
    surfaceForm: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phonemes: { type: [String], default: [] },
    ipa: { type: String },
    syllables: { type: [String], default: [] },
    tipText: { type: String, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    needsReview: { type: Boolean, required: true },
  },
  { timestamps: true }
);

export const GeneratedPronunciationModel: Model<IGeneratedPronunciationDocument> =
  mongoose.models.GeneratedPronunciation ||
  mongoose.model<IGeneratedPronunciationDocument>(
    'GeneratedPronunciation',
    GeneratedPronunciationSchema
  );
