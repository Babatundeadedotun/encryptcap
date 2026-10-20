import { Link } from 'react-router-dom';
import { C } from '../../lib/constants';
import { Icon, type IconName } from '../../components/Icon';
import { Eyebrow, Texture, Tick } from '../../components/ui';

function WhatWeDo({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <div className="card deep">
      <span className="cicon">
        <Icon name={icon} />
      </span>
      <div className="t">{title}</div>
      <div className="b">{body}</div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="wrap">
      <section className="hero">
        <Texture />
        <Eyebrow color={C.gold}>For Nigerian investors</Eyebrow>
        <h1>
          Your naira is losing value. <em>Your dollars don’t have to.</em>
        </h1>
        <p>
          Encrypt Capital puts your capital to work in the world’s largest and most liquid market —
          where $7.5 trillion changes hands every day — and holds your profits in USD.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link className="btn-gold" to="/open">
            Open an account
          </Link>
          <Link className="btn-ghost" to="/pricing">
            See the tiers
          </Link>
        </div>
        <div className="hero-facts">
          <span>
            Minimum entry <b>$1,000</b>
          </span>
          <span>
            Profits held in <b>USD</b>
          </span>
          <span>
            You keep <b>66.7%</b> of profits
          </span>
          <span>
            Monthly <b>reports</b>
          </span>
        </div>
      </section>

      <section className="sect">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="head">Saving in naira is a losing strategy.</h2>
        <p className="sub" style={{ marginBottom: 18 }}>
          Inflation erodes your money faster than your bank rebuilds it. A 15% return in a 25%
          inflation year is not a profit — it’s a slower loss.
        </p>
        <div className="stats">
          <div className="stat">
            <div className="n">~70%</div>
            <div className="d">Naira devaluation over the last 5 years</div>
          </div>
          <div className="stat">
            <div className="n">23–33%</div>
            <div className="d">Nigeria’s annual inflation range in recent years</div>
          </div>
          <div className="stat">
            <div className="n">8–22%</div>
            <div className="d">What a typical naira savings product returns</div>
          </div>
        </div>
      </section>

      <section className="sect">
        <Eyebrow>What we do</Eyebrow>
        <h2 className="head">One strategy, executed by software.</h2>
        <div className="grid4" style={{ marginTop: 16 }}>
          <WhatWeDo
            icon="target"
            title="We trade one thing, and we trade it well"
            body="Capital is deployed around scheduled high-impact economic news releases — the most predictable, highest-movement events in the global markets."
          />
          <WhatWeDo
            icon="zap"
            title="Software executes, not nerves"
            body="Our automated system fires in milliseconds with pre-defined entry, stop-loss and exit rules. No hesitation, panic or greed."
          />
          <WhatWeDo
            icon="dollar"
            title="Your profits are earned in USD"
            body="Every dollar you earn is a direct hedge against naira depreciation. Currency weakness stops being a threat and starts being the point."
          />
          <WhatWeDo
            icon="eye"
            title="You see everything, every cycle"
            body="Monthly performance reports and capital position statements at every review. No black box, no “trust us.”"
          />
        </div>
      </section>

      <section className="sect">
        <Eyebrow>Get started</Eyebrow>
        <h2 className="head">Two doors. Pick yours.</h2>
        <div className="grid2" style={{ marginTop: 16 }}>
          <Link className="door" to="/open">
            <div className="e" style={{ color: C.blueDeep }}>
              New to Encrypt
            </div>
            <div className="t">Open an account</div>
            <div className="b">
              Choose a tier from $1,000, complete verification, and fund your dedicated sub-account.
              Takes about five minutes to start.
            </div>
            <div className="c">Start now →</div>
          </Link>
          <Link className="door" to="/login">
            <div className="e" style={{ color: C.goldDim }}>
              Already invested
            </div>
            <div className="t">Log in to your account</div>
            <div className="b">
              Your equity, lifetime P&amp;L, deposit line, next distribution date and statements —
              realized, broker-verified figures only.
            </div>
            <div className="c">Log in →</div>
          </Link>
        </div>
      </section>

      <section className="sect">
        <Eyebrow>Fees</Eyebrow>
        <h2 className="head">We only earn when you earn.</h2>
        <div className="split" style={{ marginTop: 16 }}>
          <div className="panel" style={{ margin: 0 }}>
            <p className="sub" style={{ marginBottom: 12 }}>
              <b style={{ color: C.ink }}>You keep 66.7% of all profits.</b> The 33.3% management fee
              is charged on profit only — never on your capital. If your account doesn’t profit in a
              cycle, we don’t get paid.
            </p>
            <Tick>No fee on your deposited capital — ever</Tick>
            <Tick>No profit in a cycle, no management fee</Tick>
            <Tick>Same split across all three tiers</Tick>
            <Tick>Capital position statement at every review</Tick>
          </div>
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-h">
              <h3>Real risk, real controls</h3>
            </div>
            <p className="sub" style={{ fontSize: 13 }}>
              Trading the global markets can produce losses — anyone who promises otherwise isn’t
              being honest. What discipline controls is how much reaches your capital:
            </p>
            <div style={{ marginTop: 8 }}>
              <Tick>Automated stop-losses on every position</Tick>
              <Tick>Measured position sizing, defined exit rules</Tick>
              <Tick>Minimal time in the market around each event</Tick>
            </div>
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingBottom: 30 }}>
        <div className="hero" style={{ marginTop: 0, paddingBottom: 36 }}>
          <Texture />
          <h2
            style={{
              color: C.onDark,
              fontSize: 'clamp(22px,4vw,30px)',
              fontWeight: 700,
              margin: '0 0 10px',
              letterSpacing: '-.3px',
            }}
          >
            The riskiest thing you can do is nothing.
          </h2>
          <p style={{ marginBottom: 22 }}>
            Every month you wait, the naira decides what your savings are worth. Take the decision
            back.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Link className="btn-gold" to="/open">
              Open an account
            </Link>
            <Link className="btn-ghost" to="/about">
              Talk to us
            </Link>
          </div>
          <div style={{ fontSize: 11.5, color: C.onDarkMute, marginTop: 14 }}>
            Takes about 5 minutes. No payment required to open an account.
          </div>
        </div>
      </section>
    </div>
  );
}
