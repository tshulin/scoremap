// Grade-over-time, derived from the effective assignment list by replaying it
// in date order (src/calc/series). No stored history: a retroactively-edited
// score changes the "past" — inherent to a derived series, and how
// GradeCompass behaved too. Renders only with 2+ points.
import React from 'react';
import { fmt2, shortDate, signed, weekdayDate } from './ui.jsx';

const W = 1000;
const H = 260;
const padL = 46;
const padR = 16;
const padT = 14;
const padB = 34;

function GradeChart({ series }) {
  const [hover, setHover] = React.useState(null);
  if (series.length < 2) return null;

  const grades = series.map((p) => p.grade);
  const lo = Math.min(...grades);
  const hi = Math.max(...grades);
  // Domain from the data; the top is allowed past 100 only when extra credit
  // actually pushed the grade there.
  const yMin = Math.floor(lo) - 1;
  let yMax = hi > 100 ? Math.ceil(hi) + 1 : Math.min(Math.ceil(hi) + 1, 100);
  if (yMax <= yMin) yMax = yMin + 2;

  const xAt = (i) => padL + (i / (series.length - 1)) * (W - padL - padR);
  const yAt = (v) => padT + ((yMax - v) / (yMax - yMin)) * (H - padT - padB);

  // ~5 y ticks at a sensible step.
  const rawStep = (yMax - yMin) / 4;
  const step = [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25].find((s) => s >= rawStep) ?? 50;
  const ticks = [];
  for (let t = Math.ceil(yMin / step) * step; t <= yMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }

  // At most 8 x labels: every Nth date plus the last.
  const stride = Math.max(1, Math.ceil(series.length / 8));
  const labeled = new Set();
  for (let i = 0; i < series.length; i += stride) labeled.add(i);
  labeled.add(series.length - 1);

  const pickNearest = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < series.length; i++) {
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  };

  const linePath = grades
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${H - padB} L ${xAt(0).toFixed(1)} ${H - padB} Z`;

  const hovered = hover != null ? series[hover] : null;
  // How much this date moved the grade vs. the previous point (none for the first).
  const hoverDelta = hover != null && hover > 0 ? series[hover].grade - series[hover - 1].grade : null;

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block' }}
        onMouseMove={pickNearest}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gradeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="var(--color-hairline)" strokeWidth="1" />
            <text x={padL - 8} y={yAt(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">
              {fmt2(t)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill="url(#gradeFill)" />
        <path d={linePath} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((p, i) => (
          <circle
            key={p.date}
            cx={xAt(i)}
            cy={yAt(p.grade)}
            r={hover === i ? 4.5 : 2.6}
            fill="var(--color-ink)"
          />
        ))}
        {series.map(
          (p, i) =>
            labeled.has(i) && (
              <text key={`l${p.date}`} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--color-muted)">
                {shortDate(p.date)}
              </text>
            ),
        )}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: `${(xAt(hover) / W) * 100}%`,
            top: `${(yAt(hovered.grade) / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
            background: 'var(--color-surface-dark-elevated)',
            border: '1px solid var(--color-hairline-strong)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-soft-drop)',
            padding: '8px 12px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>
            {weekdayDate(hovered.date)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>{fmt2(hovered.grade)}%</span>
            {hoverDelta != null && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: hoverDelta >= 0 ? 'var(--color-grade-good)' : 'var(--color-grade-bad)',
                }}
              >
                {signed(hoverDelta)}
              </span>
            )}
          </div>
          {hovered.assignments.map((a) => (
            <div key={a.id} style={{ fontSize: 12, color: 'var(--color-body)' }}>
              {a.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GradeChart;
