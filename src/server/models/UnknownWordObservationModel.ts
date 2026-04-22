import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * One-row-per-occurrence log of a Portuguese word that the pronunciation
 * resolver could not match against the curated `masterWords.json` corpus
 * (either exact or lemma). Consumed by the daily aggregator which rolls
 * these rows into the LexiconReviewItem queue.
 */
export interface IUnknownWordObservationDocument extends Document {
  _id: mongoose.Types.ObjectId;
  surfaceForm: string; // normalized (lowercase, diacritics stripped)
  rawSurfaceForm: string; // as the user wrote / the translator produced
  userId: mongoose.Types.ObjectId;
  sentenceId: mongoose.Types.ObjectId;
  contextText: string; // full pt-BR sentence
  resolutionType: 'generated' | 'unresolved';
  generatedPronunciationId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const UnknownWordObservationSchema = new Schema<IUnknownWordObservationDocument>(
  {
    surfaceForm: { type: String, required: true, index: true },
    rawSurfaceForm: { type: String, required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sentenceId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomSentence',
      required: true,
    },
    contextText: { type: String, required: true, maxlength: 1000 },
    resolutionType: {
      type: String,
      enum: ['generated', 'unresolved'],
      required: true,
    },
    generatedPronunciationId: {
      type: Schema.Types.ObjectId,
      ref: 'GeneratedPronunciation',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UnknownWordObservationSchema.index({ createdAt: -1 });
UnknownWordObservationSchema.index({ surfaceForm: 1, createdAt: -1 });

export const UnknownWordObservationModel: Model<IUnknownWordObservationDocument> =
  mongoose.models.UnknownWordObservation ||
  mongoose.model<IUnknownWordObservationDocument>(
    'UnknownWordObservation',
    UnknownWordObservationSchema
  );
