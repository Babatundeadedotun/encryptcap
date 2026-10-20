import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { AccountView, BookSummary } from '../../api/types';
import { C, TIERS, type TierId } from '../../lib/constants';
import { money, moneyK, pct, signed } from '../../lib/format';
import { AreaChart } from '../../components/charts/AreaChart';
import { BarChart } from '../../components/charts/BarChart';
import { Eyebrow, Kpi, Spinner, StatusPill, TierPill } from '../../components/ui';
import { ChangePasswordPrompt } from '../app/ChangePasswordPrompt';

type SortKey = 'investorName' | 'tier' | 'depositedCapital' | 'equity' | 'profit' | 'fee';

const COLUMNS: Array<{ key: SortKey; label: string; num?: boolean }> = [
  { key: 'investorName', label: 'Investor' },
  { key: 'tier', label: 'Tier' },
  { key: 'depositedCapital', label: 'Capital', num: true },
  { key: 'equity', label: 'Equity', num: true },
  { key: 'profit', label: 'P&L', num: true },
  { key: 'fee', label: 'Fee accrued', num: true },
];

function sortValue(account: AccountView, key: SortKey): string | number {
  switch (key) {
    case 'investorName':
      return account.investorName;
    case 'tier':
      return account.tier;
    case 'depositedCapital':
      return account.depositedCapital;
    case 'equity':
      return account.position.equity;
    case 'profit':
      return account.position.profit;
    case 'fee':
      return account.position.fee;
  }
}

export default function ManagerConsole() {
  const [book, setBook] = useState<BookSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierId | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('equity');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  // Desk-planning projection. Never shown to an investor.
  const [monthlyReturn, setMonthlyReturn] = useState(0.02);
  const [inflow, setInflow] = useState(5000);

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.accounts
      .book()
      .then((data) => {
        if (!cancelled) setBook(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the book.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!book) return [];
    const filtered =
      tierFilter === 'all' ? book.accounts : book.accounts.filter((a) => a.tier === tierFilter);

    // sortDir -1 is descending, matching the ↓ shown in the header.
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });
  }, [book, tierFilter, sortKey, sortDir]);

  const projection = useMemo(() => {
    if (!book) return [];
    const out: Array<{ label: string; aum: number }> = [];
    let v = book.totals.assetsUnderManagement;
    for (let m = 0; m <= 12; m += 1) {
      out.push({ label: `M${m}`, aum: Math.round(v) });
      v = v * (1 + monthlyReturn) + inflow;
    }
    return out;
  }, [book, monthlyReturn, inflow]);

  if (error) {
    return (
      <div className="wrap" style={{ paddingTop: 22 }}>
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
            We can’t load the book right now.
          </div>
          <div style={{ fontSize: 13.5, color: C.textMute }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!book) return <Spinner label="Loading the book…" />;

  const { totals } = book;

  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  return (
    <div className="wrap" style={{ paddingTop: 22 }}>
      <ChangePasswordPrompt />

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Eyebrow>Manager Console</Eyebrow>
          <h2 className="head">The book at a glance.</h2>
          <p className="sub">
            One master account, {totals.accountCount} MAM sub-accounts. Every figure here is
            realized — projections are flagged.
          </p>
        </div>
        <Link className="btn-nav" to="/app/manager/accounts/new">
          + New account
        </Link>
      </div>

      <div className="kpis">
        <Kpi
          label="Assets under management"
          value={money(totals.assetsUnderManagement)}
          sub={`${totals.accountCount} funded accounts`}
        />
        <Kpi
          label="Capital deployed"
          value={money(totals.capitalDeployed)}
          sub="investor principal"
          accent={C.textMute}
        />
        <Kpi
          label="Net P&L"
          value={signed(totals.netPnl)}
          sub={totals.capitalDeployed ? `${pct(totals.returnOnCapital)} on capital` : '—'}
          accent={totals.netPnl >= 0 ? C.green : C.red}
        />
        <Kpi
          label="Performance fees accrued"
          value={money(totals.feesAccrued)}
          sub="33.3% of profit above each deposit"
          accent={C.goldDim}
        />
        <Kpi
          label="Concentration"
          value={pct(totals.concentration)}
          sub="largest single account"
          accent={totals.concentration > 0.4 ? C.red : C.ink}
          warn={totals.concentration > 0.4}
        />
        <Kpi
          label="Below invested capital"
          value={String(totals.belowInvestedCapital)}
          sub="accounts in net loss — no fee"
          accent={totals.belowInvestedCapital ? C.red : C.green}
          warn={totals.belowInvestedCapital > 0}
        />
      </div>

      <div className="split">
        <div className="panel">
          <div className="panel-h">
            <h3>AUM — realized</h3>
            <div className="legend">
              <span>
                <i style={{ background: C.gold }} />
                AUM
              </span>
              <span>
                <i style={{ background: C.textFaint }} />
                Capital
              </span>
            </div>
          </div>
          <AreaChart
            data={book.curve}
            primary="aum"
            lines={[{ key: 'capital', color: C.textFaint }]}
            area={C.gold}
            stroke={C.goldDim}
            title="Assets under management over time"
          />
        </div>

        <div className="panel">
          <div className="panel-h">
            <h3>By portfolio tier</h3>
          </div>
          <BarChart
            bars={book.byTier.map((t) => ({
              label: t.short,
              value: t.aum,
              color: TIERS[t.id].accent,
            }))}
          />
          <div style={{ marginTop: 8 }}>
            {book.byTier.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  padding: '4px 0',
                  borderTop: `1px solid ${C.lineSoft}`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.textMute }}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: 2, background: TIERS[t.id].accent }}
                  />
                  {t.label} · {t.cycle}
                </span>
                <span className="mono" style={{ color: C.ink }}>
                  {t.count} · {moneyK(t.aum)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(totals.concentration > 0.4 || totals.belowInvestedCapital > 0) && (
        <div className="guards">
          {totals.concentration > 0.4 && (
            <div
              className="guard"
              style={{ borderLeft: `3px solid ${C.red}`, borderRadius: '0 10px 10px 0' }}
            >
              <div className="t">Concentration risk</div>
              <div className="b">
                One account is {pct(totals.concentration)} of AUM. A single redemption would dent the
                book — widen the base before scaling.
              </div>
            </div>
          )}
          {totals.belowInvestedCapital > 0 && (
            <div
              className="guard"
              style={{ borderLeft: `3px solid ${C.gold}`, borderRadius: '0 10px 10px 0' }}
            >
              <div className="t">
                {totals.belowInvestedCapital} account(s) below their invested capital
              </div>
              <div className="b">
                These are in net loss — no fee applies until they recover above their original
                deposit. Worth a proactive conversation before the next review.
              </div>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-h">
          <h3>All accounts ({rows.length})</h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all', 'x100', 'consortium', 'gold'] as const).map((key) => (
              <button
                key={key}
                className={`chip${tierFilter === key ? ' on' : ''}`}
                onClick={() => setTierFilter(key)}
              >
                {key === 'all' ? 'All' : TIERS[key].short}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>
          Open any row for that investor’s account and to post a monthly report.
        </div>

        <div className="tbl-scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${col.num ? 'num' : ''} ${sortKey === col.key ? 'on' : ''}`}
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === -1 ? ' ↓' : ' ↑') : ''}
                  </th>
                ))}
                <th className="num">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((account) => (
                <tr key={account.id} onClick={() => navigate(`/app/manager/accounts/${account.id}`)}>
                  <td>
                    <span style={{ fontWeight: 600, color: C.ink }}>{account.investorName}</span>
                    <span className="mono" style={{ color: C.textFaint, fontSize: 11 }}>
                      {' '}
                      {account.reference}
                    </span>
                  </td>
                  <td>
                    <TierPill tier={account.tier} />
                  </td>
                  <td className="num">{money(account.depositedCapital)}</td>
                  <td className="num" style={{ color: C.ink, fontWeight: 600 }}>
                    {money(account.position.equity)}
                  </td>
                  <td
                    className="num"
                    style={{ color: account.position.profit >= 0 ? C.green : C.red }}
                  >
                    {signed(account.position.profit)}
                  </td>
                  <td
                    className="num"
                    style={{ color: account.position.fee > 0 ? C.goldDim : C.textFaint }}
                  >
                    {money(account.position.fee)}
                  </td>
                  <td className="num">
                    <StatusPill inProfit={account.position.aboveHighWaterMark} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Capital projection</h3>
          <span className="tag">Planning only · not shown to investors</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMute, marginBottom: 6 }}>
          Hypothetical, for desk planning. These assumptions never appear in an investor’s portal.
        </div>

        <AreaChart data={projection} primary="aum" title="Projected assets under management" />

        <div className="sliders">
          <div>
            <div className="slabel">
              <span>Assumed monthly return</span>
              <b>{pct(monthlyReturn)}</b>
            </div>
            <input
              type="range"
              min={0}
              max={0.06}
              step={0.0025}
              value={monthlyReturn}
              onChange={(e) => setMonthlyReturn(Number(e.target.value))}
              aria-label="Assumed monthly return"
            />
          </div>
          <div>
            <div className="slabel">
              <span>New capital / month</span>
              <b>{money(inflow)}</b>
            </div>
            <input
              type="range"
              min={0}
              max={30000}
              step={1000}
              value={inflow}
              onChange={(e) => setInflow(Number(e.target.value))}
              aria-label="New capital per month"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
