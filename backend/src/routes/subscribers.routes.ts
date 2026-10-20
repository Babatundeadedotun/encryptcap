import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Subscriber } from '../models/Subscriber.js';
import { requireAuth, requireManager } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

export const subscribersRouter = Router();

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many sign-ups from this connection. Try again later.' },
});

const signupSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  source: z.string().trim().max(60).optional(),
});

/** Public research mailing list sign-up. */
subscribersRouter.post(
  '/',
  signupLimiter,
  asyncHandler(async (req, res) => {
    const { email, source } = signupSchema.parse(req.body);

    // Re-subscribing is idempotent, and a duplicate must not reveal that the
    // address is already on the list.
    await Subscriber.findOneAndUpdate(
      { email: email.toLowerCase() },
      { $set: { active: true }, $setOnInsert: { source: source ?? 'reports' } },
      { upsert: true, new: true },
    );

    res.status(201).json({ ok: true });
  }),
);

/** Manager view, for exporting into whatever sends the actual email. */
subscribersRouter.get(
  '/',
  requireAuth,
  requireManager,
  asyncHandler(async (_req, res) => {
    const subscribers = await Subscriber.find({ active: true }).sort({ createdAt: -1 });
    res.json({ subscribers, count: subscribers.length });
  }),
);
