// Grade overview: the category multigraph (OverviewChart) on top - same spot
// and framing as the assignments-tab chart - with the category table below.
// The table doubles as the what-if editor - each category's current grade is
// a typeable box (defaulting to the real value); typing a different number
// replays the whole overview as if that grade landed today: effective
// weights, contributions, the Final Grade row, and the chart's dashed jumps
// all follow. The ↺ in the header restores reality. Reads the effective
// assignment list, so hypothetical edits live-update too.
import React from 'react';
import { scoreBandColor as bandColor } from '../../lib/grades.js';
import { categoryOverview } from '../../calc/index';
import { Chip, ScoreInput, fmt2 } from './ui.jsx';
import OverviewChart from './OverviewChart.jsx';
import { compareCategoryNames } from './categoryColors.js';

const th = { padding: '6px 12px 8px 0', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '10px 12px 10px 0', verticalAlign: 'middle' };

function Bar({ pct, color }) {
  return (
    <div style={{ width: 96, maxWidth: '100%', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface-dark-elevated)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(pct ?? 0, 100))}%`, height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
    </div>
  );
}

const card = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-hairline-strong)',
  borderRadius: 'var(--radius-xl)',
  padding: '18px 24px',
  boxSizing: 'border-box',
};

function OverviewTab({ assignments, categories, hiddenRows = [] }) {
  const baseRows = React.useMemo(
    () => categoryOverview(assignments, categories).sort((a, b) => compareCategoryNames(a.name, b.name)),
    [assignments, categories],
  );
  // Hidden points come from the synced data (see ClassDetail), keyed by name -
  // the overview's own effective-based diff would mistake edits for portal gaps.
  const hiddenByName = React.useMemo(
    () => new Map(hiddenRows.map((d) => [d.category, d])),
    [hiddenRows],
  );

  // What-if grades, keyed by category name; input strings. A value that
  // parses and differs from the real grade becomes an override.
  const [whatIf, setWhatIf] = React.useState({});
  const overrides = React.useMemo(() => {
    const out = new Map();
    for (const r of baseRows) {
      if (!(r.name in whatIf)) continue;
      const v = parseFloat(whatIf[r.name]);
      if (!Number.isFinite(v)) continue;
      if (r.currentPct != null && Math.abs(v - r.currentPct) < 0.005) continue;
      out.set(r.name, v);
    }
    return out;
  }, [baseRows, whatIf]);

  // The rows as displayed: what-ifs replace current grades, and (weighted) an
  // empty category given a grade joins the gradebook at its declared weight.
  const rows = React.useMemo(() => {
    if (overrides.size === 0) return baseRows;
    const pctOf = (r) => (overrides.has(r.name) ? overrides.get(r.name) : r.currentPct);
    const weighted = baseRows.some((r) => r.nominalWeightPct != null);
    const totalW = weighted
      ? baseRows.reduce((n, r) => n + (pctOf(r) != null ? r.nominalWeightPct : 0), 0)
      : 0;
    return baseRows.map((r) => {
      const pct = pctOf(r);
      const effW = weighted
        ? pct != null && totalW > 0
          ? (r.nominalWeightPct / totalW) * 100
          : 0
        : r.effectiveWeightPct;
      return {
        ...r,
        currentPct: pct,
        effectiveWeightPct: effW,
        contributionPct: pct != null ? (pct / 100) * effW : 0,
      };
    });
  }, [baseRows, overrides]);

  if (baseRows.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
        No graded work yet. The overview appears with the first scored assignment.
      </div>
    );
  }

  const weighted = baseRows.some((r) => r.nominalWeightPct != null);
  const totalContribution = rows.reduce((n, r) => n + r.contributionPct, 0);

  return (
    <>
      {/* the multigraph sits where the assignments-tab chart does - top, full width */}
      <div style={{ marginBottom: 20 }}>
        <OverviewChart assignments={assignments} categories={categories} rows={baseRows} overrides={overrides} />
      </div>

      {/* the table keeps the readable cap while the chart above runs full width */}
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ ...card, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, color: 'var(--color-ink)' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 13 }}>
                <th style={th}>Category</th>
                <th style={th}>Points</th>
                <th style={th}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Current grade
                    <button
                      onClick={() => setWhatIf({})}
                      aria-label="Reset what-if grades"
                      title="Reset what-if grades"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: overrides.size > 0 ? 'var(--color-ink)' : 'var(--color-muted)',
                        cursor: 'pointer',
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 2,
                      }}
                    >
                      ↺
                    </button>
                  </span>
                </th>
                <th style={th}>Effective weight</th>
                <th style={th}>Final weight</th>
                <th style={{ ...th, paddingRight: 0 }}>Contribution</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const hidden = hiddenByName.get(row.name);
                return (
                  <tr key={row.name} style={{ borderTop: '1px solid var(--color-hairline)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {row.name}
                        {hidden && (
                          <Chip tone="warn">
                            +{fmt2(hidden.pointsEarned)}/{fmt2(hidden.pointsPossible)} hidden
                          </Chip>
                        )}
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {row.pointsPossible > 0 || row.pointsEarned > 0
                        ? `${fmt2(row.pointsEarned)}/${fmt2(row.pointsPossible)}`
                        : 'N/A'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                        <Bar pct={row.currentPct} color={row.currentPct != null ? bandColor(row.currentPct) : 'transparent'} />
                        <ScoreInput
                          width={60}
                          value={whatIf[row.name] ?? (row.currentPct != null ? fmt2(row.currentPct) : '')}
                          placeholder="N/A"
                          label={`${row.name} current grade`}
                          onChange={(v) => setWhatIf((prev) => ({ ...prev, [row.name]: v }))}
                        />
                        <span style={{ fontWeight: 600, color: row.currentPct != null ? bandColor(row.currentPct) : 'var(--color-muted)' }}>
                          %
                        </span>
                      </span>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>{fmt2(row.effectiveWeightPct)}%</td>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {row.nominalWeightPct != null ? `${fmt2(row.nominalWeightPct)}%` : 'N/A'}
                    </td>
                    <td style={{ ...td, paddingRight: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {fmt2(row.contributionPct)}%
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '1px solid var(--color-hairline-strong)' }}>
                <td style={{ ...td, fontWeight: 600, color: 'var(--color-muted)' }} colSpan={5}>
                  Final Grade
                </td>
                <td style={{ ...td, paddingRight: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {fmt2(totalContribution)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default OverviewTab;
