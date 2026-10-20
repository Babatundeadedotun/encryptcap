import mongoose, { Schema, type Document, type Model } from 'mongoose';
import { TIER_IDS, type TierId } from '../services/domain.js';

export interface AccountDoc extends Document {
  _id: mongoose.Types.ObjectId;
  /** Human-facing reference shown to the investor, e.g. EC-1042. */
  reference: string;
  owner: mongoose.Types.ObjectId;
  tier: TierId;
  /** Total capital the investor has deposited. Fees never touch this. */
  depositedCapital: number;
  /**
   * Highest equity the account has previously reached (or its capital, if it
   * has never been in profit). Fee applies only above this line.
   */
  highWaterMark: number;
  joinedAt: Date;
  status: 'active' | 'closed';
  /**
   * A distribution moves real money, so equity has to change the moment one is
   * settled — but a settlement is not a trading month and must not be filed as
   * a performance record (it would collide with the report for that month).
   * The resulting equity is parked here instead, and holds until the manager
   * posts a report dated after the settlement.
   */
  lastSettlementAt?: Date;
  equityAfterSettlement?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<AccountDoc>(
  {
    reference: { type: String, required: true, unique: true, trim: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier: { type: String, enum: TIER_IDS, required: true, index: true },
    depositedCapital: { type: Number, required: true, min: 0 },
    highWaterMark: { type: Number, required: true, min: 0 },
    joinedAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    lastSettlementAt: { type: Date },
    equityAfterSettlement: { type: Number },
    notes: { type: String, maxlength: 2000 },
  },
  { timestamps: true },
);

export const Account: Model<AccountDoc> =
  (mongoose.models.Account as Model<AccountDoc>) ??
  mongoose.model<AccountDoc>('Account', accountSchema);

/** Allocate the next free EC-#### reference. */
export async function nextAccountReference(): Promise<string> {
  const last = await Account.findOne({ reference: /^EC-\d+$/ })
    .sort({ reference: -1 })
    .select('reference')
    .lean();
  const lastNum = last ? Number(last.reference.split('-')[1]) : 1000;
  return `EC-${lastNum + 1}`;
}
