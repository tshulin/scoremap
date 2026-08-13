// Grade-over-time, derived from the effective assignment list by replaying it
// in date order (src/calc/series). No stored history: a retroactively-edited
// score changes the "past" — inherent to a derived series, and how
// GradeCompass behaved too. Renders only with 2+ points.
import React from 'react';
import { useSession } from '../../data/SyncProvider.jsx';
import { fmt2, shortDate, signed, weekdayDate } from './ui.jsx';
import { useCursorTooltip } from './useCursorTooltip.js';

// Geometry is shared with OverviewChart (same fixed height, same paddings) so
// switching between the Assignments and Overview tabs keeps the plot frame
// perfectly in place — only the lines change. Width is measured from the
// container (GradeCompass-style): the svg maps 1:1 to pixels at any screen
// size, so the chart fills the page and text never stretches.
const H = 260;
const padL = 40;
const padR = 8;
const padT = 14;
const padB = 34;

// `activeDates`/`activeType` mirror the assignment list's category filter: the
// line keeps its shape (the grade history doesn't change), but only dates with
// work in the selected category keep their dots and hover.
function GradeChart({ series, activeDates = null, activeType = null }) {
  // Remounting the draw group replays the left→right sweep: the key changes
  // when a refresh lands (ClassDetail keys the whole chart by class, which
  // covers switching classes). Hypothetical edits don't replay it.
  const session = useSession();
  const drawKey = session.lastUpdated ?? 'init';
  const [hover, setHover] = React.useState(null);
  // The focus dot's resting index: keeps the last hovered node so the dot can
  // slide between nodes (and fade out in place) instead of teleporting.
  const [dotIndex, setDotIndex] = React.useState(null);
  // The tooltip eases toward the cursor every frame (rAF smoothing — see hook).
  const { tooltipRef, onMove, flipStyle } = useCursorTooltip();
  // Real pixel width from the container, so coordinates are 1:1 with screen.
  const wrapRef = React.useRef(null);
  const [W, setW] = React.useState(1000);
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const measure = () => setW(Math.max(320, el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  React.useEffect(() => setHover(null), [activeDates]);
  React.useEffect(() => setDotIndex(null), [series.length]);
  if (series.length < 2) return null;

  const hoverable = (i) => !activeDates || activeDates.has(series[i].date);

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
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < series.length; i++) {
      if (!hoverable(i)) continue;
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
    if (best != null) setDotIndex(best);
    onMove(evt, rect);
  };

  const linePath = grades
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${xAt(series.length - 1).toFixed(1)} ${H - padB} L ${xAt(0).toFixed(1)} ${H - padB} Z`;

  const hovered = hover != null ? series[hover] : null;
  // How much this date moved the grade vs. the previous point (none for the first).
  const hoverDelta = hover != null && hover > 0 ? series[hover].grade - series[hover - 1].grade : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative', marginBottom: 20 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
        onMouseMove={pickNearest}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="gradeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-trend-stroke)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="var(--color-trend-stroke)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="var(--color-hairline)" strokeWidth="1" />
            {/* left-anchored at the svg edge — the page header's course name
                aligns to this same line */}
            <text x={0} y={yAt(t) + 4} textAnchor="start" fontSize="12" fill="var(--color-muted)">
              {fmt2(t)}
            </text>
          </g>
        ))}
        <g key={drawKey} className="gm-chart-draw">
          <path d={areaPath} fill="url(#gradeFill)" />
          <path d={linePath} fill="none" stroke="var(--color-trend-stroke)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {series.map(
            (p, i) =>
              hoverable(i) && (
                <circle
                  key={p.date}
                  cx={xAt(i)}
                  cy={yAt(p.grade)}
                  r={2.6}
                  fill="var(--color-trend-stroke)"
                />
              ),
          )}
        </g>
        {/* focus dot — slides along the line to the hovered node, fades out
            in place when the cursor leaves (mirrors GradeCompass's chart
            highlight) */}
        {dotIndex != null && dotIndex < series.length && (
          <g
            style={{
              transform: `translate(${xAt(dotIndex)}px, ${yAt(series[dotIndex].grade)}px)`,
              transition: 'transform 180ms cubic-bezier(0.25, 1, 0.5, 1), opacity 150ms ease',
              opacity: hover != null ? 1 : 0,
            }}
          >
            <circle r="4.5" fill="var(--color-trend-stroke)" />
          </g>
        )}
        {series.map(
          (p, i) =>
            labeled.has(i) && (
              <text
                key={`l${p.date}`}
                x={xAt(i)}
                y={H - 10}
                textAnchor={i === series.length - 1 ? 'end' : 'middle'}
                fontSize="12"
                fill="var(--color-muted)"
              >
                {shortDate(p.date)}
              </text>
            ),
        )}
      </svg>

      {hovered && (
        <div
          ref={tooltipRef}
          style={{
            // Position (left/top) is driven by the rAF smoother in
            // useCursorTooltip; only the side-flip lives in `flipStyle`.
            position: 'absolute',
            ...flipStyle,
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
          {hovered.assignments
            .filter((a) => !activeType || (a.category || 'Uncategorized') === activeType)
            .map((a) => (
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
