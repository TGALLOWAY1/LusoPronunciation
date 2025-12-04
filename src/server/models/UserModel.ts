import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * User document interface (MongoDB document)
 */
export interface IUserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName?: string;
  settings?: {
    language?: string;
    theme?: 'light' | 'dark' | 'auto';
    notifications?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User schema
 */
const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    settings: {
      language: String,
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
      },
      notifications: Boolean,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes
UserSchema.index({ email: 1 });

/**
 * User model
 */
export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>(
  'User',
  UserSchema
);

