// The assignment list: category filter, per-assignment impact chips, inline
// score editing and added hypothetical rows (hypothetical mode), and the
// hidden-points pseudo-rows when the portal's category totals exceed what it
// shows as assignments.
import React from 'react';
import { scoreBandColor as bandColor } from '../../lib/grades.js';
import { Chip, ScoreInput, TextInputSmall, assessmentLike, fmt2, shortDate, signed, todayIso } from './ui.jsx';

const rowCard = {
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-hairline-strong)',
  borderRadius: 'var(--radius-xl)',
  padding: '20px 24px',
  boxSizing: 'border-box',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 24,
  flexWrap: 'wrap',
};

function ImpactChip({ impact }) {
  if (impact === undefined) return null;
  return (
    <span
      title="How much this assignment moved the class grade"
      style={{ fontSize: 15, fontWeight: 600, color: impact < -0.005 ? 'var(--color-grade-bad)' : 'var(--color-muted)' }}
    >
      {signed(impact)}
    </span>
  );
}

function ScoreBar({ pct }) {
  return (
    <div style={{ width: '58.333%', alignSelf: 'flex-end', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface-dark-elevated)', overflow: 'hidden' }}>
      <div style={{ width: `${pct != null ? Math.min(pct, 100) : 0}%`, height: '100%', background: bandColor(pct ?? 0), borderRadius: 'var(--radius-pill)' }} />
    </div>
  );
}

function AddAssignmentForm({ categories, onAdd }) {
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [earned, setEarned] = React.useState('');
  const [possible, setPossible] = React.useState('');
  const [extraCredit, setExtraCredit] = React.useState(false);
  const [date, setDate] = React.useState(todayIso());

  const weighted = !!(categories && categories.length > 0);

  const add = () => {
    onAdd({ name, category, pointsEarned: earned, pointsPossible: possible, extraCredit, date });
    setName('');
    setEarned('');
    setPossible('');
    setExtraCredit(false);
  };

  return (
    <div style={{ ...rowCard, border: '1px dashed var(--color-hairline-strong)', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', flex: '1 1 auto' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-body)' }}>
          Name
          <TextInputSmall value={name} placeholder="Hypothetical assignment" label="New assignment name" onChange={setName} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-body)' }}>
          Category
          {weighted ? (
            <select
              value={category}
              aria-label="New assignment category"
              onChange={(e) => setCategory(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-hairline-strong)',
                background: 'var(--color-surface-strong)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
              }}
            >
              <option value="">— pick a category —</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <TextInputSmall value={category} placeholder="(optional)" label="New assignment category" onChange={setCategory} width={140} />
          )}
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-body)' }}>
          Score
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ScoreInput value={earned} placeholder="—" label="New assignment points earned" onChange={setEarned} />
            {!extraCredit && (
              <>
                <span style={{ color: 'var(--color-muted)', fontSize: 16 }}>/</span>
                <ScoreInput value={possible} placeholder="—" label="New assignment points possible" onChange={setPossible} />
              </>
            )}
          </span>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--color-body)' }}>
          Date
          <input
            type="date"
            value={date}
            aria-label="New assignment date"
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-hairline-strong)',
              background: 'var(--color-surface-strong)',
              color: 'var(--color-ink)',
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-ink)', paddingBottom: 8 }}>
          <input
            type="checkbox"
            checked={extraCredit}
            onChange={(e) => setExtraCredit(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
          />
          Extra credit
        </label>
      </div>
      <button
        onClick={add}
        style={{
          padding: '9px 18px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: 'var(--color-primary)',
          color: 'var(--color-on-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add assignment
      </button>
    </div>
  );
}

function AssignmentList({ assignments, categories, scenario, impactById, hiddenRows = [] }) {
  const [filter, setFilter] = React.useState('All');
  const { hypothetical, edits, setEdit, added, addAssignment, removeAssignment, effective } = scenario;

  const effById = React.useMemo(() => new Map(effective.map((a) => [a.id, a])), [effective]);
  const weighted = !!(categories && categories.length > 0);

  const types = [...new Set([...assignments.map((a) => a.type), ...added.map((a) => a.category || 'Uncategorized')])];
  const visible = assignments.filter((a) => filter === 'All' || a.type === filter);
  const visibleAdded = added.filter((a) => filter === 'All' || (a.category || 'Uncategorized') === filter);

  const rowPct = (eff) =>
    eff && eff.pointsEarned !== undefined && eff.pointsPossible
      ? Math.round((eff.pointsEarned / eff.pointsPossible) * 1000) / 10
      : null;

  function FilterTab({ id, dot }) {
    const active = filter === id;
    return (
      <button
        onClick={() => setFilter(id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 500,
          background: active ? 'var(--color-surface-dark-elevated)' : 'transparent',
          color: active ? 'var(--color-ink)' : 'var(--color-body)',
        }}
      >
        {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
        {id}
      </button>
    );
  }

  const scoreCell = (raw, a) => {
    const editable = hypothetical && raw && !a.notForGrade;
    const edit = (raw && edits[raw.id]) || {};
    if (!editable) {
      return <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>{a.score}</span>;
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <ScoreInput
          value={edit.earned ?? (raw.pointsEarned !== undefined ? String(raw.pointsEarned) : '')}
          placeholder="—"
          label={`${a.title} points earned`}
          onChange={(v) => setEdit(raw.id, 'earned', v)}
        />
        {!a.extraCredit && (
          <>
            <span style={{ color: 'var(--color-muted)', fontSize: 16 }}>/</span>
            <ScoreInput
              value={edit.possible ?? (raw.pointsPossible !== undefined ? String(raw.pointsPossible) : '')}
              placeholder="—"
              label={`${a.title} points possible`}
              onChange={(v) => setEdit(raw.id, 'possible', v)}
            />
          </>
        )}
      </span>
    );
  };

  return (
    <>
      {/* filter — one tab per category present in the data */}
      {types.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-card)', border: '1px solid var(--color-hairline-strong)', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
            <FilterTab id="All" />
            {types.map((t) => (
              <FilterTab key={t} id={t} dot={assessmentLike(t) ? 'var(--color-grade-bad)' : 'var(--color-grade-good)'} />
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {hypothetical && <AddAssignmentForm categories={categories} onAdd={addAssignment} />}

        {/* added hypothetical rows */}
        {visibleAdded.map((a) => {
          const eff = effById.get(a.id) ?? a;
          const impact = impactById.get(a.id);
          const pct = rowPct(eff);
          const edit = edits[a.id] || {};
          const uncounted = weighted && !a.category;
          return (
            <div key={a.id} style={{ ...rowCard, border: '1px dashed var(--color-hairline-strong)' }}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10 }}>{a.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Chip tone="info">Hypothetical</Chip>
                  {a.category && <Chip tone={assessmentLike(a.category) ? 'assessment' : 'assignment'}>{a.category}</Chip>}
                  {a.extraCredit && <Chip>Extra credit</Chip>}
                  <Chip>{shortDate(a.date)}</Chip>
                  {uncounted && <Chip tone="warn">pick a category to include this</Chip>}
                </div>
              </div>
              <div style={{ flex: '1 1 420px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, whiteSpace: 'nowrap' }}>
                  <ImpactChip impact={impact} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ScoreInput
                      value={edit.earned ?? (a.pointsEarned !== undefined ? String(a.pointsEarned) : '')}
                      placeholder="—"
                      label={`${a.name} points earned`}
                      onChange={(v) => setEdit(a.id, 'earned', v)}
                    />
                    {!a.extraCredit && (
                      <>
                        <span style={{ color: 'var(--color-muted)', fontSize: 16 }}>/</span>
                        <ScoreInput
                          value={edit.possible ?? (a.pointsPossible !== undefined ? String(a.pointsPossible) : '')}
                          placeholder="—"
                          label={`${a.name} points possible`}
                          onChange={(v) => setEdit(a.id, 'possible', v)}
                        />
                      </>
                    )}
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', minWidth: 64, textAlign: 'right' }}>
                    {pct != null ? `${pct}%` : '—'}
                  </span>
                  <button
                    onClick={() => removeAssignment(a.id)}
                    aria-label={`Remove ${a.name}`}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-muted)',
                      cursor: 'pointer',
                      fontSize: 18,
                      lineHeight: 1,
                      padding: '4px 6px',
                    }}
                  >
                    ✕
                  </button>
                </div>
                <ScoreBar pct={pct} />
              </div>
            </div>
          );
        })}

        {visible.length === 0 && visibleAdded.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
            No assignments yet.
          </div>
        )}

        {/* real rows */}
        {visible.map((a, i) => {
          const raw = a.raw;
          const eff = raw ? (effById.get(raw.id) ?? raw) : null;
          const impact = raw ? impactById.get(raw.id) : undefined;
          const pct = hypothetical ? rowPct(eff) : a.pct;
          const editable = hypothetical && raw && !a.notForGrade;
          return (
            <div key={`${a.title}-${i}`} style={rowCard}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10 }}>{a.title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Chip tone={assessmentLike(a.type) ? 'assessment' : 'assignment'}>{a.type}</Chip>
                  {a.scaled && <Chip>Scaled</Chip>}
                  {a.extraCredit && <Chip>Extra credit</Chip>}
                  {a.notForGrade && <Chip>Not for grade</Chip>}
                  <Chip>{a.date}</Chip>
                </div>
              </div>
              <div style={{ flex: '1 1 420px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, whiteSpace: 'nowrap' }}>
                  <ImpactChip impact={impact} />
                  {!editable && a.scaledScore && <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>{a.scaledScore}</span>}
                  {scoreCell(raw, a)}
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', minWidth: 64, textAlign: 'right' }}>
                    {pct != null ? `${pct}%` : '—'}
                  </span>
                </div>
                <ScoreBar pct={pct} />
              </div>
            </div>
          );
        })}

        {/* hidden points: the portal's category totals include work it never
            listed as assignments. Not editable — it isn't ours to invent. */}
        {filter === 'All' &&
          hiddenRows.map((d) => (
            <div key={`hidden-${d.category}`} style={{ ...rowCard, opacity: 0.9 }}>
              <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10 }}>
                  Point discrepancy in {d.category}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Chip tone="warn">hidden points</Chip>
                  <Chip>
                    {fmt2(d.pointsEarned)}/{fmt2(d.pointsPossible)} not shown as assignments
                  </Chip>
                </div>
              </div>
              <div style={{ flex: '1 1 200px', display: 'flex', justifyContent: 'flex-end' }}>
                <ImpactChip impact={d.gradeImpact} />
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

export default AssignmentList;
