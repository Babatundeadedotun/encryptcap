/**
 * Tests for the fee and distribution rules. No database required.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FEE_RATE, KEEP_RATE, TIERS, derivePosition, nextDistribution } from './domain.js';
import { buildSeedBook, TIMELINE } from '../seed/data.js';

test('fee and investor share split profit 1/3 : 2/3', () => {
  const p = derivePosition({ depositedCapital: 10_000, highWaterMark: 10_000, equity: 12_000 });

  assert.equal(p.profit, 2000);
  assert.equal(p.feeable, 2000);
  assert.ok(Math.abs(p.fee - 2000 * FEE_RATE) < 1e-9);
  assert.ok(Math.abs(p.investorShare - 2000 * KEEP_RATE) < 1e-9);
  // The worked example on the pricing page: $2,000 profit -> ~$1,334 / ~$666.
  assert.equal(Math.round(p.investorShare), 1333);
  assert.equal(Math.round(p.fee), 667);
});

test('a losing account pays no fee and carries no debt', () => {
  const p = derivePosition({ depositedCapital: 10_000, highWaterMark: 10_000, equity: 8_500 });

  assert.equal(p.profit, -1500);
  assert.equal(p.feeable, 0);
  assert.equal(p.fee, 0);
  assert.equal(p.investorShare, 0);
  assert.equal(p.aboveHighWaterMark, false);
});

test('no fee is charged while an account is recovering toward its high-water mark', () => {
  // Peaked at 12,000, fell, now back to 11,000 — still below the mark.
  const p = derivePosition({ depositedCapital: 10_000, highWaterMark: 12_000, equity: 11_000 });

  assert.equal(p.profit, 1000, 'the investor is up on their deposit');
  assert.equal(p.fee, 0, 'but no fee applies until the previous peak is cleared');
  assert.equal(p.feeable, 0);
});

test('fee applies only to the portion above the high-water mark', () => {
  const p = derivePosition({ depositedCapital: 10_000, highWaterMark: 12_000, equity: 15_000 });

  assert.equal(p.profit, 5000);
  assert.equal(p.feeable, 3000, 'only the 3,000 above the mark is fee-bearing');
  assert.ok(Math.abs(p.fee - 1000) < 1e-9);
});

test('return on capital is reported against the deposit, not the mark', () => {
  const p = derivePosition({ depositedCapital: 8_000, highWaterMark: 8_000, equity: 10_000 });
  assert.ok(Math.abs(p.returnOnCapital - 0.25) < 1e-9);
});

test('an account with no capital does not divide by zero', () => {
  const p = derivePosition({ depositedCapital: 0, highWaterMark: 0, equity: 0 });
  assert.equal(p.returnOnCapital, 0);
});

test('next distribution steps by the tier cycle and is always in the future', () => {
  const joined = new Date(2026, 0, 1); // January 2026
  const from = new Date(2026, 5, 15); // mid-June 2026

  const quarterly = nextDistribution(joined, 'consortium', from);
  assert.equal(quarterly.getMonth(), 6, 'quarterly from January lands on July');
  assert.equal(quarterly.getFullYear(), 2026);
  assert.ok(quarterly > from);

  const monthly = nextDistribution(joined, 'gold', from);
  assert.ok(monthly > from);
  assert.equal(monthly.getMonth(), 6);

  const annual = nextDistribution(joined, 'x100', from);
  assert.equal(annual.getFullYear(), 2027, 'a 12-month cycle from January 2026 pays January 2027');
  assert.equal(annual.getMonth(), 0);
});

test('every tier has a coherent minimum and cycle', () => {
  for (const tier of Object.values(TIERS)) {
    assert.ok(tier.min > 0, `${tier.id} needs a minimum`);
    assert.ok(tier.cycleMo >= 1 && tier.cycleMo <= 12, `${tier.id} cycle is out of range`);
    assert.ok(tier.label.length > 0);
  }
  assert.equal(TIERS.x100.min, 1000, 'the site advertises entry from $1,000');
});

test('the seeded book is deterministic and internally consistent', () => {
  const a = buildSeedBook();
  const b = buildSeedBook();

  assert.equal(a.length, 30);
  assert.deepEqual(
    a.map((x) => [x.name, x.depositedCapital, x.tier]),
    b.map((x) => [x.name, x.depositedCapital, x.tier]),
    'the same seed must produce the same book',
  );

  assert.equal(new Set(a.map((x) => x.email)).size, 30, 'investor emails must be unique');

  for (const account of a) {
    assert.ok(
      account.depositedCapital >= TIERS[account.tier].min,
      `${account.name} is below the ${account.tier} minimum`,
    );
    assert.equal(
      account.series[account.startMonth],
      account.depositedCapital,
      'an account opens at its deposited capital',
    );
    for (let m = 0; m < account.startMonth; m += 1) {
      assert.equal(account.series[m], null, 'no equity before the account was funded');
    }
    assert.equal(account.series.length, TIMELINE.length);
  }
});

test('the seeded book contains both winners and losers', () => {
  const book = buildSeedBook();
  const finals = book.map((a) => {
    const last = [...a.series].reverse().find((v) => v != null)!;
    return last - a.depositedCapital;
  });

  assert.ok(
    finals.some((f) => f > 0),
    'some accounts should be in profit',
  );
  assert.ok(
    finals.some((f) => f < 0),
    'some accounts should be down — a book where everyone wins is not credible',
  );
});
