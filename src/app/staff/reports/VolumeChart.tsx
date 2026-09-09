'use client';

import { useState } from 'react';

export type DailyRow = { day: string; filed: number; completed: number; tickets: number };

/**
 * Requests filed per day. One series, so no legend -- the heading names it.
 * Marks are thin bars with rounded data-ends anchored to the baseline, a 2px
 * gap between neighbours, and a recessive grid. Hover gives an exact figure;
 * the table underneath is the accessible view of the same numbers.
 */
export default function VolumeChart({ rows }: { rows: DailyRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = 200;
  const PAD = { top: 16, right: 12, bottom: 28, left: 34 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...rows.map((r) => r.filed));
  // Round the axis top to something a person would choose.
  const step = max <= 5 ? 1 : max <= 20 ? 5 : max <= 50 ? 10 : 25;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);

  const slot = plotW / Math.max(1, rows.length);
  const barW = Math.max(4, Math.min(28, slot - 2)); // 2px surface gap
  const x = (i: number) => PAD.left + slot * i + (slot - barW) / 2;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const peak = rows.reduce((best, r, i) => (r.filed > rows[best].filed ? i : best), 0);

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
           aria-label="Requests filed per day over the selected range">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
              stroke="var(--line-soft)" strokeWidth="1"
            />
            <text
              x={PAD.left - 8} y={y(t) + 4} textAnchor="end"
              fill="var(--faint)" fontSize="11" fontFamily="var(--f-mono)"
            >
              {t}
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const h = Math.max(r.filed === 0 ? 0 : 2, plotH - (y(r.filed) - PAD.top));
          return (
            <g key={r.day}>
              <rect
                x={x(i)} y={PAD.top} width={barW} height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <rect
                x={x(i)} y={y(r.filed)} width={barW} height={h}
                rx="4" ry="4"
                fill="var(--accent)"
                opacity={hover === null || hover === i ? 1 : 0.55}
                pointerEvents="none"
              />
              {(i === peak || i === rows.length - 1) && r.filed > 0 && hover === null && (
                <text
                  x={x(i) + barW / 2} y={y(r.filed) - 6} textAnchor="middle"
                  fill="var(--muted)" fontSize="11" fontFamily="var(--f-mono)"
                  pointerEvents="none"
                >
                  {r.filed}
                </text>
              )}
            </g>
          );
        })}

        <line
          x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
          stroke="var(--line)" strokeWidth="1"
        />

        {rows.map((r, i) =>
          i % Math.ceil(rows.length / 7) === 0 ? (
            <text
              key={r.day} x={x(i) + barW / 2} y={H - 9} textAnchor="middle"
              fill="var(--faint)" fontSize="11" fontFamily="var(--f-mono)"
            >
              {r.day.slice(5)}
            </text>
          ) : null,
        )}

        {hover !== null && (
          <g pointerEvents="none">
            <text
              x={x(hover) + barW / 2} y={y(rows[hover].filed) - 8} textAnchor="middle"
              fill="var(--ink)" fontSize="12" fontWeight="600" fontFamily="var(--f-mono)"
            >
              {rows[hover].filed}
            </text>
          </g>
        )}
      </svg>

      <p
        className="muted"
        style={{ textAlign: 'center', marginTop: '.3rem', fontSize: '.85rem' }}
      >
        {hover !== null
          ? `${rows[hover].day} · ${rows[hover].filed} filed · ${rows[hover].completed} completed · ${rows[hover].tickets} queue tickets`
          : 'Hover a bar for that day’s figures.'}
      </p>
    </div>
  );
}
