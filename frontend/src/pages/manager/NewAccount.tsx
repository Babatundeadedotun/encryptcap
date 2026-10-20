import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { C, TIER_LIST } from '../../lib/constants';
import { money, parseAmount } from '../../lib/format';
import { Eyebrow, ErrorNote, Field } from '../../components/ui';
import { useToast } from '../../components/Toast';

export default function NewAccount() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<string>('consortium');
  const [capital, setCapital] = useState('');
  const [joinedAt, setJoinedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ password: string; reference: string } | null>(null);

  const navigate = useNavigate();
  const toast = useToast();

  const amount = parseAmount(capital);
  const selectedTier = TIER_LIST.find((t) => t.id === tier);
  const belowMinimum = Boolean(selectedTier && amount > 0 && amount < selectedTier.min);
  const complete = Boolean(name.trim() && email.trim() && tier && amount > 0 && joinedAt);

  const onSubmit = async () => {
    if (!complete || busy) return;
    setError(null);
    setBusy(true);

    try {
      const { account, temporaryPassword } = await api.accounts.create({
        name: name.trim(),
        email: email.trim(),
        tier,
        depositedCapital: amount,
        joinedAt,
        notes: notes.trim() || undefined,
      });
      setIssued({ password: temporaryPassword, reference: account.reference });
      toast('Account created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that account.');
    } finally {
      setBusy(false);
    }
  };

  if (issued) {
    return (
      <div className="wrap" style={{ paddingTop: 22, maxWidth: 560 }}>
        <Eyebrow>Account created</Eyebrow>
        <h2 className="head">{issued.reference} is ready.</h2>
        <p className="sub" style={{ marginBottom: 18 }}>
          Send these credentials to {name.trim()} through a channel you trust. This password is shown
          once and is not recoverable — they’ll be asked to change it on first login.
        </p>

        <div className="panel">
          <div className="srow">
            <span>Email</span>
            <span>{email.trim().toLowerCase()}</span>
          </div>
          <div className="srow">
            <span>Temporary password</span>
            <span>{issued.password}</span>
          </div>
          <div className="srow">
            <span>Account reference</span>
            <span>{issued.reference}</span>
          </div>

          <div className="cta">
            <button
              className="btn-mail"
              style={{ background: C.ink, color: C.onDark }}
              onClick={() => {
                void navigator.clipboard?.writeText(issued.password);
                toast('Password copied.');
              }}
            >
              Copy password
            </button>
            <button className="btn-cancel" onClick={() => navigate('/app/manager')}>
              Back to console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 22, maxWidth: 560 }}>
      <Link
        to="/app/manager"
        style={{ fontSize: 12.5, fontWeight: 600, textDecoration: 'none', color: C.blueDeep }}
      >
        ← Back to console
      </Link>

      <div style={{ marginTop: 18 }}>
        <Eyebrow>New account</Eyebrow>
        <h2 className="head">Open an investor account.</h2>
        <p className="sub" style={{ marginBottom: 20 }}>
          This creates the investor’s login and their portfolio account together, and issues a
          one-off password for you to pass on.
        </p>
      </div>

      <div className="panel">
        {error && <ErrorNote>{error}</ErrorNote>}

        <Field id="na-name" label="Investor’s full name" required>
          <input
            id="na-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada Nwosu"
          />
        </Field>

        <Field
          id="na-email"
          label="Email address"
          required
          hint="This is the address they will log in with."
        >
          <input
            id="na-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ada@example.com"
          />
        </Field>

        <Field id="na-tier" label="Tier" required>
          <select id="na-tier" value={tier} onChange={(e) => setTier(e.target.value)}>
            {TIER_LIST.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} — from {money(t.min)} · {t.cycle} cycle
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="na-capital"
          label="Deposited capital (USD)"
          required
          hint={
            belowMinimum && selectedTier
              ? `Below the ${selectedTier.label} minimum of ${money(selectedTier.min)}. You can still proceed if this is a deliberate exception.`
              : 'Fees are only ever charged on profit above this figure.'
          }
        >
          <input
            id="na-capital"
            type="text"
            inputMode="numeric"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
            placeholder="e.g. 5,000"
          />
        </Field>

        <Field
          id="na-joined"
          label="Funded on"
          required
          hint="Drives the distribution schedule for this account."
        >
          <input
            id="na-joined"
            type="date"
            value={joinedAt}
            onChange={(e) => setJoinedAt(e.target.value)}
          />
        </Field>

        <Field id="na-notes" label="Internal note" hint="Only visible to managers.">
          <input
            id="na-notes"
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <button className="btn-block" onClick={onSubmit} disabled={!complete || busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </div>
    </div>
  );
}
