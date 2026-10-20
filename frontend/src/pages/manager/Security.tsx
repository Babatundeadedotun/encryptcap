import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import type { RecoveryStatus } from '../../api/types';
import { C } from '../../lib/constants';
import { ErrorNote, Eyebrow, Field, Spinner } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';

export default function Security() {
  const toast = useToast();

  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await api.auth.recoveryStatus());
    } catch {
      setStatus({ remaining: 0, total: 0, issuedAt: null });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { codes: fresh } = await api.auth.regenerateRecoveryCodes(password);
      setCodes(fresh);
      setConfirming(false);
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not issue new codes.');
    } finally {
      setBusy(false);
    }
  };

  const issued = status?.issuedAt
    ? new Date(status.issuedAt).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="wrap" style={{ paddingTop: 22 }}>
      <div style={{ marginBottom: 16 }}>
        <Eyebrow>Security</Eyebrow>
        <h2 className="head">Your way back in.</h2>
        <p className="sub">
          Recovery codes let you set a new password at <span className="mono">/admin</span> if you
          ever forget this one. Keep them somewhere that is not this site.
        </p>
      </div>

      {codes && (
        <div className="hwm-note" role="status">
          <b>Your {codes.length} recovery codes.</b> This is the only time they are shown — they
          are stored hashed and cannot be read back, only replaced. Any codes issued before now
          have stopped working.
          <div
            className="mono"
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 6,
              fontSize: 14,
              color: C.ink,
              letterSpacing: '0.04em',
            }}
          >
            {codes.map((code) => (
              <div key={code}>{code}</div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              className="chip"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(codes.join('\n'))
                  .then(() => toast('Copied. Paste them somewhere safe now.'))
                  .catch(() => toast('Select the codes and copy them manually.'));
              }}
            >
              Copy all
            </button>
            <button className="chip" onClick={() => window.print()}>
              Print
            </button>
            <button className="chip" onClick={() => setCodes(null)}>
              I have saved them
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 20 }}>
        {status === null ? (
          <Spinner label="Checking…" />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>Recovery codes</div>
                <div style={{ fontSize: 13.5, color: C.textMute, marginTop: 5 }}>
                  {status.total === 0 ? (
                    <>None issued yet. Generate a set before you need one.</>
                  ) : (
                    <>
                      <b style={{ color: status.remaining <= 2 ? C.goldDim : C.ink }}>
                        {status.remaining} of {status.total}
                      </b>{' '}
                      unused{issued ? ` · issued ${issued}` : ''}
                    </>
                  )}
                </div>
              </div>
              <button className="chip" onClick={() => setConfirming(true)}>
                {status.total === 0 ? 'Generate codes' : 'Issue a new set'}
              </button>
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${C.lineSoft}`,
                fontSize: 13,
                color: C.textMute,
                lineHeight: 1.65,
              }}
            >
              <div style={{ fontWeight: 600, color: C.ink, marginBottom: 6 }}>How they work</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Ten codes per set. Each one works exactly once.</li>
                <li>
                  You can issue a new set whenever you like — there is no need to use the old ones
                  up first.
                </li>
                <li>
                  A new set <b>replaces</b> the old one. Every previous code stops working the
                  moment you generate.
                </li>
                <li>Generating asks for your password, so a borrowed session cannot mint them.</li>
                <li>Using a code sets a new password and signs out every device.</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {confirming && (
        <Modal
          open
          onClose={() => {
            setConfirming(false);
            setPassword('');
            setError(null);
          }}
          labelledBy="gen-codes-title"
        >
          <h3 id="gen-codes-title">Issue a new set of codes?</h3>
          <p className="sub2">
            {status?.total
              ? 'Your current codes will stop working immediately, used or not.'
              : 'Ten codes will be shown once. Save them before closing the page.'}
          </p>
          <form onSubmit={onGenerate}>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Field id="g-pass" label="Confirm your password">
              <input
                id="g-pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <div className="cta">
              <button
                className="btn-mail"
                type="submit"
                disabled={busy || !password}
                style={{ background: C.ink, color: C.onDark }}
              >
                {busy ? 'Issuing…' : 'Issue codes'}
              </button>
              <button
                className="btn-cancel"
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setPassword('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
