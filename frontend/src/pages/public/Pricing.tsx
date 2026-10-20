import { Link } from 'react-router-dom';
import { C, EMAIL, POPULAR_TIER, TIER_LIST, type Tier } from '../../lib/constants';
import { money } from '../../lib/format';
import { Eyebrow } from '../../components/ui';

function openAccountMailto(tier: Tier): string {
  const body = `Hello Encrypt Capital,

I'd like to open a ${tier.label} account.

Full name:
Phone / WhatsApp:
Amount I plan to invest (USD):
Questions:

Thank you.`;
  return `mailto:${EMAIL}?subject=${encodeURIComponent(
    `Open an account — ${tier.label}`,
  )}&body=${encodeURIComponent(body)}`;
}

function TierCard({ tier, hot }: { tier: Tier; hot: boolean }) {
  const distribution =
    tier.cycleMo === 12
      ? 'Annual review & payout'
      : tier.cycleMo === 3
        ? 'Quarterly payout'
        : 'Monthly review & payout';

  const cta =
    tier.id === 'x100'
      ? 'Start with 100X'
      : tier.id === 'consortium'
        ? 'Join the Consortium'
        : 'Speak to us privately';

  return (
    <div className={`tier${hot ? ' hot' : ''}`}>
      {hot && <span className="badge">Most popular</span>}
      <div className="nm">{tier.label}</div>
      <div className="tg">{tier.tag}</div>
      <div className="mn">
        From {money(tier.min)}
        <small> minimum</small>
      </div>
      <div className="rows">
        <div className="row">
          <span>Cycle</span>
          <span>{tier.cycle}</span>
        </div>
        <div className="row">
          <span>Distributions</span>
          <span>{distribution}</span>
        </div>
        <div className="row">
          <span>Profit split</span>
          <span>You keep 66.7%</span>
        </div>
        <div className="row">
          <span>Capital access</span>
          <span>{tier.id === 'gold' ? 'On request' : 'At cycle end'}</span>
        </div>
        {tier.id === 'gold' && (
          <div className="row">
            <span>Entry option</span>
            <span>10% upfront ($5,000)</span>
          </div>
        )}
        {tier.id === 'consortium' && (
          <div className="row">
            <span>Entry option</span>
            <span>Half-slot at $2,500</span>
          </div>
        )}
      </div>
      <a className={`btn-tier${hot ? ' gold' : ''}`} href={openAccountMailto(tier)}>
        {cta}
      </a>
    </div>
  );
}

export default function Pricing() {
  return (
    <div className="wrap">
      <section className="sect" style={{ paddingTop: 44 }}>
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="big">One fee. Charged on profit only.</h1>
        <p className="sub" style={{ fontSize: 15 }}>
          You keep 66.7% of every dollar your account earns. We take 33.3% — and only when there’s
          profit to share. No management fee on capital. No entry fee. No exit fee. No monthly
          charge.
        </p>
      </section>

      <section className="sect-tight">
        <div className="tiers">
          {TIER_LIST.map((tier) => (
            <TierCard key={tier.id} tier={tier} hot={POPULAR_TIER === tier.id} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.textFaint, marginTop: 12 }}>
          Tier buttons open a pre-filled email to {EMAIL} — account opening is handled personally by
          our team.
        </div>
      </section>

      <section className="sect">
        <Eyebrow>Worked example</Eyebrow>
        <h2 className="head">How the split works.</h2>
        <p className="sub" style={{ marginBottom: 14 }}>
          Say your account starts a cycle with <b style={{ color: C.ink }}>$10,000</b> and finishes
          the cycle up <b style={{ color: C.ink }}>$2,000</b>.
        </p>
        <div className="worked" style={{ maxWidth: 560 }}>
          <div className="wrow">
            <span>Profit for the cycle</span>
            <b>$2,000</b>
          </div>
          <div className="wrow hl">
            <span>Your share (66.7%)</span>
            <b style={{ color: C.green }}>$1,334</b>
          </div>
          <div className="wrow">
            <span>Management fee (33.3%)</span>
            <b>$666</b>
          </div>
          <div className="wrow">
            <span>Your capital</span>
            <b>$10,000 — untouched</b>
          </div>
        </div>
        <p className="sub" style={{ marginTop: 12, fontSize: 12.5 }}>
          If the account finishes flat or down, the fee is $0. Losses reduce your capital; they are
          not carried as a debt.{' '}
          <i>This illustrates the fee mechanic — it is not a forecast of returns.</i>
        </p>
      </section>

      <section className="sect faq" style={{ maxWidth: 720 }}>
        <Eyebrow>Questions</Eyebrow>
        <h2 className="head" style={{ marginBottom: 16 }}>
          Pricing FAQ.
        </h2>
        <details>
          <summary>When do I pay the fee?</summary>
          <div className="a">
            You don’t pay it separately. It’s deducted from profit at the end of your cycle, before
            your distribution is released.
          </div>
        </details>
        <details>
          <summary>What happens if my account loses money?</summary>
          <div className="a">
            You pay no fee for that cycle. Your capital is reduced by the loss, and the next cycle
            trades from the new balance.
          </div>
        </details>
        <details>
          <summary>Can I move between tiers?</summary>
          <div className="a">
            Yes — at the end of your current cycle, subject to the minimum for the tier you’re moving
            into.
          </div>
        </details>
        <details>
          <summary>Can I add capital mid-cycle?</summary>
          <div className="a">
            Yes. Email us at {EMAIL} and we’ll deploy it into your existing sub-account.
          </div>
        </details>
        <details>
          <summary>Are there hidden charges?</summary>
          <div className="a">
            No. No setup fee, no platform fee, no withdrawal fee. Third-party costs like bank
            transfer or FX conversion charges are shown to you before you confirm.
          </div>
        </details>
        <div style={{ marginTop: 18 }}>
          <Link className="btn-nav" to="/about">
            Still deciding? Talk to us →
          </Link>
        </div>
      </section>
    </div>
  );
}
