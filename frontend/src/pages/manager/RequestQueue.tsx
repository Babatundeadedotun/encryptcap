import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { CapitalRequest, SettlementPreviewResponse } from '../../api/types';
import { C } from '../../lib/constants';
import { money } from '../../lib/format';
import { EmptyState, Eyebrow, Spinner } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

const FILTERS = ['pending', 'settled', 'cancelled', 'all'] as const;

const STATUS_COLOR: Record<string, string> = {
  pending: C.goldDim,
  settled: C.green,
  cancelled: C.textFaint,
};

export default function RequestQueue() {
  const [requests, setRequests] = useState<CapitalRequest[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('pending');
  const toast = useToast();

  const load = useCallback(async () => {
    setRequests(null);
    try {
      const { requests: list } = await api.capitalRequests.queue(filter);
      setRequests(list);
    } catch {
      setRequests([]);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Settling moves real money and ratchets the high-water mark, so it goes
  // through a confirmation showing exactly what will change.
  const [settling, setSettling] = useState<CapitalRequest | null>(null);
  const [preview, setPreview] = useState<SettlementPreviewResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const setStatus = async (id: string, status: string) => {
    try {
      await api.capitalRequests.update(id, { status });
      toast(`Marked ${status}.`);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update that request.');
    }
  };

  const openSettle = async (request: CapitalRequest) => {
    setSettling(request);
    setPreview(null);
    try {
      setPreview(await api.capitalRequests.preview(request._id));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not work out that settlement.');
      setSettling(null);
    }
  };

  const confirmSettle = async () => {
    if (!settling) return;
    setBusy(true);
    try {
      await api.capitalRequests.update(settling._id, { status: 'settled' });
      toast('Settled. The account has been updated.');
      setSettling(null);
      setPreview(null);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not settle that request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wrap" style={{ paddingTop: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>Capital requests</Eyebrow>
        <h2 className="head">What investors have asked for.</h2>
        <p className="sub">
          Logged when an investor composes a request from their desk. Settle them at the account’s
          next review, then mark them off here.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${filter === f ? ' on' : ''}`}
            onClick={() => setFilter(f)}
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      {requests === null ? (
        <Spinner label="Loading requests…" />
      ) : requests.length === 0 ? (
        <div className="panel">
          <EmptyState
            title="Nothing here."
            body={
              filter === 'pending'
                ? 'No open requests. They appear the moment an investor submits one from their desk.'
                : `No ${filter} requests.`
            }
          />
        </div>
      ) : (
        <div className="panel">
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Investor</th>
                  <th>Action</th>
                  <th className="num">Amount</th>
                  <th className="num">Equity then</th>
                  <th>Settles</th>
                  <th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const account = typeof request.account === 'string' ? null : request.account;
                  const status = request.status;

                  return (
                    <tr key={request._id} style={{ cursor: 'default' }}>
                      <td className="mono" style={{ fontSize: 11.5, color: C.textMute }}>
                        {new Date(request.createdAt).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: C.ink }}>{request.contactName}</span>
                        {account && (
                          <span className="mono" style={{ color: C.textFaint, fontSize: 11 }}>
                            {' '}
                            {account.reference}
                          </span>
                        )}
                      </td>
                      <td>{request.action}</td>
                      <td className="num">{money(request.amount)}</td>
                      <td className="num">{money(request.equityAtRequest)}</td>
                      <td>
                        {new Date(request.settlesAt).toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="num">
                        {status === 'pending' ? (
                          <span style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="authlink"
                              style={{ color: C.green }}
                              onClick={() => void openSettle(request)}
                            >
                              Settle
                            </button>
                            <button
                              className="authlink"
                              style={{ color: C.textFaint }}
                              onClick={() => setStatus(request._id, 'cancelled')}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span
                            className="status"
                            style={{
                              color: STATUS_COLOR[status],
                              background: `${STATUS_COLOR[status]}14`,
                              border: `1px solid ${STATUS_COLOR[status]}44`,
                            }}
                          >
                            {status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {settling && (
        <Modal
          open
          onClose={() => {
            setSettling(null);
            setPreview(null);
          }}
          labelledBy="settle-title"
        >
          <h3 id="settle-title">Settle · {settling.action}</h3>
          <p className="sub2">
            {settling.contactName} — this pays out, charges the performance fee, and moves the
            high-water mark. It cannot be undone from here.
          </p>

          {!preview ? (
            <Spinner label="Working out the settlement…" />
          ) : preview.blocked ? (
            <div className="err" role="alert" style={{ display: 'block' }}>
              {preview.blocked}
            </div>
          ) : (
            preview.preview && (
              <>
                <div className="worked" style={{ marginTop: 4 }}>
                  <SettleRow label="Equity now" value={money(preview.equityBefore)} />
                  <SettleRow
                    label="Profit being crystallised"
                    value={money(preview.preview.crystallisedProfit)}
                  />
                  <SettleRow
                    label="Paid to investor"
                    value={money(preview.preview.payoutToInvestor)}
                    accent={C.green}
                  />
                  <SettleRow
                    label="Performance fee (33.3%)"
                    value={money(preview.preview.feeToFirm)}
                    accent={C.goldDim}
                  />
                  <SettleRow label="Equity after" value={money(preview.preview.equityAfter)} strong />
                  <SettleRow
                    label="Capital after"
                    value={money(preview.preview.depositedCapitalAfter)}
                  />
                  <SettleRow
                    label="High-water mark after"
                    value={money(preview.preview.highWaterMarkAfter)}
                    strong
                  />
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  {preview.preview.summary}
                </p>
                {preview.preview.closesAccount && (
                  <div className="err" role="alert" style={{ display: 'block', marginTop: 10 }}>
                    This closes the account. Nothing further can be settled against it.
                  </div>
                )}
              </>
            )
          )}

          <div className="cta">
            <button
              className="btn-mail"
              onClick={confirmSettle}
              disabled={busy || !preview || !!preview.blocked}
              style={{ background: C.ink, color: C.onDark }}
            >
              {busy ? 'Settling…' : 'Confirm settlement'}
            </button>
            <button
              className="btn-cancel"
              onClick={() => {
                setSettling(null);
                setPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SettleRow({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div className="wrow">
      <span style={{ color: C.textMute }}>{label}</span>
      <span
        className="mono"
        style={{ color: accent ?? C.ink, fontWeight: strong ? 700 : 500 }}
      >
        {value}
      </span>
    </div>
  );
}
