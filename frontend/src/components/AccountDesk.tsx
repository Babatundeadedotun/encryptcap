import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { AccountView, CapitalAction, PerformanceRecord } from '../api/types';
import { C, EMAIL } from '../lib/constants';
import { money, pct, signed } from '../lib/format';
import { AreaChart } from './charts/AreaChart';
import { Icon, type IconName } from './Icon';
import { Avatar, EmptyState, Eyebrow, Kpi, TierPill, Texture } from './ui';
import { CapitalActionSheet } from './CapitalActionSheet';

const ACTIONS: Array<{ kind: CapitalAction; icon: IconName; hint: string }> = [
  { kind: 'Withdraw all', icon: 'out', hint: 'Capital + profit, full exit' },
  { kind: 'Withdraw profit only', icon: 'coins', hint: 'Keep your principal working' },
  { kind: 'Compound', icon: 'loop', hint: 'Reinvest and grow faster' },
  { kind: 'Increase allocation', icon: 'trend', hint: 'Scale up when ready' },
];

function PositionRow({
  label,
  meaning,
  value,
  estimate,
}: {
  label: string;
  meaning: string;
  value: ReactNode;
  estimate?: boolean;
}) {
  return (
    <div className="prow">
      <div>
        <div className="pl">
          {label}
          {estimate && (
            <span
              className="mono"
              style={{ color: C.goldDim, fontSize: 11 }}
              title="Estimated. Final figure is confirmed at your distribution."
            >
              {' '}
              ~ estimate
            </span>
          )}
        </div>
        <div className="pm">{meaning}</div>
      </div>
      <div className="pv">{value}</div>
    </div>
  );
}

/**
 * The investor desk body. Shared by the investor's own view and the manager's
 * read-only "acting as" view — in the latter, capital actions are disabled
 * because only the investor may request them.
 */
export function AccountDesk({
  account,
  actingAs = false,
}: {
  account: AccountView;
  actingAs?: boolean;
}) {
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [sheet, setSheet] = useState<CapitalAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.accounts
      .records(account.id)
      .then(({ records: list }) => {
        if (!cancelled) setRecords(list);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const { position, latestReport } = account;
  const profitColor = position.profit >= 0 ? C.green : C.red;
  const latestRecord = records.length ? records[0] : null;

  return (
    <>
      {actingAs && (
        <div className="banner">
          <span>
            👁 <b>Acting as {account.investorName}</b> — read-only manager view. Capital actions are
            disabled; only the investor can request them.
          </span>
          <Link className="chip" to="/app/manager">
            ← Return to console
          </Link>
        </div>
      )}

      <div className="ihead">
        <Texture />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Avatar name={account.investorName} dark />
            <div>
              <div style={{ fontWeight: 700, fontSize: 22, color: C.onDark }}>
                {account.investorName}
              </div>
              <div style={{ fontSize: 12, color: C.onDarkMute }}>
                {account.tierLabel} · {account.tierCycle} cycle · joined {account.joinedLabel} ·{' '}
                {account.reference}
              </div>
            </div>
          </div>
          <TierPill tier={account.tier} dark />
        </div>

        <div style={{ textAlign: 'right' }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: 1,
              color: C.onDarkMute,
              textTransform: 'uppercase',
            }}
          >
            Current equity
          </div>
          <div style={{ fontWeight: 700, fontSize: 36, color: C.gold, lineHeight: 1.1 }}>
            {money(position.equity)}
          </div>
          <div
            className="mono"
            style={{ fontSize: 13, color: position.profit >= 0 ? '#7ED9A6' : '#F2998E' }}
          >
            {signed(position.profit)} · {position.returnOnCapital >= 0 ? '+' : ''}
            {pct(position.returnOnCapital)}
          </div>
        </div>
      </div>

      {/*
        When the account sits below its high-water mark, profit share and fee are
        both $0 by design. Say so explicitly — an unexplained pair of zeros next
        to a moving equity figure reads as a broken page.
      */}
      {!position.aboveHighWaterMark && (
        <div className="hwm-note" role="note">
          <b>No fee is being charged.</b> This account is{' '}
          {money(account.highWaterMark - position.equity)} below its high-water mark of{' '}
          {money(account.highWaterMark)}. Profit share and management fee stay at $0 until equity
          climbs back above that line — gains that only recover a past loss are never charged.
        </div>
      )}

      <div className="kpis">
        <Kpi label="Capital invested" value={money(account.depositedCapital)} sub="your principal" />
        <Kpi
          label="High-water mark"
          value={money(account.highWaterMark)}
          sub="fee applies only above this"
          accent={C.blueDeep}
        />
        <Kpi
          label="Your profit share"
          value={money(position.investorShare)}
          sub={
            position.aboveHighWaterMark
              ? '66.7% of profit above the mark'
              : 'nothing to share — below the mark'
          }
          accent={C.green}
        />
        <Kpi
          label="Management fee"
          value={money(position.fee)}
          sub={position.aboveHighWaterMark ? '33.3% — profit only' : 'no profit, no fee'}
          accent={C.goldDim}
        />
        <Kpi
          label="Next distribution"
          value={account.nextDistributionLabel}
          sub={`${account.tierCycle} review`}
        />
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Your performance — realized</h3>
          <div className="legend">
            <span>
              <i style={{ background: C.blueDeep }} />
              Equity
            </span>
            <span>
              <i style={{ background: C.textFaint }} />
              Capital
            </span>
            <span>
              <i style={{ background: C.gold }} />
              Deposit line
            </span>
          </div>
        </div>
        <AreaChart
          data={account.series}
          primary="equity"
          lines={[{ key: 'capital', color: C.textFaint }]}
          markLine={account.highWaterMark}
          title={`Equity for ${account.reference}`}
        />
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>At your next review you can</h3>
          <span className="tag">Requests are made by email</span>
        </div>
        <div className="actions">
          {ACTIONS.map(({ kind, icon, hint }) => (
            <button
              key={kind}
              className="action"
              disabled={actingAs}
              onClick={() => setSheet(kind)}
            >
              <span className="aicon">
                <Icon name={icon} size={15} />
              </span>
              <div className="t">{kind}</div>
              <div className="h">{hint}</div>
            </button>
          ))}
        </div>
        {!actingAs && (
          <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 10 }}>
            Each option opens a short request form, then a pre-filled email to {EMAIL}. Requests
            settle at your next review cycle.
          </div>
        )}
      </div>

      <div style={{ margin: '26px 0 12px' }}>
        <Eyebrow>Capital Performance</Eyebrow>
        <h2 className="head" style={{ fontSize: 22 }}>
          Your capital, verified.
        </h2>
        <p className="sub" style={{ fontSize: 13 }}>
          Realised, broker-verified figures — refreshed at every review. No projections here; the
          only forward-looking number is your <i>projected</i> share, and it’s labelled as an
          estimate.
        </p>
      </div>

      <div className="grid2">
        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-h">
            <h3>Monthly performance report</h3>
            {latestReport?.brokerVerified && (
              <span
                className="status"
                style={{ color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}44` }}
                title="These figures are drawn from broker records, not our own spreadsheet."
              >
                ✓ Broker-verified
              </span>
            )}
          </div>

          {latestReport ? (
            <>
              <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 4 }}>
                What your account did this period ({latestReport.period}), start to finish.
              </div>
              <PositionRow
                label="Opening balance"
                meaning="Your equity at the start of the period."
                value={money(latestReport.openingBalance)}
              />
              <PositionRow
                label="NFP trade executed"
                meaning="Result of the trade placed around the Non-Farm Payrolls release — the scheduled market event we trade."
                value={
                  <span style={{ color: latestReport.nfpResult >= 0 ? C.green : C.red }}>
                    {signed(latestReport.nfpResult)}
                  </span>
                }
              />
              <PositionRow
                label="Realised profit / loss"
                meaning="Booked result for the period — money actually made or lost, not on-paper."
                value={
                  <span style={{ color: latestReport.realisedPnl >= 0 ? C.green : C.red }}>
                    {signed(latestReport.realisedPnl)}
                  </span>
                }
              />
              <PositionRow
                label="Closing equity"
                meaning="Your equity at the end of the period."
                value={money(latestReport.closingEquity)}
              />
              {latestRecord && (
                <div style={{ marginTop: 14 }}>
                  <a
                    className="btn-nav"
                    href={api.accounts.monthlyReportUrl(account.id, latestRecord._id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                  >
                    <Icon name="doc" size={14} /> Download PDF
                  </a>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No report yet."
              body="Your first monthly performance report appears here once your first review period closes."
            />
          )}
        </div>

        <div className="panel" style={{ margin: 0 }}>
          <div className="panel-h">
            <h3>Capital position statement</h3>
          </div>
          <div style={{ fontSize: 12, color: C.textFaint, marginBottom: 4 }}>
            Where your capital stands right now.
          </div>
          <PositionRow
            label="Deposited capital"
            meaning="The capital you put in — your baseline. Fees only apply to profit above this."
            value={money(account.depositedCapital)}
          />
          <PositionRow
            label="Current equity"
            meaning="What your account is worth today."
            value={money(position.equity)}
          />
          <PositionRow
            label="Profit this cycle"
            meaning="Profit accrued since your cycle began."
            value={<span style={{ color: profitColor }}>{signed(position.profit)}</span>}
          />
          <PositionRow
            label="Your projected share"
            meaning="Your 66.7% of profit above your deposit — an estimate until the cycle settles."
            value={`~${money(position.investorShare)}`}
            estimate
          />
          <PositionRow
            label="Next distribution"
            meaning="The date your current cycle pays out."
            value={account.nextDistributionLabel}
          />
          <div style={{ marginTop: 14 }}>
            <a
              className="btn-nav ghost"
              href={api.accounts.positionStatementUrl(account.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <Icon name="doc" size={14} /> Download PDF
            </a>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-h">
          <h3>Past statements</h3>
        </div>
        {records.length ? (
          records.slice(0, 6).map((record) => (
            <div className="stmt" key={record._id}>
              <span style={{ color: C.ink, fontWeight: 600 }}>
                {new Date(record.year, record.month - 1, 1).toLocaleDateString('en-US', {
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                · Monthly performance
              </span>
              <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span className="mono" style={{ color: C.textMute }}>
                  {money(record.closingEquity)}
                </span>
                <span
                  className="mono"
                  style={{
                    color: record.realisedPnl >= 0 ? C.green : C.red,
                    minWidth: 70,
                    textAlign: 'right',
                  }}
                >
                  {signed(record.realisedPnl)}
                </span>
                <a
                  className="authlink"
                  href={api.accounts.monthlyReportUrl(account.id, record._id)}
                  style={{ fontSize: 12 }}
                >
                  PDF
                </a>
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            title="Nothing to show yet."
            body="Your first monthly performance report will appear here after your first review period closes. We’ll email you the moment it’s ready."
          />
        )}
      </div>

      <div className="note">
        Figures are realized and broker-verified in USD, hedging against naira depreciation. Trading
        the global markets carries substantial risk and past results do not guarantee future returns.
        Your capital can fall below the amount invested.
      </div>

      {sheet && !actingAs && (
        <CapitalActionSheet action={sheet} account={account} onClose={() => setSheet(null)} />
      )}
    </>
  );
}
