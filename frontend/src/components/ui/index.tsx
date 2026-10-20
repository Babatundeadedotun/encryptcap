import type { ReactNode } from 'react';
import { C, TIERS, type TierId } from '../../lib/constants';
import { initials } from '../../lib/format';

export function Kpi({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  warn?: boolean;
}) {
  return (
    <div className={`kpi${warn ? ' warn' : ''}`}>
      <div className="l">{label}</div>
      <div className="v" style={{ color: accent ?? C.ink }}>
        {value}
      </div>
      <div className="s">{sub ?? ''}</div>
    </div>
  );
}

export function TierPill({ tier, dark }: { tier: TierId; dark?: boolean }) {
  const t = TIERS[tier];
  return (
    <span
      className="pill"
      style={{
        color: dark ? C.onDark : C.ink,
        background: `${t.accent}${dark ? '33' : '1A'}`,
        border: `1px solid ${t.accent}66`,
      }}
    >
      <i style={{ background: t.accent }} />
      {t.short}
    </span>
  );
}

export function Avatar({ name, dark }: { name: string; dark?: boolean }) {
  return <span className={`avatar${dark ? ' dark' : ''}`}>{initials(name)}</span>;
}

export function StatusPill({ inProfit }: { inProfit: boolean }) {
  const color = inProfit ? C.green : C.red;
  return (
    <span
      className="status"
      style={{ color, background: `${color}14`, border: `1px solid ${color}44` }}
    >
      {inProfit ? 'in profit' : 'below deposit'}
    </span>
  );
}

export function Tick({ children }: { children: ReactNode }) {
  return (
    <div className="tick">
      <i>✓</i>
      {children}
    </div>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="eyebrow" style={color ? { color } : undefined}>
      {children}
    </div>
  );
}

/** The faint market-chart wash behind every deep-blue board. */
export function Texture() {
  return <div className="tex" />;
}

export function Field({
  id,
  label,
  required,
  hint,
  children,
  style,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="field" style={style}>
      <label htmlFor={id}>
        {label} {required && <em aria-hidden="true">*</em>}
      </label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="err" role="alert">
      {children}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '30px 16px' }}>
      <div style={{ fontWeight: 700, color: C.ink, marginBottom: 5, fontSize: 15 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMute, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: C.textMute, fontSize: 14 }}>
      {label}
    </div>
  );
}
