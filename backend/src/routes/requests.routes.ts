import { Router } from 'express';
import { z } from 'zod';
import { CAPITAL_ACTIONS, CapitalRequest } from '../models/CapitalRequest.js';
import { Account } from '../models/Account.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { HttpError, asyncHandler } from '../middleware/error.js';
import { loadAccountView } from '../services/portfolio.js';
import { SettlementError, computeSettlement } from '../services/settlement.js';

export const requestsRouter = Router();

requestsRouter.use(requireAuth);

const createSchema = z.object({
  action: z.enum(CAPITAL_ACTIONS),
  contactName: z.string().trim().min(2, 'Enter your full name.').max(120),
  amount: z.number().nonnegative('Enter an amount.'),
});

const updateSchema = z.object({
  status: z.enum(['pending', 'settled', 'cancelled']),
  managerNote: z.string().max(2000).optional(),
});

/**
 * Log a capital action the investor is requesting at their next review.
 *
 * The investor still composes the email from the request sheet — this record
 * exists so the request also lands in the manager's queue rather than living
 * only in someone's outbox.
 */
requestsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);

    const account = await Account.findOne({ owner: req.user!.id });
    if (!account) throw new HttpError(404, 'No portfolio account is linked to your login.');

    const view = await loadAccountView(account._id.toString());
    if (!view) throw new HttpError(404, 'That account does not exist.');

    const request = await CapitalRequest.create({
      account: account._id,
      requestedBy: req.user!.id,
      action: input.action,
      contactName: input.contactName,
      amount: input.amount,
      equityAtRequest: view.position.equity,
      settlesAt: new Date(view.nextDistribution),
    });

    res.status(201).json({ request });
  }),
);

/** The investor's own request history. */
requestsRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const account = await Account.findOne({ owner: req.user!.id }).select('_id').lean();
    if (!account) {
      res.json({ requests: [] });
      return;
    }
    const requests = await CapitalRequest.find({ account: account._id }).sort({ createdAt: -1 });
    res.json({ requests });
  }),
);

/** Manager queue across every account. */
requestsRouter.get(
  '/',
  requireManager,
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter = status && status !== 'all' ? { status } : {};

    const requests = await CapitalRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('account', 'reference tier')
      .populate('requestedBy', 'name email');

    res.json({ requests });
  }),
);

/**
 * What settling this request would do, without doing it.
 *
 * The manager sees the payout, the fee and the resulting high-water mark before
 * committing — settling moves real money and is not undoable from the UI.
 */
requestsRouter.get(
  '/:id/preview',
  requireManager,
  asyncHandler(async (req, res) => {
    const request = await CapitalRequest.findById(req.params.id);
    if (!request) throw new HttpError(404, 'That request does not exist.');

    const view = await loadAccountView(request.account.toString());
    if (!view) throw new HttpError(404, 'That account no longer exists.');

    try {
      const outcome = computeSettlement({
        action: request.action,
        equity: view.position.equity,
        depositedCapital: view.depositedCapital,
        highWaterMark: view.highWaterMark,
        amount: request.amount,
      });
      res.json({ preview: outcome, equityBefore: view.position.equity, blocked: null });
    } catch (err) {
      if (err instanceof SettlementError) {
        // Not an error the manager caused — report it as a state the queue can show.
        res.json({ preview: null, equityBefore: view.position.equity, blocked: err.message });
        return;
      }
      throw err;
    }
  }),
);

/**
 * Update a request. Moving it to "settled" is the distribution itself: it pays
 * out, crystallises the performance fee, and ratchets the high-water mark so the
 * same profit can never be charged again.
 */
requestsRouter.patch(
  '/:id',
  requireManager,
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const request = await CapitalRequest.findById(req.params.id);
    if (!request) throw new HttpError(404, 'That request does not exist.');

    const settling = input.status === 'settled' && request.status !== 'settled';

    if (input.status === 'settled' && request.status === 'settled') {
      throw new HttpError(409, 'That request has already been settled.');
    }
    if (settling && request.status === 'cancelled') {
      throw new HttpError(409, 'That request was cancelled. Log a new one to settle it.');
    }

    let accountView = null;

    if (settling) {
      const account = await Account.findById(request.account);
      if (!account) throw new HttpError(404, 'That account no longer exists.');
      if (account.status === 'closed') {
        throw new HttpError(409, 'That account is closed. Nothing further can settle against it.');
      }

      const view = await loadAccountView(account._id.toString());
      if (!view) throw new HttpError(404, 'That account no longer exists.');
      const equityBefore = view.position.equity;

      let outcome;
      try {
        outcome = computeSettlement({
          action: request.action,
          equity: equityBefore,
          depositedCapital: account.depositedCapital,
          highWaterMark: account.highWaterMark,
          amount: request.amount,
        });
      } catch (err) {
        if (err instanceof SettlementError) throw new HttpError(422, err.message);
        throw err;
      }

      account.depositedCapital = outcome.depositedCapitalAfter;
      account.highWaterMark = outcome.highWaterMarkAfter;
      account.equityAfterSettlement = outcome.equityAfter;
      account.lastSettlementAt = new Date();
      if (outcome.closesAccount) account.status = 'closed';
      await account.save();

      request.settledAt = account.lastSettlementAt;
      request.equityBefore = equityBefore;
      request.equityAfter = outcome.equityAfter;
      request.payoutToInvestor = outcome.payoutToInvestor;
      request.feeToFirm = outcome.feeToFirm;
      request.settlementSummary = outcome.summary;

      accountView = await loadAccountView(account._id.toString());
    }

    Object.assign(request, input);
    await request.save();

    res.json({ request, account: accountView });
  }),
);
