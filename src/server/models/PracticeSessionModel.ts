import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Practice session document interface (MongoDB document)
 */
export interface IPracticeSessionDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  mode: 'sentences' | 'words' | 'mixed';
  startedAt: Date;
  endedAt?: Date;
  device?: 'desktop' | 'mobile';
  appVersion?: string;
  totalAttempts?: number;
  sentenceAttempts?: number;
  wordAttempts?: number;
  avgOverallScore?: number;
  avgFluencyScore?: number;
  avgAccuracyScore?: number;
  avgCompletenessScore?: number;
  avgProsodyScore?: number;
  dailyStreakAfterSession?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Practice session schema
 */
const PracticeSessionSchema = new Schema<IPracticeSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['sentences', 'words', 'mixed'],
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    device: {
      type: String,
      enum: ['desktop', 'mobile'],
    },
    appVersion: String,
    totalAttempts: Number,
    sentenceAttempts: Number,
    wordAttempts: Number,
    avgOverallScore: Number,
    avgFluencyScore: Number,
    avgAccuracyScore: Number,
    avgCompletenessScore: Number,
    avgProsodyScore: Number,
    dailyStreakAfterSession: Number,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes
PracticeSessionSchema.index({ userId: 1, startedAt: -1 });

/**
 * Practice session model
 */
export const PracticeSessionModel: Model<IPracticeSessionDocument> =
  mongoose.model<IPracticeSessionDocument>(
    'PracticeSession',
    PracticeSessionSchema
  );

