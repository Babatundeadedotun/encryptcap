import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { Account, nextAccountReference } from '../models/Account.js';
import { PerformanceRecord } from '../models/PerformanceRecord.js';
import { User } from '../models/User.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { loadAccountView, loadBook } from '../services/portfolio.js';
import { TIER_IDS } from '../services/domain.js';
import { streamMonthlyReport, streamPositionStatement } from '../services/statements.js';

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

const createAccountSchema = z.object({
  name: z.string().trim().min(2, 'Enter the investor’s full name.').max(120),
  email: z.string().trim().email('Enter a valid email address.'),
  tier: z.enum(TIER_IDS as [string, ...string[]]),
  depositedCapital: z.number().positive('Capital must be more than zero.'),
  joinedAt: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

const updateAccountSchema = z.object({
  tier: z.enum(TIER_IDS as [string, ...string[]]).optional(),
  depositedCapital: z.number().positive().optional(),
  highWaterMark: z.number().min(0).optional(),
  joinedAt: z.coerce.date().optional(),
  status: z.enum(['active', 'closed']).optional(),
  notes: z.string().max(2000).optional(),
});

const recordSchema = z.object({
  year: z.number().int().min(2000).max(2999),
  month: z.number().int().min(1).max(12),
  openingBalance: z.number(),
  nfpResult: z.number(),
  realisedPnl: z.number(),
  closingEquity: z.number(),
  brokerVerified: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

/** Readable one-off password handed to the manager to pass on to the investor. */
function temporaryPassword(): string {
  return `EC-${randomBytes(6).toString('base64url')}`;
}

/** An investor may only ever read their own account. */
async function assertCanView(
  accountId: string,
  user: { id: string; role: string },
): Promise<void> {
  if (user.role === 'manager') return;
  const account = await Account.findById(accountId).select('owner').lean();
  if (!account) throw new HttpError(404, 'That account does not exist.');
  if (account.owner.toString() !== user.id) {
    throw new HttpError(403, 'You do not have access to that account.');
  }
}

/* ------------------------------------------------------------- investor */

accountsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne({ owner: req.user!.id }).select('_id').lean();
    if (!account) {
      throw new HttpError(404, 'No portfolio account is linked to your login yet.');
    }
    res.json({ account: await loadAccountView(account._id.toString()) });
  }),
);

/* -------------------------------------------------------------- manager */

accountsRouter.get(
  '/',
  requireManager,
  asyncHandler(async (_req, res) => {
    res.json(await loadBook());
  }),
);

accountsRouter.post(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const input = createAccountSchema.parse(req.body);

    const existing = await User.findOne({ email: input.email.toLowerCase() }).lean();
    if (existing) throw new HttpError(409, 'Someone already holds a login with that email.');

    const password = temporaryPassword();
    const user = new User({
      name: input.name,
      email: input.email.toLowerCase(),
      role: 'investor',
      mustChangePassword: true,
    });
    await user.setPassword(password);
    await user.save();

    let account;
    try {
      account = await Account.create({
        reference: await nextAccountReference(),
        owner: user._id,
        tier: input.tier,
        depositedCapital: input.depositedCapital,
        // Fee applies above deposited capital until a distribution resets it.
        highWaterMark: input.depositedCapital,
        joinedAt: input.joinedAt,
        notes: input.notes,
      });
    } catch (err) {
      // Don't leave a login with no portfolio behind it.
      await User.deleteOne({ _id: user._id });
      throw err;
    }

    res.status(201).json({
      account: await loadAccountView(account._id.toString()),
      // Shown once, never stored in plain text. The manager passes it on.
      temporaryPassword: password,
    });
  }),
);

accountsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertCanView(req.params.id, req.user!);
    const account = await loadAccountView(req.params.id);
    if (!account) throw new HttpError(404, 'That account does not exist.');
    res.json({ account });
  }),
);

accountsRouter.patch(
  '/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    const input = updateAccountSchema.parse(req.body);
    const account = await Account.findById(req.params.id);
    if (!account) throw new HttpError(404, 'That account does not exist.');

    Object.assign(account, input);
    await account.save();

    res.json({ account: await loadAccountView(account._id.toString()) });
  }),
);

/**
 * Issue a fresh one-off password for an investor who has lost theirs.
 *
 * The manager reads it out and the investor is forced to change it on next
 * login. This is the only reset path — there is no self-service email flow.
 */
accountsRouter.post(
  '/:id/reset-password',
  requireManager,
  asyncHandler(async (req, res) => {
    const account = await Account.findById(req.params.id).select('owner').lean();
    if (!account) throw new HttpError(404, 'That account does not exist.');

    const user = await User.findById(account.owner).select('+passwordHash');
    if (!user) throw new HttpError(404, 'That investor no longer has a login.');

    const password = temporaryPassword();
    await user.setPassword(password);
    user.mustChangePassword = true;
    await user.save();

    res.json({ temporaryPassword: password, email: user.email });
  }),
);

/* --------------------------------------------------- performance records */

accountsRouter.get(
  '/:id/records',
  asyncHandler(async (req, res) => {
    await assertCanView(req.params.id, req.user!);
    const records = await PerformanceRecord.find({ account: req.params.id }).sort({
      periodKey: -1,
    });
    res.json({ records });
  }),
);

accountsRouter.post(
  '/:id/records',
  requireManager,
  asyncHandler(async (req, res) => {
    const input = recordSchema.parse(req.body);
    const account = await Account.findById(req.params.id);
    if (!account) throw new HttpError(404, 'That account does not exist.');

    const duplicate = await PerformanceRecord.findOne({
      account: account._id,
      periodKey: input.year * 100 + input.month,
    }).lean();
    if (duplicate) {
      throw new HttpError(409, 'A report for that month already exists on this account.');
    }

    await PerformanceRecord.create({
      ...input,
      account: account._id,
      createdBy: req.user!.id,
    });

    res.status(201).json({ account: await loadAccountView(account._id.toString()) });
  }),
);

accountsRouter.patch(
  '/:id/records/:recordId',
  requireManager,
  asyncHandler(async (req, res) => {
    const input = recordSchema.partial().parse(req.body);
    const record = await PerformanceRecord.findOne({
      _id: req.params.recordId,
      account: req.params.id,
    });
    if (!record) throw new HttpError(404, 'That report does not exist.');

    Object.assign(record, input);
    await record.save();

    res.json({ account: await loadAccountView(req.params.id) });
  }),
);

accountsRouter.delete(
  '/:id/records/:recordId',
  requireManager,
  asyncHandler(async (req, res) => {
    const result = await PerformanceRecord.deleteOne({
      _id: req.params.recordId,
      account: req.params.id,
    });
    if (!result.deletedCount) throw new HttpError(404, 'That report does not exist.');
    res.json({ account: await loadAccountView(req.params.id) });
  }),
);

/* -------------------------------------------------------- statement PDFs */

accountsRouter.get(
  '/:id/statements/position.pdf',
  asyncHandler(async (req, res) => {
    await assertCanView(req.params.id, req.user!);
    const account = await loadAccountView(req.params.id);
    if (!account) throw new HttpError(404, 'That account does not exist.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${account.reference}-capital-position.pdf"`,
    );
    streamPositionStatement(res, account);
  }),
);

accountsRouter.get(
  '/:id/statements/:recordId.pdf',
  asyncHandler(async (req, res) => {
    await assertCanView(req.params.id, req.user!);

    const account = await loadAccountView(req.params.id);
    if (!account) throw new HttpError(404, 'That account does not exist.');

    const record = await PerformanceRecord.findOne({
      _id: req.params.recordId,
      account: req.params.id,
    });
    if (!record) throw new HttpError(404, 'That report does not exist.');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${account.reference}-${record.year}-${String(record.month).padStart(2, '0')}.pdf"`,
    );
    streamMonthlyReport(res, account, record);
  }),
);
