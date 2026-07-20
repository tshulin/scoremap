// Max/min grade calculator: for each category the student enters the points
// still to come this term and the worst/best average % they expect on that
// remaining work; src/calc/bounds turns that into the lowest and highest
// possible final grade (monotone in each expectation, so the extremes need no
// search). Entering remaining points for an empty category (Finals) pulls its
// weight into the renormalized grade — exactly "how much can finals hurt me".
import React from 'react';
import { gradeBounds, inferScale, isCalculable, resolveLetter } from '../../calc/index';
import { scoreBandColor as bandColor } from '../../lib/grades.js';
import { Check, Dialog, ScoreInput, fmt2 } from './ui.jsx';

// Current per-category % of the chosen assignment set (label 'All' when
// unweighted) — used to prefill the expectation inputs so the initial output
// brackets today's grade.
function currentPctByCategory(assignments, categories) {
  const weighted = !!(categories && categories.length > 0);
  const totals = new Map();
  for (const a of assignments.filter(isCalculable)) {
    const name = weighted ? a.category : 'All';
    if (name === undefined) continue;
    const t = totals.get(name) ?? { earned: 0, possible: 0 };
    t.earned += a.pointsEarned;
    if (!a.extraCredit) t.possible += a.pointsPossible;
    totals.set(name, t);
  }
  const pct = new Map();
  for (const [name, t] of totals) {
    if (t.possible > 0) pct.set(name, Math.round((t.earned / t.possible) * 10000) / 100);
  }
  return pct;
}

function BoundsDialog({ onClose, baseAssignments, effective, hypothetical, categories, scale }) {
  const letterScale = React.useMemo(() => scale ?? inferScale([]), [scale]);
  // Real synced data by default; the current hypothetical scenario opt-in.
  const [useScenarioData, setUseScenarioData] = React.useState(false);
  const assignments = useScenarioData ? effective : baseAssignments;

  const weighted = !!(categories && categories.length > 0);
  const rowNames = React.useMemo(
    () => (weighted ? categories.map((c) => c.name) : ['All']),
    [weighted, categories],
  );

  const makeDefaults = React.useCallback(
    (source) => {
      const current = currentPctByCategory(source, categories);
      const rows = {};
      for (const name of rowNames) {
        const pct = current.get(name);
        rows[name] = {
          remaining: '0',
          // No graded work yet → the honest a-priori bounds.
          min: pct !== undefined ? String(pct) : '0',
          max: pct !== undefined ? String(pct) : '100',
        };
      }
      return rows;
    },
    [categories, rowNames],
  );

  const [rows, setRows] = React.useState(() => makeDefaults(assignments));
  const setField = (name, field, value) =>
    setRows((prev) => ({ ...prev, [name]: { ...prev[name], [field]: value } }));

  const toggleSource = (on) => {
    setUseScenarioData(on);
    // Fresh defaults for the other data set — the current %s differ.
    setRows(makeDefaults(on ? effective : baseAssignments));
  };

  const remaining = [];
  let invalid = null;
  for (const name of rowNames) {
    const r = rows[name] ?? { remaining: '0', min: '0', max: '100' };
    const pts = parseFloat(r.remaining);
    const minPct = parseFloat(r.min);
    const maxPct = parseFloat(r.max);
    if (!Number.isFinite(pts) || pts === 0) continue;
    if (pts < 0) invalid = `${name}: points remaining can't be negative.`;
    else if (!Number.isFinite(minPct) || !Number.isFinite(maxPct)) invalid = `${name}: enter worst and best percentages.`;
    else if (minPct > maxPct) invalid = `${name}: the worst case is above the best case.`;
    remaining.push({
      ...(weighted ? { category: name } : {}),
      pointsRemaining: pts,
      minPct: Number.isFinite(minPct) ? minPct : 0,
      maxPct: Number.isFinite(maxPct) ? maxPct : 100,
    });
  }

  const result = invalid
    ? null
    : gradeBounds({ assignments, categories, remaining });
  const perCategory = new Map((result?.perCategory ?? []).map((c) => [c.name, c]));

  return (
    <Dialog title="Max / min grade" onClose={onClose}>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 12 }}>
        For each {weighted ? 'category' : 'class'}, estimate the points still to come this term
        and your worst/best average on that work. With everything at 0 remaining, both bounds
        are today's grade.
      </div>

      {hypothetical && (
        <div style={{ marginBottom: 14 }}>
          <Check
            label="Start from the current hypothetical scenario (instead of synced grades)"
            checked={useScenarioData}
            onChange={toggleSource}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {rowNames.map((name) => {
          const r = rows[name] ?? { remaining: '0', min: '', max: '' };
          const detail = perCategory.get(name);
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-hairline)',
              }}
            >
              <span style={{ flex: '1 1 120px', fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
                {weighted ? name : 'Remaining work'}
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)' }}>
                points left
                <ScoreInput value={r.remaining} placeholder="0" label={`${name} points remaining`} onChange={(v) => setField(name, 'remaining', v)} />
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)' }}>
                worst
                <ScoreInput value={r.min} placeholder="0" label={`${name} worst percent`} onChange={(v) => setField(name, 'min', v)} />
                <span style={{ color: 'var(--color-muted)' }}>%</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)' }}>
                best
                <ScoreInput value={r.max} placeholder="100" label={`${name} best percent`} onChange={(v) => setField(name, 'max', v)} />
                <span style={{ color: 'var(--color-muted)' }}>%</span>
              </label>
              <span style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap', minWidth: 120, textAlign: 'right' }}>
                {detail && detail.min != null
                  ? detail.min === detail.max
                    ? `stays ${fmt2(detail.min)}%`
                    : `${fmt2(detail.min)}% – ${fmt2(detail.max)}%`
                  : 'no points yet'}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 14, fontSize: 15, color: 'var(--color-ink)' }}>
        {invalid ? (
          <span style={{ color: 'var(--color-grade-mid)' }}>{invalid}</span>
        ) : result ? (
          result.min === result.max ? (
            <span>
              With nothing left to grade, the class stays at{' '}
              <strong style={{ color: bandColor(result.min) }}>
                {fmt2(result.min)}% ({resolveLetter(result.min, letterScale)})
              </strong>
              .
            </span>
          ) : (
            <span>
              Your final grade lands between{' '}
              <strong style={{ color: bandColor(result.min) }}>
                {fmt2(result.min)}% ({resolveLetter(result.min, letterScale)})
              </strong>{' '}
              and{' '}
              <strong style={{ color: bandColor(result.max) }}>
                {fmt2(result.max)}% ({resolveLetter(result.max, letterScale)})
              </strong>
              .
            </span>
          )
        ) : null}
      </div>
    </Dialog>
  );
}

export default BoundsDialog;
