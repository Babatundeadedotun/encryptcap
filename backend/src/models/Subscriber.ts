import mongoose, { Schema, type Document, type Model } from 'mongoose';

/** Someone who asked to be emailed when new research is published. */
export interface SubscriberDoc extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  /** Where they signed up, so a future list can be segmented. */
  source: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriberSchema = new Schema<SubscriberDoc>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: { type: String, default: 'reports', maxlength: 60 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Subscriber: Model<SubscriberDoc> =
  (mongoose.models.Subscriber as Model<SubscriberDoc>) ??
  mongoose.model<SubscriberDoc>('Subscriber', subscriberSchema);
