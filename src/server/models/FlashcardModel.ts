import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Review outcome type
 */
export type ReviewOutcome = 'again' | 'hard' | 'good' | 'easy';

/**
 * Flashcard document interface (MongoDB document)
 */
export interface IFlashcardDocument extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  contentId: string;
  contentType: 'sentence' | 'word';
  nextDueAt: Date;
  intervalDays: number; // Days until next review
  easeFactor: number; // SM-2 ease factor (default 2.5)
  reps: number; // Number of successful reviews
  lapses: number; // Number of times card was failed
  lastScore?: number; // Last pronunciation score (0-100)
  lastOutcome?: ReviewOutcome; // Last review outcome
  history: mongoose.Types.ObjectId[]; // Array of PronunciationAttempt IDs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Flashcard schema
 */
const FlashcardSchema = new Schema<IFlashcardDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    nextDueAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    intervalDays: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    easeFactor: {
      type: Number,
      required: true,
      default: 2.5,
      min: 1.3,
    },
    reps: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lapses: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lastScore: {
      type: Number,
      min: 0,
      max: 100,
    },
    lastOutcome: {
      type: String,
      enum: ['again', 'hard', 'good', 'easy'],
    },
    history: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PronunciationAttempt',
      },
    ],
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes
FlashcardSchema.index({ userId: 1, nextDueAt: 1 }); // For efficient due queue queries
FlashcardSchema.index({ userId: 1, contentId: 1, contentType: 1 }, { unique: true }); // One card per content per user

/**
 * Flashcard model
 */
export const FlashcardModel: Model<IFlashcardDocument> = mongoose.model<IFlashcardDocument>(
  'Flashcard',
  FlashcardSchema
);

