// Grade overview: per-category current %, the category's share of the final
// grade *right now* (renormalized over graded categories — "Finals is 20% on
// paper but 0% of your grade today"), and its contribution to the course %.
// Reads the effective assignment list, so hypothetical edits live-update it.
import React from 'react';
import { scoreBandColor as bandColor } from '../../lib/grades.js';
import { categoryOverview } from '../../calc/index';
import { Chip, fmt2 } from './ui.jsx';

function Bar({ pct, color }) {
  return (
    <div style={{ width: 160, maxWidth: '100%', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface-dark-elevated)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(pct ?? 0, 100))}%`, height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
    </div>
  );
}

const th = { padding: '6px 16px 10px 0', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '12px 16px 12px 0', verticalAlign: 'middle' };

function OverviewTab({ assignments, categories, hiddenRows = [], hypothetical }) {
  const rows = React.useMemo(
    () => categoryOverview(assignments, categories),
    [assignments, categories],
  );
  // Hidden points come from the synced data (see ClassDetail), keyed by name —
  // the overview's own effective-based diff would mistake edits for portal gaps.
  const hiddenByName = React.useMemo(
    () => new Map(hiddenRows.map((d) => [d.category, d])),
    [hiddenRows],
  );

  if (rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
        No graded work yet — the overview appears with the first scored assignment.
      </div>
    );
  }

  const weighted = rows.some((r) => r.nominalWeightPct != null);
  const totalContribution = rows.reduce((n, r) => n + r.contributionPct, 0);

  return (
    <div
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px 24px',
        overflowX: 'auto',
      }}
    >
      {hypothetical && (
        <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
          Reflecting your hypothetical scenario — toggle it off on the Assignments tab to see the
          synced numbers.
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, color: 'var(--color-ink)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 13 }}>
            <th style={th}>Category</th>
            <th style={th}>Points</th>
            <th style={th}>Current grade</th>
            <th style={th}>Share of final grade</th>
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
                    : '—'}
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Bar pct={row.currentPct} color={row.currentPct != null ? bandColor(row.currentPct) : 'transparent'} />
                    <span style={{ fontWeight: 600, minWidth: 56, color: row.currentPct != null ? bandColor(row.currentPct) : 'var(--color-muted)' }}>
                      {row.currentPct != null ? `${fmt2(row.currentPct)}%` : 'no work'}
                    </span>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Bar pct={row.effectiveWeightPct} color="var(--color-ink)" />
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{fmt2(row.effectiveWeightPct)}%</span>
                      {row.nominalWeightPct != null && row.nominalWeightPct !== row.effectiveWeightPct && (
                        <span style={{ color: 'var(--color-muted)', fontSize: 13 }}>
                          {' '}
                          · declared {fmt2(row.nominalWeightPct)}%
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td style={{ ...td, paddingRight: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {fmt2(row.contributionPct)}%
                </td>
              </tr>
            );
          })}
          <tr style={{ borderTop: '1px solid var(--color-hairline-strong)' }}>
            <td style={{ ...td, fontWeight: 600, color: 'var(--color-muted)' }} colSpan={4}>
              {weighted
                ? 'Course grade (contributions sum, renormalized over graded categories)'
                : 'Course grade (share of all points earned)'}
            </td>
            <td style={{ ...td, paddingRight: 0, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {fmt2(totalContribution)}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default OverviewTab;
