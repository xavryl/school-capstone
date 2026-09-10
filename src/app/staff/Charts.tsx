/**
 * Three small charts for the overview, drawn as plain SVG.
 *
 * No library and no client component: the numbers come from the server render
 * and never change without a re-render, so there is nothing for JavaScript to
 * do. Every chart carries a legend or an axis with the real figures beside it,
 * because a shape alone is not an answer to "how many" -- and that legend is
 * also what somebody reading with a screen reader gets.
 */

export type Slice = { label: string; value: number; color: string };

/**
 * Today's queue as a ring. A ring rather than a pie because the total belongs
 * in the middle: the first question at a counter is how many people are here
 * at all, and the split is the follow-up.
 */
export function Donut({
  slices,
  centreLabel,
}: {
  slices: Slice[];
  centreLabel: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  // Where each arc starts, as a running total of what came before it.
  let offset = 0;
  const arcs = slices.map((s) => {
    const len = total === 0 ? 0 : (s.value / total) * C;
    const arc = { ...s, len, offset };
    offset += len;
    return arc;
  });

  return (
    <div className="chart-ring">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img"
           aria-label={`${centreLabel}: ${slices.map((s) => `${s.value} ${s.label}`).join(', ')}`}>
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke="var(--sunk)" strokeWidth="16"
        />
        {total > 0 &&
          arcs.map((a) => (
            <circle
              key={a.label}
              cx="70" cy="70" r={R} fill="none"
              stroke={a.color} strokeWidth="16" strokeLinecap="butt"
              strokeDasharray={`${a.len} ${C - a.len}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 70 70)"
            >
              <title>{`${a.label}: ${a.value}`}</title>
            </circle>
          ))}
        <text
          x="70" y="66" textAnchor="middle"
          fill="var(--ink)" fontSize="26" fontWeight="700" fontFamily="var(--f-mono)"
        >
          {total}
        </text>
        <text x="70" y="86" textAnchor="middle" fill="var(--faint)" fontSize="11">
          {centreLabel}
        </text>
      </svg>

      <ul className="legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="legend-swatch" style={{ background: s.color }} aria-hidden="true" />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value mono">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Numbers issued per hour today. The shape of the morning rush is the thing
 * you cannot get from a total, and it is what tells you when to put a second
 * person on the counter.
 */
export function HourBars({
  hours,
  from = 7,
  to = 18,
}: {
  hours: Record<number, number>;
  from?: number;
  to?: number;
}) {
  const span = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(1, ...span.map((h) => hours[h] ?? 0));

  const W = 420;
  const H = 150;
  const PAD = { top: 12, right: 8, bottom: 26, left: 26 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / span.length;
  const barW = Math.max(6, slot - 5);

  // 7a / 12n / 3p rather than a bare number: a counter opens at 7 and closes
  // at 5, and "3" on its own could be either end of the day.
  const hourLabel = (h: number) =>
    h === 12 ? '12n' : h > 12 ? `${h - 12}p` : `${h}a`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label={`Queue numbers issued per hour today, ${from}:00 to ${to}:00`}>
      {[0, max / 2, max].map((t) => (
        <g key={t}>
          <line
            x1={PAD.left} x2={W - PAD.right}
            y1={PAD.top + plotH - (t / max) * plotH}
            y2={PAD.top + plotH - (t / max) * plotH}
            stroke="var(--line-soft)"
          />
          <text
            x={PAD.left - 6} y={PAD.top + plotH - (t / max) * plotH + 4}
            textAnchor="end" fill="var(--faint)" fontSize="10" fontFamily="var(--f-mono)"
          >
            {Math.round(t)}
          </text>
        </g>
      ))}

      {span.map((h, i) => {
        const v = hours[h] ?? 0;
        const barH = v === 0 ? 0 : Math.max(3, (v / max) * plotH);
        return (
          <g key={h}>
            <rect
              x={PAD.left + slot * i + (slot - barW) / 2}
              y={PAD.top + plotH - barH}
              width={barW} height={barH}
              rx="3" fill="var(--accent)"
            >
              <title>{`${hourLabel(h)}: ${v}`}</title>
            </rect>
            {i % 2 === 0 && (
              <text
                x={PAD.left + slot * i + slot / 2} y={H - 8}
                textAnchor="middle" fill="var(--faint)" fontSize="10"
                fontFamily="var(--f-mono)"
              >
                {hourLabel(h)}
              </text>
            )}
          </g>
        );
      })}

      <line
        x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
        stroke="var(--line)"
      />
    </svg>
  );
}

export type TrendRow = { day: string; a: number; b: number };

/**
 * Two series a day apart, one filled and one dashed. Whatever the pair, the
 * point is the same: a single line tells you a total went up, and two tell you
 * whether the office kept pace with it.
 */
export function TrendLines({
  rows,
  aLabel,
  bLabel,
}: {
  rows: TrendRow[];
  aLabel: string;
  bLabel: string;
}) {
  // Wide on purpose. The card runs the width of the page, and an SVG scales
  // its whole coordinate system: a narrow viewBox here would render 400px tall
  // with the axis labels blown up to match.
  const W = 960;
  const H = 260;
  const PAD = { top: 18, right: 14, bottom: 34, left: 40 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b]));
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : 25;
  const top = Math.ceil(max / step) * step;

  const x = (i: number) =>
    PAD.left + (rows.length <= 1 ? plotW / 2 : (i / (rows.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const path = (key: 'a' | 'b') =>
    rows.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(r[key])}`).join(' ');

  const area =
    rows.length > 0
      ? `${path('a')} L${x(rows.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`
      : '';

  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  return (
    <div className="stack" style={{ gap: '.4rem' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label={`${aLabel} against ${bLabel}, per day`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
            <text
              x={PAD.left - 8} y={y(t) + 5} textAnchor="end"
              fill="var(--faint)" fontSize="13" fontFamily="var(--f-mono)"
            >
              {t}
            </text>
          </g>
        ))}

        {rows.length > 1 && <path d={area} fill="var(--accent-soft)" opacity=".7" />}
        {rows.length > 1 && (
          <path d={path('a')} fill="none" stroke="var(--accent)" strokeWidth="3"
                strokeLinejoin="round" strokeLinecap="round" />
        )}
        {rows.length > 1 && (
          <path d={path('b')} fill="none" stroke="var(--signal)" strokeWidth="3"
                strokeDasharray="7 5" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {rows.map((r, i) => (
          <g key={r.day}>
            <circle cx={x(i)} cy={y(r.a)} r="3.4" fill="var(--accent)">
              <title>{`${r.day}: ${r.a} ${aLabel.toLowerCase()}, ${r.b} ${bLabel.toLowerCase()}`}</title>
            </circle>
            {i % Math.max(1, Math.ceil(rows.length / 5)) === 0 && (
              <text
                x={x(i)} y={H - 10} textAnchor="middle"
                fill="var(--faint)" fontSize="13" fontFamily="var(--f-mono)"
              >
                {r.day.slice(5)}
              </text>
            )}
          </g>
        ))}

        <line
          x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
          stroke="var(--line)"
        />
      </svg>

      <ul className="legend row-legend">
        <li>
          <span className="legend-swatch" style={{ background: 'var(--accent)' }} aria-hidden="true" />
          <span className="legend-label">{aLabel}</span>
        </li>
        <li>
          <span className="legend-swatch dashed" style={{ background: 'var(--signal)' }} aria-hidden="true" />
          <span className="legend-label">{bLabel}</span>
        </li>
      </ul>
    </div>
  );
}

export type Bar = { label: string; value: number };

/**
 * A categorical bar chart -- weekdays, offices, anything with a short name and
 * a count. Values sit above their bars rather than in a tooltip, because this
 * one is usually read from across a desk.
 */
export function Bars({ bars, height = 150 }: { bars: Bar[]; height?: number }) {
  const W = 420;
  const H = height;
  const PAD = { top: 18, right: 8, bottom: 24, left: 26 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...bars.map((b) => b.value));
  const slot = plotW / Math.max(1, bars.length);
  const barW = Math.max(8, Math.min(46, slot - 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
         aria-label={bars.map((b) => `${b.label}: ${b.value}`).join(', ')}>
      <line
        x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
        stroke="var(--line)"
      />
      {bars.map((b, i) => {
        const h = b.value === 0 ? 0 : Math.max(3, (b.value / max) * plotH);
        const cx = PAD.left + slot * i + slot / 2;
        return (
          <g key={b.label}>
            <rect
              x={cx - barW / 2} y={PAD.top + plotH - h} width={barW} height={h}
              rx="4" fill="var(--accent)"
            />
            {b.value > 0 && (
              <text
                x={cx} y={PAD.top + plotH - h - 5} textAnchor="middle"
                fill="var(--muted)" fontSize="11" fontFamily="var(--f-mono)"
              >
                {b.value}
              </text>
            )}
            <text
              x={cx} y={H - 7} textAnchor="middle"
              fill="var(--faint)" fontSize="11"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
