import mongoose, { Schema, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole = 'manager' | 'investor';

/** One unused recovery code. Only the digest is kept; the code is shown once. */
export interface RecoveryCodeEntry {
  hash: string;
  usedAt?: Date;
}

export interface UserDoc extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  /** Cleared on first successful login; drives the "change your password" prompt. */
  mustChangePassword: boolean;
  active: boolean;
  lastLoginAt?: Date;
  /**
   * Bumped whenever the password changes, by any route. Sessions carry the
   * version they were signed with, so every token issued before the change
   * stops verifying — a stolen session does not survive a password reset.
   */
  tokenVersion: number;
  /** Single-use codes for staff who have lost their password. */
  recoveryCodes: RecoveryCodeEntry[];
  recoveryCodesIssuedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  verifyPassword(plain: string): Promise<boolean>;
  setPassword(plain: string): Promise<void>;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Never selected by default — a stray .find() must not leak hashes.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['manager', 'investor'], required: true },
    mustChangePassword: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    tokenVersion: { type: Number, default: 0 },
    // Not selected by default, like the password hash.
    recoveryCodes: {
      type: [new Schema<RecoveryCodeEntry>({ hash: String, usedAt: Date }, { _id: false })],
      default: [],
      select: false,
    },
    recoveryCodesIssuedAt: { type: Date },
  },
  { timestamps: true },
);

const BCRYPT_ROUNDS = 12;

/**
 * Set the password and invalidate every session issued under the old one.
 *
 * The two belong together: a reset that leaves existing sessions working does
 * not actually eject whoever you were resetting because of.
 */
userSchema.methods.setPassword = async function setPassword(plain: string): Promise<void> {
  this.passwordHash = await bcrypt.hash(plain, BCRYPT_ROUNDS);
  this.tokenVersion = (this.tokenVersion ?? 0) + 1;
};

userSchema.methods.verifyPassword = async function verifyPassword(plain: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform(_doc, ret) {
    const shaped = ret as unknown as Record<string, unknown>;
    delete shaped.passwordHash;
    delete shaped.recoveryCodes;
    delete shaped.__v;
    return shaped;
  },
});

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>('User', userSchema);
