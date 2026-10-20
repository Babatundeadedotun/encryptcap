import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Account } from '../models/Account.js';
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
  type AuthUser,
} from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { doorRefusal } from '../services/doors.js';
import { requireManager } from '../middleware/auth.js';
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  recoveryCodeMatches,
  toStoredCodes,
} from '../services/recovery.js';

export const authRouter = Router();

/** Blunt brute-force brake on the credential endpoints. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in a few minutes.' },
});

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  /**
   * Which door the credentials were presented at.
   *
   * 'staff' is the manager sign-in at /admin and accepts managers only — an
   * investor's own password will not open it. 'investor' is the public sign-in
   * and accepts either role, sending a manager on to the console.
   *
   * Checked here rather than in the browser, so the rule holds for anything
   * posting straight to the API.
   */
  scope: z.enum(['investor', 'staff']).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200, 'That password is too long.'),
});

async function shapeUser(user: AuthUser): Promise<
  AuthUser & { accountId?: string; accountReference?: string }
> {
  if (user.role !== 'investor') return user;
  const account = await Account.findOne({ owner: user.id }).select('reference').lean();
  return {
    ...user,
    accountId: account?._id.toString(),
    accountReference: account?.reference,
  };
}

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, scope } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    // Same message whether the email is unknown or the password is wrong, so
    // the endpoint can't be used to enumerate who holds an account.
    const invalid = new HttpError(401, 'That email and password don’t match.');
    if (!user || !user.active) throw invalid;
    if (!(await user.verifyPassword(password))) throw invalid;

    /*
     * Deliberately after the password check. Refusing before it would tell
     * anyone guessing which addresses are staff accounts; after it, the caller
     * has already proved the account is theirs, so the message gives away
     * nothing new. No session is issued on refusal.
     */
    const refusal = doorRefusal(scope, user.role);
    if (refusal) throw new HttpError(403, refusal);

    user.lastLoginAt = new Date();
    await user.save();

    setAuthCookie(res, signToken(user._id.toString(), user.tokenVersion));

    res.json({
      user: await shapeUser({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      }),
    });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await shapeUser(req.user!) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user!.id).select('+passwordHash');
    if (!user) throw new HttpError(401, 'Your session is no longer valid.');
    if (!(await user.verifyPassword(currentPassword))) {
      throw new HttpError(401, 'That current password is not right.');
    }

    await user.setPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    // Changing the password invalidates every session, this one included, so
    // re-issue the cookie at the new version. Other devices stay signed out.
    setAuthCookie(res, signToken(user._id.toString(), user.tokenVersion));
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------------- recovery */

/**
 * Far tighter than the login brake. Recovery is rare and the codes are
 * high-entropy, so anything hammering this endpoint is not a forgetful manager.
 */
const recoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many recovery attempts. Try again later.' },
});

const recoverSchema = z.object({
  email: z.string().email('Enter the email address on the account.'),
  code: z.string().trim().min(8, 'Enter one of your recovery codes.').max(64),
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(200, 'That password is too long.'),
});

/**
 * Spend a recovery code to set a new password.
 *
 * No session is issued here. Proving possession of a code earns the right to
 * set a password, not to be signed in — the new password still has to be used
 * at /admin, which keeps this endpoint from being a way to obtain a session.
 */
authRouter.post(
  '/recover',
  recoveryLimiter,
  asyncHandler(async (req, res) => {
    const { email, code, newPassword } = recoverSchema.parse(req.body);

    // One message for every failure: wrong address, no codes issued, code
    // already spent, wrong code. Anything more tells an attacker which of
    // those they got right.
    const failed = new HttpError(401, 'That code is not valid for that account.');

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+passwordHash +recoveryCodes',
    );
    if (!user || !user.active) throw failed;

    const entry = user.recoveryCodes.find(
      (candidate) => !candidate.usedAt && recoveryCodeMatches(code, candidate.hash),
    );
    if (!entry) throw failed;

    entry.usedAt = new Date();
    // setPassword bumps tokenVersion, so every existing session dies here.
    await user.setPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    const remaining = user.recoveryCodes.filter((candidate) => !candidate.usedAt).length;
    res.json({ ok: true, remaining });
  }),
);

/** How many codes are left, for the console to show. Never returns codes. */
authRouter.get(
  '/recovery-codes',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).select('+recoveryCodes');
    if (!user) throw new HttpError(401, 'Your session is no longer valid.');

    res.json({
      remaining: user.recoveryCodes.filter((candidate) => !candidate.usedAt).length,
      total: user.recoveryCodes.length,
      issuedAt: user.recoveryCodesIssuedAt ?? null,
    });
  }),
);

/**
 * Issue a fresh set, replacing any that exist. This is the only time the codes
 * are readable — only their digests are stored, so a lost set cannot be
 * recovered, only replaced.
 */
authRouter.post(
  '/recovery-codes',
  requireAuth,
  requireManager,
  asyncHandler(async (req, res) => {
    const { password } = z
      .object({ password: z.string().min(1, 'Enter your password to confirm.') })
      .parse(req.body);

    const user = await User.findById(req.user!.id).select('+passwordHash +recoveryCodes');
    if (!user) throw new HttpError(401, 'Your session is no longer valid.');

    /*
     * Re-ask for the password even though the session is already valid. A set
     * of recovery codes is long-lived access to this account, so minting one
     * should take more than an unlocked laptop or a borrowed session.
     */
    if (!(await user.verifyPassword(password))) {
      throw new HttpError(401, 'That password is not right.');
    }

    const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
    user.recoveryCodes = toStoredCodes(codes);
    user.recoveryCodesIssuedAt = new Date();
    await user.save();

    res.json({ codes, issuedAt: user.recoveryCodesIssuedAt });
  }),
);
