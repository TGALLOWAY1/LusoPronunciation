import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * InviteCode document interface (MongoDB document)
 *
 * Stores invite codes that gate access to registration.
 * Each code has a use limit and optional expiration.
 */
export interface IInviteCodeDocument extends Document {
  _id: mongoose.Types.ObjectId;
  code: string;
  maxUses: number;
  usedCount: number;
  usedBy: mongoose.Types.ObjectId[];
  createdBy: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InviteCodeSchema = new Schema<IInviteCodeDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    maxUses: {
      type: Number,
      required: true,
      default: 1,
    },
    usedCount: {
      type: Number,
      required: true,
      default: 0,
    },
    usedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: String,
      required: true,
      default: 'admin',
    },
    expiresAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const InviteCodeModel: Model<IInviteCodeDocument> =
  mongoose.model<IInviteCodeDocument>('InviteCode', InviteCodeSchema);
