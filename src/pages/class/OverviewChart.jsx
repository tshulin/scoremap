// Overview multigraph: one running-percentage line per category (just that
// category's assignments, replayed in date order) overlaid with the cumulative
// course grade. Legend checkboxes toggle lines (all on by default). What-if
// grades come from the overview table (the `overrides` prop): an overridden
// line jumps there today, dashed, as if the assignments landed now, and the
// cumulative line follows.
import React from 'react';
import { gradeSeries } from '../../calc/index';
import { fmt2, shortDate, todayIso, weekdayDate } from './ui.jsx';

// Categorical palette, validated (dataviz six-checks) against the dark card
// surface: lightness band, chroma, CVD ΔE ≥ 8 on adjacent pairs, contrast.
// Grade-band green/yellow/red are status colors here and deliberately absent.
// Categories beyond the palette fall to muted gray rather than cycling hues.
const CAT_COLORS = ['#3987e5', '#d95926', '#199e70', '#9085e9', '#d55181'];
const CUMULATIVE = '__cumulative__';

const W = 1000;
const H = 280;
const padL = 46;
const padR = 16;
const padT = 14;
const padB = 34;

const NO_OVERRIDES = new Map();

function OverviewChart({ assignments, categories, rows, overrides = NO_OVERRIDES }) {
  const weighted = !!(categories && categories.length > 0);
  const [hidden, setHidden] = React.useState(() => new Set());
  const [hover, setHover] = React.useState(null);

  const lines = React.useMemo(() => {
    const built = [];
    let latest = todayIso();

    // An unweighted class with no categories has one "All" bucket that IS the
    // cumulative line — drawing it twice would just shadow the ink line.
    const catRows = !weighted && rows.length === 1 ? [] : rows;
    for (const [idx, r] of catRows.entries()) {
      const base = gradeSeries(assignments.filter((a) => (a.category ?? 'All') === r.name));
      const points = base.map((p) => ({ date: p.date, grade: p.grade }));
      if (points.length) latest = points[points.length - 1].date > latest ? points[points.length - 1].date : latest;
      built.push({
        key: r.name,
        label: r.name,
        color: idx < CAT_COLORS.length ? CAT_COLORS[idx] : 'var(--color-muted)',
        points,
        dashedFrom: null,
        width: 2,
      });
    }

    const cumBase = gradeSeries(assignments, categories);
    const cum = {
      key: CUMULATIVE,
      label: 'Cumulative',
      color: 'var(--color-trend-stroke)',
      points: cumBase.map((p) => ({ date: p.date, grade: p.grade })),
      dashedFrom: null,
      width: 2.5,
    };
    if (cum.points.length) latest = cum.points[cum.points.length - 1].date > latest ? cum.points[cum.points.length - 1].date : latest;

    // What-ifs land on an anchor date: today, or the newest data point when the
    // gradebook runs ahead of the calendar — never before the series ends.
    if (overrides.size > 0) {
      const jumpTo = (line, grade) => {
        const last = line.points[line.points.length - 1];
        if (last && last.date === latest) {
          line.points = [...line.points.slice(0, -1), { date: latest, grade }];
          line.dashedFrom = Math.max(0, line.points.length - 2);
        } else {
          line.dashedFrom = line.points.length ? line.points.length - 1 : null;
          line.points = [...line.points, { date: latest, grade }];
        }
      };
      for (const line of built) {
        if (overrides.has(line.key)) jumpTo(line, overrides.get(line.key));
      }
      // Cumulative under the what-ifs: declared weights (or, unweighted, the
      // point-share weights) over every category that has — or is given — a
      // grade; an empty weighted category with a what-if joins at full weight.
      let wSum = 0;
      let total = 0;
      for (const r of rows) {
        const p = overrides.has(r.name) ? overrides.get(r.name) : r.currentPct;
        const w = r.nominalWeightPct ?? r.effectiveWeightPct;
        if (p == null || !w) continue;
        wSum += w;
        total += w * p;
      }
      if (wSum > 0) jumpTo(cum, total / wSum);
    }

    built.push(cum);
    return built.filter((l) => l.points.length > 0);
  }, [rows, assignments, categories, weighted, overrides]);

  const visibleLines = lines.filter((l) => !hidden.has(l.key));

  // Shared x axis: the union of every line's dates, evenly spaced — built from
  // ALL lines so toggling one doesn't reshuffle the others.
  const dates = React.useMemo(
    () => [...new Set(lines.flatMap((l) => l.points.map((p) => p.date)))].sort(),
    [lines],
  );
  const dateIndex = new Map(dates.map((d, i) => [d, i]));

  React.useEffect(() => setHover(null), [dates.length]);
  if (dates.length === 0) return null;

  const grades = visibleLines.flatMap((l) => l.points.map((p) => p.grade));
  const lo = grades.length ? Math.min(...grades) : 0;
  const hi = grades.length ? Math.max(...grades) : 100;
  const yMin = Math.floor(lo) - 1;
  let yMax = hi > 100 ? Math.ceil(hi) + 1 : Math.min(Math.ceil(hi) + 1, 100);
  if (yMax <= yMin) yMax = yMin + 2;

  const xAt = (i) => padL + (dates.length === 1 ? 0.5 : i / (dates.length - 1)) * (W - padL - padR);
  const yAt = (v) => padT + ((yMax - v) / (yMax - yMin)) * (H - padT - padB);

  const rawStep = (yMax - yMin) / 4;
  const step = [0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25].find((s) => s >= rawStep) ?? 50;
  const ticks = [];
  for (let t = Math.ceil(yMin / step) * step; t <= yMax + 1e-9; t += step) {
    ticks.push(Math.round(t * 100) / 100);
  }

  const stride = Math.max(1, Math.ceil(dates.length / 8));
  const labeled = new Set();
  for (let i = 0; i < dates.length; i += stride) labeled.add(i);
  labeled.add(dates.length - 1);

  const pickNearest = (evt) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = ((evt.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < dates.length; i++) {
      const d = Math.abs(xAt(i) - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHover(best);
  };

  const pathFor = (points) =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(dateIndex.get(p.date)).toFixed(1)} ${yAt(p.grade).toFixed(1)}`)
      .join(' ');

  const toggle = (key) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const hoverDate = hover != null ? dates[hover] : null;
  const hoverRows = hoverDate
    ? visibleLines
        .map((l) => ({ line: l, point: l.points.find((p) => p.date === hoverDate) }))
        .filter((r) => r.point)
    : [];

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block' }}
          onMouseMove={pickNearest}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="var(--color-hairline)" strokeWidth="1" />
              <text x={padL - 8} y={yAt(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">
                {fmt2(t)}
              </text>
            </g>
          ))}
          {hover != null && (
            <line x1={xAt(hover)} y1={padT} x2={xAt(hover)} y2={H - padB} stroke="var(--color-hairline-strong)" strokeWidth="1" />
          )}
          {visibleLines.map((l) => {
            const solid = l.dashedFrom != null ? l.points.slice(0, l.dashedFrom + 1) : l.points;
            const dashed = l.dashedFrom != null ? l.points.slice(l.dashedFrom) : [];
            return (
              <g key={l.key}>
                {solid.length > 1 && (
                  <path d={pathFor(solid)} fill="none" stroke={l.color} strokeWidth={l.width} strokeLinejoin="round" strokeLinecap="round" />
                )}
                {dashed.length > 1 && (
                  <path d={pathFor(dashed)} fill="none" stroke={l.color} strokeWidth={l.width} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
                )}
                {l.points.map((p) => (
                  <circle
                    key={p.date}
                    cx={xAt(dateIndex.get(p.date))}
                    cy={yAt(p.grade)}
                    r={hoverDate === p.date ? 4.5 : 3}
                    fill={l.color}
                  />
                ))}
              </g>
            );
          })}
          {dates.map(
            (d, i) =>
              labeled.has(i) && (
                <text key={d} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--color-muted)">
                  {shortDate(d)}
                </text>
              ),
          )}
        </svg>

        {hoverRows.length > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${(xAt(hover) / W) * 100}%`,
              top: 6,
              transform: `translateX(${hover > dates.length / 2 ? 'calc(-100% - 10px)' : '10px'})`,
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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 4 }}>
              {weekdayDate(hoverDate)}
            </div>
            {hoverRows.map(({ line, point }) => (
              <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-body)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: line.color, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{line.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--color-ink)' }}>{fmt2(point.grade)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* legend = the line toggles, kept to one slim row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', marginTop: 8, alignItems: 'center' }}>
        {lines.map((l) => (
          <label
            key={l.key}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--color-text-meta)', lineHeight: 1.2 }}
          >
            <input
              type="checkbox"
              checked={!hidden.has(l.key)}
              onChange={() => toggle(l.key)}
              style={{ width: 13, height: 13, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <span style={{ width: 9, height: 9, borderRadius: 2, background: l.color }} />
            {l.label}
          </label>
        ))}
      </div>
    </div>
  );
}

export default OverviewChart;
