import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Server-authoritative assessment usage counter.
 *
 * WHY A DEDICATED COUNTER (and not counting PronunciationAttemptModel):
 * The Azure assessment call (POST /api/pronunciation/assessment) and the
 * persistence of a PronunciationAttempt (POST /api/pronunciation-attempts) are
 * two SEPARATE requests. The client decides whether to persist an attempt after
 * scoring — so a bot could call the (billable) assessment endpoint repeatedly
 * and never persist an attempt, keeping any PronunciationAttempt-based count at
 * zero. Counting attempt docs is therefore NOT authoritative for Azure spend.
 *
 * This collection is incremented server-side inside the assessment request
 * path (assessmentQuota middleware), BEFORE the Azure call, so the count
 * reflects exactly the number of billable assessment requests that were let
 * through — regardless of what the client does afterward. It is DB-backed so it
 * survives process restarts (unlike the in-memory rate limiter / daily quota).
 *
 * Documents are keyed by an opaque `key` string:
 *   - `global:<YYYY-MM-DD>`        → all users, one UTC day (circuit breaker)
 *   - `user:<userId>:<YYYY-MM-DD>` → one user, one UTC day (daily cap)
 *   - `user:<userId>:lifetime`     → one user, all time (lifetime cap)
 */
export interface IAssessmentUsageDocument extends Document {
  _id: mongoose.Types.ObjectId;
  key: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentUsageSchema = new Schema<IAssessmentUsageDocument>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const AssessmentUsageModel: Model<IAssessmentUsageDocument> =
  mongoose.models.AssessmentUsage
    ? (mongoose.models.AssessmentUsage as Model<IAssessmentUsageDocument>)
    : mongoose.model<IAssessmentUsageDocument>('AssessmentUsage', AssessmentUsageSchema);
