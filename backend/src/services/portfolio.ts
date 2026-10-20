import type { Types } from 'mongoose';
import { Account, type AccountDoc } from '../models/Account.js';
import { PerformanceRecord, type PerformanceRecordDoc } from '../models/PerformanceRecord.js';
import type { UserDoc } from '../models/User.js';
import {
  TIERS,
  type TierId,
  derivePosition,
  nextDistribution,
  periodLabel,
  type DerivedPosition,
} from './domain.js';

export interface SeriesPoint {
  label: string;
  periodKey: number;
  equity: number;
  capital: number;
}

export interface MonthlyReport {
  period: string;
  openingBalance: number;
  nfpResult: number;
  realisedPnl: number;
  closingEquity: number;
  brokerVerified: boolean;
}

export interface AccountView {
  id: string;
  reference: string;
  investorName: string;
  investorEmail: string;
  tier: TierId;
  tierLabel: string;
  tierCycle: string;
  depositedCapital: number;
  highWaterMark: number;
  joinedAt: string;
  joinedLabel: string;
  status: 'active' | 'closed';
  nextDistribution: string;
  nextDistributionLabel: string;
  position: DerivedPosition;
  series: SeriesPoint[];
  latestReport: MonthlyReport | null;
  reportCount: number;
}

type PopulatedOwner = Pick<UserDoc, 'name' | 'email'>;

function ownerOf(account: AccountDoc): PopulatedOwner {
  const owner = account.owner as unknown as PopulatedOwner | Types.ObjectId | undefined;
  if (owner && typeof owner === 'object' && 'name' in owner) return owner;
  return { name: 'Unknown investor', email: '' };
}

/**
 * Current equity.
 *
 * Normally the latest posted closing equity. A settled distribution moves money
 * out of the account between reports, so its resulting equity wins until the
 * manager posts a report dated after it — otherwise the desk would keep showing
 * pre-payout equity and re-derive a fee on profit that has already been paid.
 */
export function equityFromRecords(account: AccountDoc, records: PerformanceRecordDoc[]): number {
  const latest = records.length ? records[records.length - 1] : null;
  const settledAt = account.lastSettlementAt;
  const settledEquity = account.equityAfterSettlement;

  if (settledAt && typeof settledEquity === 'number') {
    const supersededByReport = latest ? latest.createdAt > settledAt : false;
    if (!supersededByReport) return settledEquity;
  }

  if (!latest) return account.depositedCapital;
  return latest.closingEquity;
}

function buildSeries(account: AccountDoc, records: PerformanceRecordDoc[]): SeriesPoint[] {
  if (!records.length) return [];

  // Anchor the line at the opening balance of the first period, otherwise a
  // brand-new account renders as a single dot with nothing to compare against.
  // That opening balance is the position at the *start* of the first month, so
  // it is labelled with the month before it — otherwise the axis repeats a label.
  const first = records[0];
  const anchor = new Date(first.year, first.month - 2, 1);
  const points: SeriesPoint[] = [
    {
      label: periodLabel(anchor.getFullYear(), anchor.getMonth() + 1),
      periodKey: (anchor.getFullYear() * 100) + (anchor.getMonth() + 1),
      equity: first.openingBalance,
      capital: account.depositedCapital,
    },
  ];

  for (const record of records) {
    points.push({
      label: periodLabel(record.year, record.month),
      periodKey: record.periodKey,
      equity: record.closingEquity,
      capital: account.depositedCapital,
    });
  }

  // A distribution shows as its own step, so the drop reads as money paid out
  // rather than as a trading loss.
  const settledAt = account.lastSettlementAt;
  const settledEquity = account.equityAfterSettlement;
  if (settledAt && typeof settledEquity === 'number') {
    const last = records[records.length - 1];
    if (!last || last.createdAt <= settledAt) {
      points.push({
        label: `${periodLabel(settledAt.getFullYear(), settledAt.getMonth() + 1)} · settled`,
        periodKey: settledAt.getFullYear() * 100 + settledAt.getMonth() + 1,
        equity: settledEquity,
        capital: account.depositedCapital,
      });
    }
  }

  return points;
}

export function buildAccountView(
  account: AccountDoc,
  records: PerformanceRecordDoc[],
): AccountView {
  const owner = ownerOf(account);
  const equity = equityFromRecords(account, records);
  const position = derivePosition({
    depositedCapital: account.depositedCapital,
    highWaterMark: account.highWaterMark,
    equity,
  });
  const next = nextDistribution(account.joinedAt, account.tier);
  const latest = records.length ? records[records.length - 1] : null;
  const tier = TIERS[account.tier];

  return {
    id: account._id.toString(),
    reference: account.reference,
    investorName: owner.name,
    investorEmail: owner.email,
    tier: account.tier,
    tierLabel: tier.label,
    tierCycle: tier.cycle,
    depositedCapital: account.depositedCapital,
    highWaterMark: account.highWaterMark,
    joinedAt: account.joinedAt.toISOString(),
    joinedLabel: account.joinedAt.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    }),
    status: account.status,
    nextDistribution: next.toISOString(),
    nextDistributionLabel: next.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    position,
    series: buildSeries(account, records),
    latestReport: latest
      ? {
          period: periodLabel(latest.year, latest.month),
          openingBalance: latest.openingBalance,
          nfpResult: latest.nfpResult,
          realisedPnl: latest.realisedPnl,
          closingEquity: latest.closingEquity,
          brokerVerified: latest.brokerVerified,
        }
      : null,
    reportCount: records.length,
  };
}

export async function loadAccountView(accountId: string): Promise<AccountView | null> {
  const account = await Account.findById(accountId).populate<{ owner: PopulatedOwner }>(
    'owner',
    'name email',
  );
  if (!account) return null;

  const records = await PerformanceRecord.find({ account: account._id }).sort({ periodKey: 1 });
  return buildAccountView(account as unknown as AccountDoc, records);
}

export interface BookSummary {
  accounts: AccountView[];
  totals: {
    assetsUnderManagement: number;
    capitalDeployed: number;
    netPnl: number;
    returnOnCapital: number;
    feesAccrued: number;
    /** Largest single account as a share of AUM. */
    concentration: number;
    belowInvestedCapital: number;
    accountCount: number;
  };
  byTier: Array<{
    id: TierId;
    label: string;
    short: string;
    cycle: string;
    count: number;
    aum: number;
  }>;
  /** Firm-wide AUM and capital by month, for the console's AUM chart. */
  curve: Array<{ label: string; periodKey: number; aum: number; capital: number }>;
}

export async function loadBook(): Promise<BookSummary> {
  const accounts = await Account.find({}).populate<{ owner: PopulatedOwner }>('owner', 'name email');
  const allRecords = await PerformanceRecord.find({}).sort({ periodKey: 1 });

  const byAccount = new Map<string, PerformanceRecordDoc[]>();
  for (const record of allRecords) {
    const key = record.account.toString();
    const list = byAccount.get(key);
    if (list) list.push(record);
    else byAccount.set(key, [record]);
  }

  const views = accounts.map((account) =>
    buildAccountView(
      account as unknown as AccountDoc,
      byAccount.get(account._id.toString()) ?? [],
    ),
  );

  const assetsUnderManagement = views.reduce((sum, a) => sum + a.position.equity, 0);
  const capitalDeployed = views.reduce((sum, a) => sum + a.depositedCapital, 0);
  const feesAccrued = views.reduce((sum, a) => sum + a.position.fee, 0);
  const largest = views.reduce((max, a) => Math.max(max, a.position.equity), 0);
  const netPnl = assetsUnderManagement - capitalDeployed;

  const byTier = (Object.keys(TIERS) as TierId[]).map((id) => {
    const list = views.filter((a) => a.tier === id);
    return {
      id,
      label: TIERS[id].label,
      short: TIERS[id].short,
      cycle: TIERS[id].cycle,
      count: list.length,
      aum: list.reduce((sum, a) => sum + a.position.equity, 0),
    };
  });

  // Firm-wide monthly curve: for each period, sum each account's closing equity
  // (carrying its last known value forward) against capital deployed by then.
  const periodKeys = [...new Set(allRecords.map((r) => r.periodKey))].sort((a, b) => a - b);
  const curve = periodKeys.map((periodKey) => {
    let aum = 0;
    let capital = 0;
    for (const account of accounts) {
      const records = byAccount.get(account._id.toString()) ?? [];
      const upTo = records.filter((r) => r.periodKey <= periodKey);
      if (!upTo.length) continue;
      aum += upTo[upTo.length - 1].closingEquity;
      capital += account.depositedCapital;
    }
    const year = Math.floor(periodKey / 100);
    const month = periodKey % 100;
    return { label: periodLabel(year, month), periodKey, aum, capital };
  });

  return {
    accounts: views,
    totals: {
      assetsUnderManagement,
      capitalDeployed,
      netPnl,
      returnOnCapital: capitalDeployed > 0 ? netPnl / capitalDeployed : 0,
      feesAccrued,
      concentration: assetsUnderManagement > 0 ? largest / assetsUnderManagement : 0,
      belowInvestedCapital: views.filter((a) => !a.position.aboveHighWaterMark).length,
      accountCount: views.length,
    },
    byTier,
    curve,
  };
}
