// Multi-assignment target calculator (an improvement over GradeCompass's
// one-at-a-time version): pick several not-yet-graded assignments, set a
// target %, and the solver finds the one uniform percentage across them that
// lands the course grade on the target. Typing a score for a row locks it at
// that value and the remaining rows re-solve, so you can play "what if I bomb
// this one" and watch the others rise. All math in src/calc/multiTarget.
import React from 'react';
import GradeNumber from '../../components/GradeNumber.jsx';
import { inferScale, solveUniformTarget } from '../../calc/index';
import { Chip, Dialog, ScoreInput, fmt2, shortDate } from './ui.jsx';
import { categoryChipStyle, makeCategoryColorMap } from './categoryColors.js';

// Selectable: real assignments that are assigned but not graded, plus any
// added hypotheticals (whose scores are the student's to play with anyway).
export const targetCandidates = (effective) =>
  effective.filter(
    (a) =>
      !a.notForGrade &&
      ((a.pointsEarned === undefined && (a.pointsPossible !== undefined || a.extraCredit)) ||
        a.id.startsWith('hypo-')),
  );

function TargetDialog({ onClose, effective, categories, scale }) {
  const candidates = React.useMemo(() => targetCandidates(effective), [effective]);
  const categoryColors = React.useMemo(
    () => makeCategoryColorMap(
      effective.map((assignment) => assignment.category),
      (categories ?? []).map((category) => category.name),
    ),
    [categories, effective],
  );

  const [target, setTarget] = React.useState('90');
  const [selectedIds, setSelectedIds] = React.useState({});
  // { [id]: string } - a parseable value locks the row at that score.
  const [locks, setLocks] = React.useState({});

  const letterRows = React.useMemo(
    () => (scale ?? inferScale([])).filter((r) => r.letter !== 'F'),
    [scale],
  );

  const toggle = (id) =>
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  const setLock = (id, value) => setLocks((prev) => ({ ...prev, [id]: value }));
  const clearLock = (id) =>
    setLocks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const targetPct = parseFloat(target);
  const selected = candidates.filter((a) => selectedIds[a.id]);
  const selectedSet = new Set(selected.map((a) => a.id));

  const selections = selected.map((assignment) => {
    const lockRaw = locks[assignment.id];
    const locked = lockRaw !== undefined && lockRaw !== '' && Number.isFinite(parseFloat(lockRaw));
    return { assignment, ...(locked ? { lockedEarned: parseFloat(lockRaw) } : {}) };
  });

  const result =
    selected.length > 0 && Number.isFinite(targetPct)
      ? solveUniformTarget({
          targetPercentage: targetPct,
          selections,
          otherAssignments: effective.filter((a) => !selectedSet.has(a.id)),
          categories,
        })
      : null;

  const neededById = new Map(
    result && 'perAssignment' in result ? result.perAssignment.map((p) => [p.id, p.pointsNeeded]) : [],
  );

  return (
    <Dialog title="Target calculator" onClose={onClose}>
      {/* target input + letter quick-picks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 15, color: 'var(--color-ink)' }}>I want the class grade to be</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ScoreInput value={target} placeholder="90" label="Target percentage" onChange={setTarget} width={72} />
          <span style={{ color: 'var(--color-muted)', fontSize: 15 }}>%</span>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {letterRows.map((r) => (
          <button
            key={r.letter}
            onClick={() => setTarget(String(r.lowerBound))}
            title={`${r.letter} starts at ${fmt2(r.lowerBound)}% (${r.source})`}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-hairline)',
              background: 'var(--color-surface-strong)',
              color: 'var(--color-body)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {r.letter} {fmt2(r.lowerBound)}
          </button>
        ))}
      </div>

      {candidates.length === 0 ? (
        <div style={{ color: 'var(--color-muted)', fontSize: 15, padding: '24px 0' }}>
          Nothing to solve for. Every assignment already has a score. Add a hypothetical
          assignment first (Hypothetical mode → add), then plan against it here.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 10 }}>
            Pick the upcoming assignments to spread the work over. Type a score to lock a row;
            the others re-solve around it; ↺ unlocks.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {candidates.map((a) => {
              const isSelected = !!selectedIds[a.id];
              const lockRaw = locks[a.id] ?? '';
              const isLocked = lockRaw !== '' && Number.isFinite(parseFloat(lockRaw));
              const needed = neededById.get(a.id);
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
                    background: isSelected ? 'var(--color-surface-strong)' : 'transparent',
                  }}
                >
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: '1 1 240px', color: 'var(--color-ink)', fontSize: 15, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(a.id)}
                      aria-label={`Include ${a.name}`}
                      style={{ width: 16, height: 16, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {a.name}
                      {a.category && a.category !== 'Uncategorized' && (
                        <Chip style={categoryChipStyle(a.category, categoryColors)}>{a.category}</Chip>
                      )}
                      {a.id.startsWith('hypo-') && <Chip tone="info">Hypothetical</Chip>}
                      {a.extraCredit && <Chip>Extra credit</Chip>}
                      <Chip>{shortDate(a.date)}</Chip>
                      {!a.extraCredit && a.pointsPossible !== undefined && <Chip>{fmt2(a.pointsPossible)} pts</Chip>}
                    </span>
                  </label>
                  {isSelected && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                      {!isLocked && needed !== undefined && (
                        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>
                          needs <GradeNumber value={needed} suffix={a.pointsPossible !== undefined ? `/${fmt2(a.pointsPossible)}` : ''} />
                        </span>
                      )}
                      {a.extraCredit && !isLocked && (
                        <span style={{ fontSize: 13, color: 'var(--color-grade-mid)' }}>
                          extra credit: enter a score
                        </span>
                      )}
                      <ScoreInput
                        value={lockRaw}
                        placeholder={needed !== undefined ? fmt2(needed) : 'N/A'}
                        label={`${a.name} locked score`}
                        onChange={(v) => setLock(a.id, v)}
                      />
                      {isLocked && (
                        <button
                          onClick={() => clearLock(a.id)}
                          aria-label={`Unlock ${a.name}`}
                          title="Unlock and rejoin the uniform average"
                          style={{ border: 'none', background: 'transparent', color: 'var(--color-text-link)', cursor: 'pointer', fontSize: 17, lineHeight: 1, padding: 2 }}
                        >
                          ↺
                        </button>
                      )}
                      {isLocked && <Chip tone="info">locked</Chip>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* result */}
          <div
            style={{
              borderTop: '1px solid var(--color-hairline)',
              paddingTop: 14,
              fontSize: 15,
              color: 'var(--color-ink)',
              minHeight: 24,
            }}
          >
            {selected.length === 0 ? (
              <span style={{ color: 'var(--color-muted)' }}>Pick at least one assignment above.</span>
            ) : !Number.isFinite(targetPct) ? (
              <span style={{ color: 'var(--color-muted)' }}>Enter a target percentage.</span>
            ) : result && 'infeasible' in result ? (
              <span style={{ color: 'var(--color-grade-mid)' }}>{result.reason}</span>
            ) : result && 'allLocked' in result ? (
              <span>
                With those scores the class lands at{' '}
                <strong><GradeNumber value={result.resultingGrade} /></strong>{' '}
                <span style={{ color: 'var(--color-muted)' }}>
                  ({result.resultingGrade >= targetPct ? 'meets' : 'misses'} the {fmt2(targetPct)}% target)
                </span>
              </span>
            ) : result ? (
              <span>
                Average <strong><GradeNumber value={result.uniformPct} /></strong> on the unlocked
                {result.perAssignment.length === 1 ? ' assignment' : ' assignments'} to finish at{' '}
                {fmt2(targetPct)}%.
                {result.uniformPct > 100 && (
                  <span style={{ color: 'var(--color-grade-mid)' }}>
                    {' '}
                    That's over 100%. It is not possible without extra credit.
                  </span>
                )}
                {result.uniformPct < 0 && (
                  <span style={{ color: 'var(--color-muted)' }}>
                    {' '}
                    Even zeros keep you at the target.
                  </span>
                )}
              </span>
            ) : null}
          </div>
        </>
      )}
    </Dialog>
  );
}

export default TargetDialog;
