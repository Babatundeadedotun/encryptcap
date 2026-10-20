import { Link } from 'react-router-dom';
import { ADDRESS, C, EMAIL, PHONE, RC, WHATSAPP_URL } from '../../lib/constants';
import { Eyebrow, Texture } from '../../components/ui';

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="card">
      <div className="t">{title}</div>
      <div className="b">{body}</div>
    </div>
  );
}

function ContactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="crow">
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export default function About() {
  return (
    <div className="wrap">
      <section className="hero" style={{ paddingBottom: 46 }}>
        <Texture />
        <Eyebrow color={C.gold}>About us</Eyebrow>
        <h1>We built the door we couldn’t find.</h1>
        <p style={{ maxWidth: 640 }}>
          Encrypt Capital Ltd. is a Nigerian investment firm giving everyday investors structured
          access to the world’s largest financial markets — with USD-denominated returns, automated
          execution, and reporting you can actually read.
        </p>
      </section>

      <section className="sect-tight" style={{ paddingTop: 22 }}>
        <div className="grid3">
          <Card
            title="The problem was personal first"
            body="Like everyone around us, we watched hard-earned naira savings quietly lose value while the “safe” options returned less than inflation took. The tools that beat that gap were locked behind specialist knowledge and prohibitive minimums."
          />
          <Card
            title="So we built the access layer"
            body="Encrypt Capital combines a fundamentals-focused strategy, an automated execution system, and a managed-account structure that lets an investor start from $1,000 instead of $100,000."
          />
          <Card
            title="And tied our pay to your outcome"
            body="We take a share of profit and nothing else. When your account doesn’t grow, we don’t earn. That’s not marketing — it’s the fee structure."
          />
        </div>
      </section>

      <section className="sect">
        <Eyebrow>What we stand for</Eyebrow>
        <h2 className="head">Three commitments.</h2>
        <div className="grid3" style={{ marginTop: 14 }}>
          <Card
            title="Transparency by default"
            body="Every investor gets a monthly performance report and a capital position statement at each review. You’ll never have to ask us what happened to your money."
          />
          <Card
            title="Realistic, not romantic"
            body="Trading the global markets carries real risk. We say so on the first call, in the contract, and on this website — because anyone who doesn’t is selling you something else."
          />
          <Card
            title="Discipline over instinct"
            body="Our system trades a defined strategy around defined events with defined risk limits. No revenge trades. No hunches."
          />
        </div>
      </section>

      <section className="sect" id="contact">
        <div className="contact">
          <Texture />
          <Eyebrow color={C.gold}>Contact</Eyebrow>
          <h3>Talk to a human.</h3>
          <p>
            Questions about tiers, cycles, or how your capital is held? Reach us directly — we reply
            within one business day.
          </p>
          <ContactRow label="Email">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
          </ContactRow>
          <ContactRow label="Phone / WhatsApp">
            {PHONE ? (
              <>
                <a href={`tel:${PHONE.replace(/[^\d+]/g, '')}`}>{PHONE}</a>
                {WHATSAPP_URL && (
                  <>
                    {' · '}
                    <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </>
                )}
              </>
            ) : (
              // Set VITE_CONTACT_PHONE in frontend/.env to fill this in.
              <span style={{ color: C.onDarkMute }}>Add before launch</span>
            )}
          </ContactRow>
          <ContactRow label="Office">{ADDRESS}</ContactRow>
          <ContactRow label="Hours">Monday – Friday, 9:00am – 6:00pm WAT</ContactRow>
          <ContactRow label="Company">Encrypt Capital Ltd. · RC {RC}</ContactRow>
          <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
            <a
              className="btn-gold"
              href={`mailto:${EMAIL}?subject=${encodeURIComponent('Enquiry — Encrypt Capital')}`}
            >
              Send us an email
            </a>
            <Link className="btn-ghost" to="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
