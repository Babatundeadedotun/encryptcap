import mongoose, { Schema, type Document, type Model } from 'mongoose';

export const CAPITAL_ACTIONS = [
  'Withdraw all',
  'Withdraw profit only',
  'Compound',
  'Increase allocation',
] as const;

export type CapitalAction = (typeof CAPITAL_ACTIONS)[number];

/**
 * A capital action an investor has asked for at their next review.
 *
 * The design flow is that the investor composes an email from the request
 * sheet; this record is logged alongside it so the manager has a queue rather
 * than an inbox, and nothing is lost if the email never gets sent.
 */
export interface CapitalRequestDoc extends Document {
  _id: mongoose.Types.ObjectId;
  account: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  action: CapitalAction;
  /** Name as typed on the request form. */
  contactName: string;
  amount: number;
  /** Equity at the moment of the request, for later reconciliation. */
  equityAtRequest: number;
  settlesAt: Date;
  status: 'pending' | 'settled' | 'cancelled';
  managerNote?: string;
  /** Audit trail, written once when the request is settled. */
  settledAt?: Date;
  equityBefore?: number;
  equityAfter?: number;
  payoutToInvestor?: number;
  feeToFirm?: number;
  settlementSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const capitalRequestSchema = new Schema<CapitalRequestDoc>(
  {
    account: { type: Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: CAPITAL_ACTIONS, required: true },
    contactName: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
    equityAtRequest: { type: Number, required: true },
    settlesAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ['pending', 'settled', 'cancelled'],
      default: 'pending',
      index: true,
    },
    managerNote: { type: String, maxlength: 2000 },
    settledAt: { type: Date },
    equityBefore: { type: Number },
    equityAfter: { type: Number },
    payoutToInvestor: { type: Number },
    feeToFirm: { type: Number },
    settlementSummary: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

export const CapitalRequest: Model<CapitalRequestDoc> =
  (mongoose.models.CapitalRequest as Model<CapitalRequestDoc>) ??
  mongoose.model<CapitalRequestDoc>('CapitalRequest', capitalRequestSchema);
