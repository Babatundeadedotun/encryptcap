import { FEE_RATE, KEEP_RATE } from './domain.js';
import type { CapitalAction } from '../models/CapitalRequest.js';

/**
 * What settling a capital request does to an account.
 *
 * The fee is *crystallised* here and nowhere else. Between distributions the
 * desk only ever shows a projection — the high-water mark stays put, so an
 * account that dips and recovers is never charged twice for the same gains.
 * At settlement the profit is actually paid out or folded into capital, and the
 * mark ratchets up to the new equity so those same gains can't be charged again
 * at the next review.
 *
 * Every figure is derived from the position at settlement time; nothing here
 * reads or writes the database, which keeps the arithmetic testable on its own.
 */

export interface SettlementInput {
  action: CapitalAction;
  /** Current equity — the latest posted closing equity. */
  equity: number;
  depositedCapital: number;
  highWaterMark: number;
  /** Only meaningful for "Increase allocation": the new money coming in. */
  amount: number;
}

export interface SettlementOutcome {
  /** Cash leaving the account to the investor. */
  payoutToInvestor: number;
  /** Cash leaving the account to Encrypt Capital. */
  feeToFirm: number;
  /** Profit that was fee-bearing at settlement. */
  crystallisedProfit: number;
  equityAfter: number;
  depositedCapitalAfter: number;
  /** The ratchet — never moves down while the account stays open. */
  highWaterMarkAfter: number;
  closesAccount: boolean;
  /** Plain-language summary, stored on the request and shown in the queue. */
  summary: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Thrown for a request that cannot be settled as asked. */
export class SettlementError extends Error {}

export function computeSettlement(input: SettlementInput): SettlementOutcome {
  const { action, equity, depositedCapital, highWaterMark, amount } = input;

  const crystallised = Math.max(0, equity - highWaterMark);
  const fee = round(crystallised * FEE_RATE);
  const share = round(crystallised * KEEP_RATE);

  const money = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  switch (action) {
    /*
     * Full exit. The investor takes their capital plus their share of any
     * profit; the firm takes its cut of that profit. The account is emptied and
     * closed, so both the capital and the mark go to zero.
     */
    case 'Withdraw all': {
      const payout = round(equity - fee);
      return {
        payoutToInvestor: payout,
        feeToFirm: fee,
        crystallisedProfit: crystallised,
        equityAfter: 0,
        depositedCapitalAfter: 0,
        highWaterMarkAfter: 0,
        closesAccount: true,
        summary:
          `Full exit: ${money(payout)} paid out` +
          (fee > 0 ? `, ${money(fee)} performance fee` : ' (no fee — no profit to charge)') +
          '. Account closed.',
      };
    }

    /*
     * Profit is taken out, capital stays working. Equity falls back to the mark
     * it started the cycle on, so the mark itself does not move.
     */
    case 'Withdraw profit only': {
      if (crystallised <= 0) {
        throw new SettlementError(
          'This account is at or below its high-water mark, so there is no profit to withdraw. ' +
            'Cancel the request or settle it as a full withdrawal instead.',
        );
      }
      return {
        payoutToInvestor: share,
        feeToFirm: fee,
        crystallisedProfit: crystallised,
        equityAfter: round(equity - crystallised),
        depositedCapitalAfter: depositedCapital,
        highWaterMarkAfter: highWaterMark,
        closesAccount: false,
        summary:
          `${money(share)} profit paid out, ${money(fee)} performance fee. ` +
          `Capital of ${money(depositedCapital)} stays invested.`,
      };
    }

    /*
     * Profit stays in. The firm still takes its fee in cash, the investor's
     * share becomes principal, and the mark ratchets up to the resulting
     * equity — that is what stops the same profit being charged again.
     */
    case 'Compound': {
      if (crystallised <= 0) {
        throw new SettlementError(
          'There is no profit above the high-water mark to compound. ' +
            'Cancel the request, or post the period’s report first.',
        );
      }
      const equityAfter = round(equity - fee);
      return {
        payoutToInvestor: 0,
        feeToFirm: fee,
        crystallisedProfit: crystallised,
        equityAfter,
        depositedCapitalAfter: round(depositedCapital + share),
        highWaterMarkAfter: equityAfter,
        closesAccount: false,
        summary:
          `${money(share)} profit compounded into capital, ${money(fee)} performance fee. ` +
          `Capital now ${money(round(depositedCapital + share))}; high-water mark reset to ` +
          `${money(equityAfter)}.`,
      };
    }

    /*
     * New money. It lifts equity, capital and the mark by the same amount, so
     * a fresh deposit is never mistaken for profit at the next review.
     */
    case 'Increase allocation': {
      if (amount <= 0) {
        throw new SettlementError('Set the amount being added before settling this request.');
      }
      return {
        payoutToInvestor: 0,
        feeToFirm: 0,
        crystallisedProfit: 0,
        equityAfter: round(equity + amount),
        depositedCapitalAfter: round(depositedCapital + amount),
        highWaterMarkAfter: round(highWaterMark + amount),
        closesAccount: false,
        summary:
          `${money(amount)} added. Capital now ${money(round(depositedCapital + amount))}; ` +
          `high-water mark lifted to ${money(round(highWaterMark + amount))} so the new deposit ` +
          'is not treated as profit.',
      };
    }

    default: {
      const never: never = action;
      throw new SettlementError(`Unsupported capital action: ${String(never)}`);
    }
  }
}
