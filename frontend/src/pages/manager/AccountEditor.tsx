import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import type { AccountView, PerformanceRecord } from '../../api/types';
import { C } from '../../lib/constants';
import { money, parseAmount, signed } from '../../lib/format';
import { AccountDesk } from '../../components/AccountDesk';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { EmptyState, ErrorNote, Eyebrow, Field, Spinner } from '../../components/ui';
import { useToast } from '../../components/Toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Form for posting one month of broker-verified figures. */
function PostReport({
  account,
  onPosted,
}: {
  account: AccountView;
  onPosted: (next: AccountView) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [opening, setOpening] = useState(() => String(Math.round(account.position.equity)));
  const [nfp, setNfp] = useState('');
  const [closing, setClosing] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const openingValue = parseAmount(opening);
  const closingValue = parseAmount(closing);
  const nfpValue = parseAmount(nfp);

  // Realised P&L is derived, not typed, so it can never disagree with the
  // opening and closing figures the investor sees.
  const realised =
    Number.isFinite(openingValue) && Number.isFinite(closingValue)
      ? closingValue - openingValue
      : 0;

  const mismatch = Boolean(nfp.trim()) && Math.abs(nfpValue - realised) > 0.5;
  const complete = Boolean(opening.trim() && closing.trim());

  const onSubmit = async () => {
    if (!complete || busy) return;
    setError(null);
    setBusy(true);

    try {
      const { account: updated } = await api.accounts.addRecord(account.id, {
        year,
        month,
        openingBalance: openingValue,
        nfpResult: nfp.trim() ? nfpValue : realised,
        realisedPnl: realised,
        closingEquity: closingValue,
        brokerVerified: true,
      });
      onPosted(updated);
      setNfp('');
      setClosing('');
      setOpening(String(Math.round(updated.position.equity)));
      toast('Monthly report posted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post that report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-h">
        <h3>Post a monthly report</h3>
        <span className="tag">Broker-verified figures only</span>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid2">
        <Field id="pr-month" label="Period" required>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              id="pr-month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{ flex: 2 }}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <input
              aria-label="Year"
              type="number"
              value={year}
              min={2000}
              max={2999}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ flex: 1 }}
            />
          </div>
        </Field>

        <Field
          id="pr-opening"
          label="Opening balance (USD)"
          required
          hint="Equity at the start of the period."
        >
          <input
            id="pr-opening"
            type="text"
            inputMode="numeric"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
          />
        </Field>

        <Field
          id="pr-closing"
          label="Closing equity (USD)"
          required
          hint="Equity at the end of the period. This becomes the investor's current equity."
        >
          <input
            id="pr-closing"
            type="text"
            inputMode="numeric"
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
          />
        </Field>

        <Field
          id="pr-nfp"
          label="NFP trade result (USD)"
          hint={
            mismatch
              ? 'This differs from the realised figure below — fine if other trades ran, worth a check if not.'
              : 'Leave blank if the NFP trade was the only activity.'
          }
        >
          <input
            id="pr-nfp"
            type="text"
            inputMode="numeric"
            value={nfp}
            onChange={(e) => setNfp(e.target.value)}
            placeholder="Optional"
          />
        </Field>
      </div>

      <div
        className="srow"
        style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: 6, paddingTop: 12 }}
      >
        <span>Realised profit / loss for the period</span>
        <span style={{ color: realised >= 0 ? C.green : C.red }}>{signed(realised)}</span>
      </div>

      <button
        className="btn-block"
        onClick={onSubmit}
        disabled={!complete || busy}
        style={{ marginTop: 14 }}
      >
        {busy ? 'Posting…' : 'Post report'}
      </button>
    </div>
  );
}

/** Issues a fresh one-off password when an investor has lost theirs. */
function ResetPassword({ account }: { account: AccountView }) {
  const [confirming, setConfirming] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const onReset = async () => {
    setBusy(true);
    try {
      const { temporaryPassword } = await api.accounts.resetPassword(account.id);
      setIssued(temporaryPassword);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reset that password.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setConfirming(false);
    setIssued(null);
  };

  return (
    <>
      <button
        className="btn-nav ghost"
        onClick={() => setConfirming(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
      >
        <Icon name="key" size={14} /> Reset password
      </button>

      {confirming && (
        <Modal open onClose={close} labelledBy="reset-password-title">
          <h3 id="reset-password-title">
            {issued ? 'New password issued' : `Reset ${account.investorName}’s password?`}
          </h3>

          {issued ? (
            <>
              <p className="sub2">
                Read this out to them through a channel you trust. It is shown once, and they’ll be
                asked to change it as soon as they log in.
              </p>
              <div className="srow">
                <span>Email</span>
                <span>{account.investorEmail}</span>
              </div>
              <div className="srow">
                <span>Temporary password</span>
                <span>{issued}</span>
              </div>
              <div className="cta">
                <button
                  className="btn-mail"
                  style={{ background: C.ink, color: C.onDark }}
                  onClick={() => {
                    void navigator.clipboard?.writeText(issued);
                    toast('Password copied.');
                  }}
                >
                  Copy password
                </button>
                <button className="btn-cancel" onClick={close}>
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="sub2">
                Their current password stops working immediately. Only do this when you have
                confirmed who you are speaking to.
              </p>
              <div className="cta">
                <button
                  className="btn-mail"
                  onClick={onReset}
                  disabled={busy}
                  style={{ background: C.red, color: '#fff' }}
                >
                  {busy ? 'Resetting…' : 'Reset it'}
                </button>
                <button className="btn-cancel" onClick={close}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

export default function AccountEditor() {
  const { id = '' } = useParams();
  const [account, setAccount] = useState<AccountView | null>(null);
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const loadRecords = useCallback(async () => {
    try {
      const { records: list } = await api.accounts.records(id);
      setRecords(list);
    } catch {
      setRecords([]);
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    api.accounts
      .get(id)
      .then(({ account: found }) => {
        if (!cancelled) setAccount(found);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load that account.');
        }
      });
    void loadRecords();
    return () => {
      cancelled = true;
    };
  }, [id, loadRecords]);

  const onDelete = async (recordId: string) => {
    try {
      const { account: updated } = await api.accounts.deleteRecord(id, recordId);
      setAccount(updated);
      await loadRecords();
      toast('Report removed.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not remove that report.');
    }
  };

  const sorted = useMemo(() => [...records].sort((a, b) => b.periodKey - a.periodKey), [records]);

  if (error) {
    return (
      <div className="wrap" style={{ paddingTop: 22, maxWidth: 900 }}>
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>
            We can’t load that account.
          </div>
          <div style={{ fontSize: 13.5, color: C.textMute }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!account) return <Spinner label="Loading account…" />;

  return (
    <div className="wrap" style={{ paddingTop: 22, maxWidth: 900 }}>
      <Link
        to="/app/manager"
        style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', color: C.blueDeep }}
      >
        ← Back to console
      </Link>

      <div
        style={{
          margin: '18px 0 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Eyebrow>Manage account</Eyebrow>
          <h2 className="head">
            {account.investorName} · {account.reference}
          </h2>
          <p className="sub">
            Post this account’s monthly figures here. Everything the investor sees is computed from
            these records.
          </p>
        </div>
        <ResetPassword account={account} />
      </div>

      <PostReport
        account={account}
        onPosted={(updated) => {
          setAccount(updated);
          void loadRecords();
        }}
      />

      <div className="panel">
        <div className="panel-h">
          <h3>Posted reports ({sorted.length})</h3>
        </div>
        {sorted.length ? (
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Period</th>
                  <th className="num">Opening</th>
                  <th className="num">NFP</th>
                  <th className="num">Realised</th>
                  <th className="num">Closing</th>
                  <th className="num" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((record) => (
                  <tr key={record._id} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 600, color: C.ink }}>
                      {new Date(record.year, record.month - 1, 1).toLocaleDateString('en-US', {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="num">{money(record.openingBalance)}</td>
                    <td className="num" style={{ color: record.nfpResult >= 0 ? C.green : C.red }}>
                      {signed(record.nfpResult)}
                    </td>
                    <td className="num" style={{ color: record.realisedPnl >= 0 ? C.green : C.red }}>
                      {signed(record.realisedPnl)}
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>
                      {money(record.closingEquity)}
                    </td>
                    <td className="num">
                      <button
                        className="authlink"
                        style={{ color: C.red, display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => onDelete(record._id)}
                        aria-label={`Remove the ${record.month}/${record.year} report`}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No reports posted yet."
            body="Post the first month above and this account's charts and statements come to life."
          />
        )}
      </div>

      <div style={{ margin: '26px 0 12px' }}>
        <Eyebrow>What the investor sees</Eyebrow>
        <h2 className="head" style={{ fontSize: 22 }}>
          Their view, exactly.
        </h2>
      </div>

      <AccountDesk account={account} actingAs />
    </div>
  );
}
