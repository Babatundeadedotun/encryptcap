import type { TierId } from '../lib/constants';

export type UserRole = 'manager' | 'investor';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  accountId?: string;
  accountReference?: string;
}

export interface DerivedPosition {
  equity: number;
  profit: number;
  feeable: number;
  fee: number;
  investorShare: number;
  aboveHighWaterMark: boolean;
  returnOnCapital: number;
}

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

export interface BookSummary {
  accounts: AccountView[];
  totals: {
    assetsUnderManagement: number;
    capitalDeployed: number;
    netPnl: number;
    returnOnCapital: number;
    feesAccrued: number;
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
  curve: Array<{ label: string; periodKey: number; aum: number; capital: number }>;
}

export interface PerformanceRecord {
  _id: string;
  account: string;
  year: number;
  month: number;
  periodKey: number;
  openingBalance: number;
  nfpResult: number;
  realisedPnl: number;
  closingEquity: number;
  brokerVerified: boolean;
  notes?: string;
}

export type ArticleBlock =
  | { type: 'para'; text: string }
  | { type: 'lead'; heading: string; text: string }
  | { type: 'list'; items: string[] };

export interface ArticleAsset {
  id: string;
  kind: 'PDF' | 'PPTX';
  originalName: string;
  sizeBytes: number;
  downloads: number;
}

export interface Article {
  id: string;
  slug: string;
  category: string;
  title: string;
  dek: string;
  minutes: number;
  body: ArticleBlock[];
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
  assets: ArticleAsset[];
}

export type CapitalAction =
  | 'Withdraw all'
  | 'Withdraw profit only'
  | 'Compound'
  | 'Increase allocation';

export interface CapitalRequest {
  _id: string;
  account: string | { _id: string; reference: string; tier: TierId };
  requestedBy: string | { _id: string; name: string; email: string };
  action: CapitalAction;
  contactName: string;
  amount: number;
  equityAtRequest: number;
  settlesAt: string;
  status: 'pending' | 'settled' | 'cancelled';
  managerNote?: string;
  /** Written when the request is settled — what the distribution actually did. */
  settledAt?: string;
  equityBefore?: number;
  equityAfter?: number;
  payoutToInvestor?: number;
  feeToFirm?: number;
  settlementSummary?: string;
  createdAt: string;
}

/** What settling a request would do, before it is done. */
export interface SettlementPreview {
  payoutToInvestor: number;
  feeToFirm: number;
  crystallisedProfit: number;
  equityAfter: number;
  depositedCapitalAfter: number;
  highWaterMarkAfter: number;
  closesAccount: boolean;
  summary: string;
}

export interface SettlementPreviewResponse {
  preview: SettlementPreview | null;
  equityBefore: number;
  /** Set when the request cannot be settled as asked, with the reason. */
  blocked: string | null;
}

export interface RecoveryStatus {
  remaining: number;
  total: number;
  issuedAt: string | null;
}
