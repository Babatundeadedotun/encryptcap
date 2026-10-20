import { C } from '../../lib/constants';
import { moneyK } from '../../lib/format';

/** Any row with a label; the numeric series are looked up by key at runtime. */
export interface AreaPoint {
  label: string;
}

interface DashedLine {
  key: string;
  color: string;
}

interface Props {
  data: readonly AreaPoint[];
  /** Key of the series that gets the filled area. */
  primary: string;
  lines?: DashedLine[];
  /** Optional gold reference line, used for the deposit / high-water mark. */
  markLine?: number | null;
  currency?: string;
  area?: string;
  stroke?: string;
  title?: string;
}

const W = 720;
const H = 240;
const PAD_L = 54;
const PAD_R = 16;
const PAD_T = 14;
const PAD_B = 26;

/**
 * The prototype's area chart, rebuilt as SVG elements. Renders at a fixed
 * viewBox and scales to its container, so it stays crisp at any width.
 */
export function AreaChart({
  data,
  primary,
  lines = [],
  markLine = null,
  currency = '$',
  area = C.blue,
  stroke = C.blueDeep,
  title,
}: Props) {
  // Series values are addressed by key, so read each row as a lookup table.
  const at = (row: AreaPoint, key: string): number | undefined => {
    const value = (row as unknown as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
  };

  const points = data.filter((d) => at(d, primary) != null);

  if (points.length === 0) {
    return (
      <div style={{ padding: '48px 16px', textAlign: 'center', fontSize: 13, color: C.textFaint }}>
        Nothing to chart yet.
      </div>
    );
  }

  const values: number[] = [];
  points.forEach((d) => {
    values.push(at(d, primary)!);
    lines.forEach((l) => {
      const v = at(d, l.key);
      if (v != null) values.push(v);
    });
  });
  if (markLine != null) values.push(markLine);

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min *= 0.9;
    max *= 1.1;
  }
  const padV = (max - min || 1) * 0.12;
  min -= padV;
  max += padV;
  // Don't dip a chart of positive figures below zero just from padding.
  if (min < 0 && Math.min(...values) >= 0) min = 0;

  const n = points.length;
  const x = (i: number) => PAD_L + (W - PAD_L - PAD_R) * (n <= 1 ? 0.5 : i / (n - 1));
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / (max - min || 1));

  const gridlines = Array.from({ length: 5 }, (_, g) => {
    const v = min + (max - min) * (g / 4);
    return { v, y: y(v) };
  });

  const step = Math.max(1, Math.ceil(n / 8));
  const path = points
    .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(at(d, primary)!).toFixed(1)}`)
    .join(' ');
  const baseline = y(Math.max(min, 0));

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title ?? 'Performance chart'}
    >
      {gridlines.map((g, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke={C.lineSoft} strokeWidth={1} />
          <text
            x={PAD_L - 8}
            y={g.y + 4}
            fontSize={10}
            fill={C.textFaint}
            textAnchor="end"
            fontFamily="IBM Plex Mono"
          >
            {moneyK(g.v, currency)}
          </text>
        </g>
      ))}

      {points.map((d, i) =>
        i % step === 0 || i === n - 1 ? (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            fontSize={10}
            fill={C.textFaint}
            textAnchor="middle"
            fontFamily="IBM Plex Mono"
          >
            {d.label}
          </text>
        ) : null,
      )}

      <path d={`${path} L${x(n - 1)},${baseline} L${x(0)},${baseline} Z`} fill={`${area}22`} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2.2} strokeLinejoin="round" />

      {lines.map((l) => (
        <path
          key={l.key}
          d={points
            .map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(at(d, l.key) ?? 0).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke={l.color}
          strokeWidth={1.6}
          strokeDasharray="1 4"
          strokeLinecap="round"
        />
      ))}

      {markLine != null && (
        <line
          x1={PAD_L}
          y1={y(markLine)}
          x2={W - PAD_R}
          y2={y(markLine)}
          stroke={C.gold}
          strokeWidth={1.6}
          strokeDasharray="6 4"
        />
      )}
    </svg>
  );
}
