import { C } from '../../lib/constants';
import { moneyK } from '../../lib/format';

export interface Bar {
  label: string;
  value: number;
  color: string;
}

const W = 340;
const H = 170;
const PAD_L = 10;
const PAD_B = 26;
const PAD_T = 12;
const GAP = 26;

/** Tier-breakdown bars from the prototype. */
export function BarChart({ bars, currency = '$' }: { bars: Bar[]; currency?: string }) {
  if (!bars.length) return null;

  const max = Math.max(...bars.map((b) => b.value)) || 1;
  const barWidth = (W - PAD_L * 2 - GAP * (bars.length - 1)) / bars.length;

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Assets under management by portfolio tier"
    >
      {bars.map((b, i) => {
        const h = (H - PAD_T - PAD_B) * (b.value / max);
        const x = PAD_L + i * (barWidth + GAP);
        const y = H - PAD_B - h;
        return (
          <g key={b.label}>
            <rect x={x} y={y} width={barWidth} height={h} rx={7} fill={b.color} />
            <text
              x={x + barWidth / 2}
              y={y - 6}
              fontSize={11}
              fill={C.ink}
              textAnchor="middle"
              fontFamily="IBM Plex Mono"
            >
              {moneyK(b.value, currency)}
            </text>
            <text
              x={x + barWidth / 2}
              y={H - 8}
              fontSize={10.5}
              fill={C.textMute}
              textAnchor="middle"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
