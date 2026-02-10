import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Pronunciation attempt document interface (MongoDB document)
 */
export interface IPronunciationAttemptDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'sentence' | 'word';
  textPt: string;
  textEn?: string;
  engine: 'mock' | 'azure_speech';
  scores: {
    overall: number;
    accuracy: number;
    fluency?: number;
    completeness?: number;
    prosody?: number;
  };
  wordScores?: Array<{
    wordId?: string;
    token: string;
    overallScore: number;
    accuracyScore?: number;
    fluencyScore?: number;
    errorType?: 'none' | 'mispronounced' | 'omitted' | 'extra' | 'unexpected_break' | 'missing_break' | 'monotone';
    phonemeScores?: Array<{
      phonemeId: string;
      overallScore: number;
    }>;
  }>;
  rawAssessment?: any; // Raw response from assessment engine (stored as mixed type)
  recordingUrl?: string;
  recordingDataUrl?: string;
  recordingDurationSeconds?: number;
  latencyMs?: number;
  passed?: boolean;
  targetOverallThreshold?: number;
  targetAccuracyThreshold?: number;
  retriesInThisSession?: number;
  usedHint?: boolean;
  slowedAudioPlayback?: boolean;
  listenedToNativeModelCount?: number;
  confidenceLabel?: 'unknown' | 'learning' | 'review' | 'known';
  practiceDirection?: 'pt-to-en' | 'en-to-pt';
  practiceMode?: 'pronunciation' | 'text-mcq' | 'listening-mcq' | 'self-rating';
  isCorrect?: boolean;
  selfRating?: 'know' | 'dont_know';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pronunciation attempt schema
 */
const PronunciationAttemptSchema = new Schema<IPronunciationAttemptDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSession',
      index: true,
    },
    contentId: {
      type: String,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: ['sentence', 'word'],
      required: true,
    },
    textPt: {
      type: String,
      required: true,
    },
    textEn: String,
    engine: {
      type: String,
      enum: ['mock', 'azure_speech'],
      required: true,
    },
    scores: {
      overall: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      accuracy: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
      },
      fluency: {
        type: Number,
        min: 0,
        max: 100,
      },
      completeness: {
        type: Number,
        min: 0,
        max: 100,
      },
      prosody: {
        type: Number,
        min: 0,
        max: 100,
      },
    },
    wordScores: [
      {
        wordId: String,
        token: {
          type: String,
          required: true,
        },
        overallScore: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        accuracyScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        fluencyScore: {
          type: Number,
          min: 0,
          max: 100,
        },
        errorType: {
          type: String,
          enum: ['none', 'mispronounced', 'omitted', 'extra', 'unexpected_break', 'missing_break', 'monotone'],
        },
        phonemeScores: [
          {
            phonemeId: {
              type: String,
              required: true,
            },
            overallScore: {
              type: Number,
              required: true,
              min: 0,
              max: 100,
            },
          },
        ],
      },
    ],
    rawAssessment: Schema.Types.Mixed,
    recordingUrl: String,
    recordingDataUrl: String,
    recordingDurationSeconds: Number,
    latencyMs: Number,
    passed: Boolean,
    targetOverallThreshold: Number,
    targetAccuracyThreshold: Number,
    retriesInThisSession: Number,
    usedHint: Boolean,
    slowedAudioPlayback: Boolean,
    listenedToNativeModelCount: Number,
    confidenceLabel: {
      type: String,
      enum: ['unknown', 'learning', 'review', 'known'],
    },
    practiceDirection: {
      type: String,
      enum: ['pt-to-en', 'en-to-pt'],
    },
    practiceMode: {
      type: String,
      enum: ['pronunciation', 'text-mcq', 'listening-mcq', 'self-rating'],
    },
    isCorrect: Boolean,
    selfRating: {
      type: String,
      enum: ['know', 'dont_know'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes
PronunciationAttemptSchema.index({ userId: 1, createdAt: -1 });
PronunciationAttemptSchema.index({ userId: 1, contentId: 1 });

/**
 * Pronunciation attempt model
 */
export const PronunciationAttemptModel: Model<IPronunciationAttemptDocument> =
  mongoose.model<IPronunciationAttemptDocument>(
    'PronunciationAttempt',
    PronunciationAttemptSchema
  );
