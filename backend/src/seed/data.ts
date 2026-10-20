/**
 * The synthetic book from the Claude Design prototype, ported so a fresh
 * install has something to look at. Deterministic: the same seed produces the
 * same 30 accounts every run.
 *
 * These are invented people and invented figures. Replace them with the real
 * book before this goes anywhere near a customer.
 */
import type { TierId } from '../services/domain.js';

/** Mulberry32 — small seeded PRNG, carried over from the prototype. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Tunde', 'Amaka', 'Kola', 'Ada', 'Chidi', 'Ngozi', 'Emeka', 'Funke', 'Bola', 'Yusuf',
  'Zainab', 'Ifeoma', 'Segun', 'Halima', 'Obinna', 'Damilola', 'Uche', 'Tobi', 'Aisha', 'Femi',
  'Nkechi', 'Suleiman', 'Bisi', 'Ekene', 'Maryam', 'Lekan', 'Chioma', 'Idris', 'Folake', 'Gbenga',
];

const LAST = [
  'Adeyemi', 'Okafor', 'Bello', 'Nwosu', 'Eze', 'Balogun', 'Mohammed', 'Okonkwo', 'Adeleke',
  'Ibrahim', 'Onyeka', 'Abubakar', 'Olawale', 'Chukwu', 'Sani', 'Adebayo', 'Nnamdi', 'Yakubu',
  'Oluwaseun', 'Danjuma', 'Okeke', 'Lawal', 'Ogundipe', 'Hassan', 'Uzoma', 'Akinola', 'Musa',
];

/** The 12 months the prototype's book runs over: 2025-07 through 2026-06. */
export const TIMELINE = (() => {
  const out: Array<{ year: number; month: number }> = [];
  const end = new Date(2026, 5, 1);
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return out;
})();

export interface SeedAccount {
  name: string;
  email: string;
  tier: TierId;
  depositedCapital: number;
  /** Index into TIMELINE of the month the account was funded. */
  startMonth: number;
  /** Equity at each month's close; null before the account existed. */
  series: Array<number | null>;
}

export function buildSeedBook(): SeedAccount[] {
  const r = rng(73);
  const mix: TierId[] = [
    ...Array<TierId>(13).fill('x100'),
    ...Array<TierId>(11).fill('consortium'),
    ...Array<TierId>(6).fill('gold'),
  ];

  return mix.map((tier, i) => {
    const depositedCapital =
      tier === 'x100'
        ? Math.round((1000 + r() * 3500) / 100) * 100
        : tier === 'consortium'
          ? Math.round((2500 + r() * 6500) / 250) * 250
          : Math.round((50000 + r() * 60000) / 1000) * 1000;

    const startMonth = Math.floor(r() * 8);
    const vol = 0.04 + r() * 0.05;
    const fate = r();

    // Most accounts grind upward; roughly one in eight is a genuine loser, and
    // a further slice takes a late drawdown — the book should not look perfect.
    let meanRet = 0.02 + r() * 0.03;
    if (fate < 0.12) meanRet = -0.045 + r() * 0.05;

    const rets: number[] = [];
    for (let m = startMonth + 1; m < 12; m += 1) {
      rets.push(meanRet + (r() - 0.5) * 2 * vol);
    }

    const drawdown = fate >= 0.12 && fate < 0.32;
    if (drawdown && rets.length >= 2) {
      rets[rets.length - 1] = -(0.06 + r() * 0.08);
      rets[rets.length - 2] = -(0.03 + r() * 0.06);
    }

    const series = new Array<number | null>(12).fill(null);
    let equity = depositedCapital;
    let ri = 0;
    for (let m = startMonth; m < 12; m += 1) {
      if (m !== startMonth) equity *= 1 + rets[ri++];
      series[m] = Math.round(equity);
    }

    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];

    return {
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + '@example.com',
      tier,
      depositedCapital,
      startMonth,
      series,
    };
  });
}
