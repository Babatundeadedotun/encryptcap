/**
 * Domain rules for Encrypt Capital.
 *
 * All money maths lives here and runs on the server. The client renders what
 * this produces and never computes a fee, share or equity figure of its own.
 */

export const FEE_RATE = 1 / 3; // 33.3% performance fee, charged on profit only
export const KEEP_RATE = 2 / 3; // investor keeps 66.7%

export type TierId = 'x100' | 'consortium' | 'gold';

export interface Tier {
  id: TierId;
  label: string;
  short: string;
  min: number;
  cycleMo: number;
  cycle: string;
  tag: string;
}

export const TIERS: Record<TierId, Tier> = {
  x100: {
    id: 'x100',
    label: '100X Portfolio',
    short: '100X',
    min: 1000,
    cycleMo: 12,
    cycle: '12-month',
    tag: 'Long-term growth',
  },
  consortium: {
    id: 'consortium',
    label: 'Consortium',
    short: 'Consortium',
    min: 2500,
    cycleMo: 3,
    cycle: 'Quarterly',
    tag: 'The steady compounder',
  },
  gold: {
    id: 'gold',
    label: 'Private / Gold',
    short: 'Private/Gold',
    min: 50000,
    cycleMo: 1,
    cycle: 'Monthly',
    tag: 'High-net-worth',
  },
};

export const TIER_IDS = Object.keys(TIERS) as TierId[];

export interface DerivedPosition {
  /** Latest closing equity, or deposited capital when nothing has been posted. */
  equity: number;
  /** equity − depositedCapital. Can be negative. */
  profit: number;
  /** Profit above the high-water mark; only this is fee-bearing. */
  feeable: number;
  /** 33.3% of feeable profit. */
  fee: number;
  /** 66.7% of feeable profit — the investor's projected share. */
  investorShare: number;
  aboveHighWaterMark: boolean;
  /** Return on deposited capital, as a ratio (0.12 = +12%). */
  returnOnCapital: number;
}

/**
 * Fee is charged on profit above the high-water mark only, so an account that
 * fell and recovered pays nothing until it clears its previous peak. A losing
 * account pays no fee and carries no debt.
 */
export function derivePosition(input: {
  depositedCapital: number;
  highWaterMark: number;
  equity: number;
}): DerivedPosition {
  const { depositedCapital, highWaterMark, equity } = input;
  const profit = equity - depositedCapital;
  const feeable = Math.max(0, equity - highWaterMark);
  const fee = feeable * FEE_RATE;
  const investorShare = feeable * KEEP_RATE;

  return {
    equity,
    profit,
    feeable,
    fee,
    investorShare,
    aboveHighWaterMark: equity > highWaterMark,
    returnOnCapital: depositedCapital > 0 ? profit / depositedCapital : 0,
  };
}

/**
 * The next distribution date: step forward from the join date in whole cycles
 * until we pass `from`. Always returns a date strictly in the future so an
 * investor never sees a review date that has already gone by.
 */
export function nextDistribution(joinedAt: Date, tier: TierId, from: Date = new Date()): Date {
  const { cycleMo } = TIERS[tier];
  const next = new Date(joinedAt.getFullYear(), joinedAt.getMonth(), 1);
  // Guard against a pathological loop if a bad cycle length ever lands here.
  let guard = 0;
  while (next <= from && guard < 1000) {
    next.setMonth(next.getMonth() + cycleMo);
    guard += 1;
  }
  return next;
}

/** Sort key for a monthly period, e.g. 2026-06 -> 202606. */
export function periodKey(year: number, month: number): number {
  return year * 100 + month;
}

export function periodLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}
