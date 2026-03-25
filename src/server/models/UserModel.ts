import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * User document interface (MongoDB document)
 */
export interface IUserDocument extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  passwordHash?: string;
  displayName?: string;
  oauthProvider?: 'github' | 'linkedin';
  oauthId?: string;
  avatarUrl?: string;
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
    },
    passwordHash: {
      type: String,
      required: false,
    },
    displayName: {
      type: String,
      trim: true,
    },
    oauthProvider: {
      type: String,
      enum: ['github', 'linkedin'],
    },
    oauthId: {
      type: String,
    },
    avatarUrl: {
      type: String,
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

/**
 * User model
 */
export const UserModel: Model<IUserDocument> = mongoose.model<IUserDocument>(
  'User',
  UserSchema
);

