import mongoose, { Schema, Document, Model } from 'mongoose';
import type {
  CustomSentenceStatus,
  TokenConfidence,
  TokenResolutionType,
} from '../../shared/types/customSentence';

export interface ICustomSentenceTokenSubdoc {
  position: number;
  surfaceForm: string;
  normalizedForm: string;
  resolutionType: TokenResolutionType;
  wordEntryId?: string;
  generatedPronunciationId?: mongoose.Types.ObjectId;
  confidence: TokenConfidence;
}

export interface ICustomSentenceDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sourceTextEn: string;
  targetTextPt: string;
  normalizedTextPt: string;
  locale: 'pt-BR';
  ttsAudioUrl: string;
  status: CustomSentenceStatus;
  translationProvider: string;
  translationConfidence?: number;
  tokens: ICustomSentenceTokenSubdoc[];
  createdAt: Date;
  updatedAt: Date;
}

const CustomSentenceTokenSchema = new Schema<ICustomSentenceTokenSubdoc>(
  {
    position: { type: Number, required: true, min: 0 },
    surfaceForm: { type: String, required: true },
    normalizedForm: { type: String, required: true },
    resolutionType: {
      type: String,
      enum: ['exact_match', 'lemma_match', 'generated', 'unresolved'],
      required: true,
    },
    wordEntryId: { type: String },
    generatedPronunciationId: {
      type: Schema.Types.ObjectId,
      ref: 'GeneratedPronunciation',
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      required: true,
    },
  },
  { _id: false }
);

const CustomSentenceSchema = new Schema<ICustomSentenceDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sourceTextEn: { type: String, required: true, maxlength: 1000 },
    targetTextPt: { type: String, required: true, maxlength: 1000 },
    normalizedTextPt: { type: String, required: true, maxlength: 1000 },
    locale: {
      type: String,
      enum: ['pt-BR'],
      default: 'pt-BR',
      required: true,
    },
    ttsAudioUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['ready', 'partial_support', 'needs_review'],
      required: true,
      index: true,
    },
    translationProvider: { type: String, required: true },
    translationConfidence: { type: Number, min: 0, max: 1 },
    tokens: {
      type: [CustomSentenceTokenSchema],
      default: [],
    },
  },
  { timestamps: true }
);

CustomSentenceSchema.index({ userId: 1, createdAt: -1 });

export const CustomSentenceModel: Model<ICustomSentenceDocument> =
  mongoose.models.CustomSentence ||
  mongoose.model<ICustomSentenceDocument>('CustomSentence', CustomSentenceSchema);
