import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { computeSettlement, SettlementError } from './settlement.js';
import { derivePosition } from './domain.js';

/** An account $2,000 up on a $10,000 deposit that has never distributed. */
const inProfit = {
  equity: 12_000,
  depositedCapital: 10_000,
  highWaterMark: 10_000,
  amount: 0,
};

test('withdraw all pays capital plus the investor share and closes the account', () => {
  const out = computeSettlement({ ...inProfit, action: 'Withdraw all' });

  assert.equal(out.feeToFirm, 666.67); // a third of the $2,000 profit
  assert.equal(out.payoutToInvestor, 11_333.33); // $10,000 capital + $1,333.33 share
  assert.equal(out.equityAfter, 0);
  assert.equal(out.depositedCapitalAfter, 0);
  assert.equal(out.highWaterMarkAfter, 0);
  assert.equal(out.closesAccount, true);
});

test('withdraw all on a losing account charges no fee', () => {
  const out = computeSettlement({
    action: 'Withdraw all',
    equity: 8_000,
    depositedCapital: 10_000,
    highWaterMark: 10_000,
    amount: 0,
  });

  assert.equal(out.feeToFirm, 0);
  assert.equal(out.payoutToInvestor, 8_000); // what is left, and no debt carried
});

test('withdrawing profit returns equity to the mark and leaves it there', () => {
  const out = computeSettlement({ ...inProfit, action: 'Withdraw profit only' });

  assert.equal(out.payoutToInvestor, 1_333.33);
  assert.equal(out.feeToFirm, 666.67);
  assert.equal(out.equityAfter, 10_000);
  assert.equal(out.depositedCapitalAfter, 10_000); // capital untouched
  assert.equal(out.highWaterMarkAfter, 10_000); // equity is back at the mark
});

test('compounding ratchets the mark up to the new equity', () => {
  const out = computeSettlement({ ...inProfit, action: 'Compound' });

  assert.equal(out.payoutToInvestor, 0);
  assert.equal(out.feeToFirm, 666.67);
  assert.equal(out.equityAfter, 11_333.33); // fee leaves, the share stays in
  assert.equal(out.depositedCapitalAfter, 11_333.33); // share becomes principal
  assert.equal(out.highWaterMarkAfter, 11_333.33); // the ratchet
});

test('the ratchet stops the same profit being charged twice', () => {
  const first = computeSettlement({ ...inProfit, action: 'Compound' });

  // Nothing further happens; the very next review sees the same equity.
  const position = derivePosition({
    depositedCapital: first.depositedCapitalAfter,
    highWaterMark: first.highWaterMarkAfter,
    equity: first.equityAfter,
  });

  assert.equal(position.feeable, 0);
  assert.equal(position.fee, 0, 'a second fee on unchanged equity would be double-charging');

  // Only genuinely new profit is charged next time.
  const second = computeSettlement({
    action: 'Compound',
    equity: first.equityAfter + 1_500,
    depositedCapital: first.depositedCapitalAfter,
    highWaterMark: first.highWaterMarkAfter,
    amount: 0,
  });
  assert.equal(second.crystallisedProfit, 1_500);
  assert.equal(second.feeToFirm, 500);
});

test('a fall after compounding is not charged again on the way back up', () => {
  const compounded = computeSettlement({ ...inProfit, action: 'Compound' });
  const mark = compounded.highWaterMarkAfter; // 11,333.33

  // Equity drops, then recovers to just under the mark.
  const recovering = derivePosition({
    depositedCapital: compounded.depositedCapitalAfter,
    highWaterMark: mark,
    equity: mark - 200,
  });
  assert.equal(recovering.fee, 0);
  assert.equal(recovering.aboveHighWaterMark, false);
});

test('increasing allocation lifts equity, capital and the mark together', () => {
  const out = computeSettlement({
    action: 'Increase allocation',
    equity: 12_000,
    depositedCapital: 10_000,
    highWaterMark: 10_000,
    amount: 5_000,
  });

  assert.equal(out.feeToFirm, 0, 'adding money is not a distribution');
  assert.equal(out.equityAfter, 17_000);
  assert.equal(out.depositedCapitalAfter, 15_000);
  assert.equal(out.highWaterMarkAfter, 15_000);

  // The $2,000 of pre-existing profit is still fee-bearing, and only that.
  const after = derivePosition({
    depositedCapital: out.depositedCapitalAfter,
    highWaterMark: out.highWaterMarkAfter,
    equity: out.equityAfter,
  });
  assert.equal(after.feeable, 2_000, 'the new deposit must not be treated as profit');
});

test('profit-only and compound are refused when there is no profit', () => {
  const underwater = {
    equity: 9_000,
    depositedCapital: 10_000,
    highWaterMark: 10_000,
    amount: 0,
  } as const;

  assert.throws(
    () => computeSettlement({ ...underwater, action: 'Withdraw profit only' }),
    SettlementError,
  );
  assert.throws(() => computeSettlement({ ...underwater, action: 'Compound' }), SettlementError);
});

test('increasing allocation needs an amount', () => {
  assert.throws(
    () => computeSettlement({ ...inProfit, action: 'Increase allocation', amount: 0 }),
    SettlementError,
  );
});

test('an account that never profited compounds nothing and keeps its mark', () => {
  assert.throws(
    () =>
      computeSettlement({
        action: 'Compound',
        equity: 10_000,
        depositedCapital: 10_000,
        highWaterMark: 10_000,
        amount: 0,
      }),
    SettlementError,
  );
});
