import { useState } from 'react';
import { Link } from 'react-router-dom';
import { C, EMAIL } from '../../lib/constants';
import { Eyebrow, Field } from '../../components/ui';
import { useToast } from '../../components/Toast';

const TIER_OPTIONS = [
  {
    value: '100X Portfolio (from $1,000 · 12-month cycle)',
    label: '100X Portfolio — from $1,000 · 12-month cycle',
  },
  {
    value: 'Consortium (from $2,500 · quarterly cycle)',
    label: 'Consortium — from $2,500 · quarterly cycle',
  },
  {
    value: 'Private / Gold (from $50,000 · monthly cycle)',
    label: 'Private / Gold — from $50,000 · monthly cycle',
  },
  { value: 'Not sure yet — please advise', label: 'Not sure yet — please advise' },
];

export default function OpenAccount() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tier, setTier] = useState('');
  const [amount, setAmount] = useState('');
  const toast = useToast();

  // Every field is required before the submit button becomes clickable.
  const complete = Boolean(name.trim() && phone.trim() && tier && amount.trim());

  const onSend = () => {
    if (!complete) return;

    const body = `Hello Encrypt Capital,

I'd like to open an account.

Full name: ${name.trim()}
Phone / WhatsApp: ${phone.trim()}
Preferred tier: ${tier}
Amount I plan to invest (USD): $${amount.trim()}

Please send me verification and funding instructions.

Thank you.`;

    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(
      `Open an account — ${name.trim()}`,
    )}&body=${encodeURIComponent(body)}`;

    toast('Email drafted — press send in your mail app to submit.');
  };

  return (
    <div className="wrap">
      <div className="auth" style={{ maxWidth: 560 }}>
        <Eyebrow>Open an account</Eyebrow>
        <h2 className="head">Start in three steps.</h2>
        <p className="sub" style={{ marginBottom: 20 }}>
          Account opening is handled personally by our team — tell us who you are and which tier
          fits, and we’ll reply within one business day with verification and funding instructions.
        </p>

        <div className="panel">
          <Field id="o-name" label="Full name" required>
            <input
              id="o-name"
              type="text"
              autoComplete="name"
              placeholder="e.g. Ada Nwosu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <Field id="o-phone" label="Phone / WhatsApp" required>
            <input
              id="o-phone"
              type="tel"
              autoComplete="tel"
              placeholder="+234 …"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>

          <Field id="o-tier" label="Preferred tier" required>
            <select id="o-tier" value={tier} onChange={(e) => setTier(e.target.value)} required>
              <option value="">Choose a tier…</option>
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="o-amt"
            label="Amount you plan to invest (USD)"
            required
            hint="A guide, not a commitment — you confirm the final amount at funding."
          >
            <input
              id="o-amt"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2,500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>

          <button
            className="btn-block"
            onClick={onSend}
            disabled={!complete}
            style={{ background: C.gold, color: C.ink }}
          >
            Send application by email
          </button>

          {!complete && (
            <div className="hint" style={{ marginTop: 8 }}>
              All fields marked <em style={{ color: C.red, fontStyle: 'normal' }}>*</em> are required
              before you can send.
            </div>
          )}

          <div className="mailhint">
            This opens your email app with everything pre-filled, addressed to{' '}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Nothing is sent until you press send.
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: C.textMute }}>
          Already have an account?{' '}
          <Link className="authlink" to="/login">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
