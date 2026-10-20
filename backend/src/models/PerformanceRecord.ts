import mongoose, { Schema, type Document, type Model } from 'mongoose';

/**
 * One month of broker-verified figures for one account — the unit the manager
 * posts and the investor's "Monthly performance report" renders.
 */
export interface PerformanceRecordDoc extends Document {
  _id: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  /** Calendar period this covers. */
  year: number;
  month: number; // 1-12
  /** Sortable composite, e.g. 202606. Maintained by the pre-validate hook. */
  periodKey: number;
  openingBalance: number;
  /** Result of the trade placed around the Non-Farm Payrolls release. */
  nfpResult: number;
  /** Booked result for the period. Usually equals nfpResult unless other trades ran. */
  realisedPnl: number;
  closingEquity: number;
  brokerVerified: boolean;
  notes?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const performanceRecordSchema = new Schema<PerformanceRecordDoc>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    year: { type: Number, required: true, min: 2000, max: 2999 },
    month: { type: Number, required: true, min: 1, max: 12 },
    periodKey: { type: Number, required: true, index: true },
    openingBalance: { type: Number, required: true },
    nfpResult: { type: Number, required: true },
    realisedPnl: { type: Number, required: true },
    closingEquity: { type: Number, required: true },
    brokerVerified: { type: Boolean, default: true },
    notes: { type: String, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// One record per account per month.
performanceRecordSchema.index({ account: 1, periodKey: 1 }, { unique: true });

performanceRecordSchema.pre('validate', function setPeriodKey(next) {
  if (this.year && this.month) this.periodKey = this.year * 100 + this.month;
  next();
});

export const PerformanceRecord: Model<PerformanceRecordDoc> =
  (mongoose.models.PerformanceRecord as Model<PerformanceRecordDoc>) ??
  mongoose.model<PerformanceRecordDoc>('PerformanceRecord', performanceRecordSchema);
