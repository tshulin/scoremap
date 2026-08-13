// The assignment list: category filter (owned by ClassDetail so the chart can
// follow it), per-assignment impact chips, the hidden-points pseudo-rows, and —
// in hypothetical mode — fully inline editing. Every row, not-for-grade
// included, is edited in place; "+ New assignment" drops in a blank row that
// looks like every other assignment. Rows are ordered newest first.
import React from 'react';
import { scoreBandColor as bandColor } from '../../lib/grades.js';
import { Chip, ScoreInput, TextInputSmall, assessmentLike, fmt2, signed } from './ui.jsx';

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

const editControl = {
  padding: '5px 8px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-hairline-strong)',
  background: 'var(--color-surface-strong)',
  color: 'var(--color-ink)',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  fontWeight: 600,
};

const metricRow = {
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  justifyContent: 'end',
  whiteSpace: 'nowrap',
  fontVariantNumeric: 'tabular-nums',
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
    <div style={{ width: '58.333%', alignSelf: 'flex-end', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-progress-track)', overflow: 'hidden' }}>
      <div style={{ width: `${pct != null ? Math.min(pct, 100) : 0}%`, height: '100%', background: bandColor(pct ?? 0), borderRadius: 'var(--radius-pill)', transition: 'width 400ms cubic-bezier(0.22, 1, 0.36, 1), background 400ms ease' }} />
    </div>
  );
}

// The category chip's tone, as a style — the select wears it too, so the
// colored highlight survives the swap from chip to dropdown.
const categoryTone = (name) => {
  if (!name) {
    return { background: 'var(--color-surface-strong)', border: '1px solid var(--color-hairline)', color: 'var(--color-body)' };
  }
  return assessmentLike(name)
    ? { background: 'var(--color-tint-bad)', border: '1px solid transparent', color: 'var(--color-grade-bad)' }
    : { background: 'var(--color-tint-good)', border: '1px solid transparent', color: 'var(--color-grade-good)' };
};

// Options open on the native popup, which won't show the tinted chip
// background — but Chromium does honor per-option colors, so the category
// names stay color-coded inside the list as well.
const optionColor = (name) =>
  assessmentLike(name) ? 'var(--color-grade-bad)' : 'var(--color-grade-good)';

function CategorySelect({ value, options, onChange, label }) {
  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '4px 8px',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        ...categoryTone(value),
      }}
    >
      <option value="" style={{ color: 'var(--color-body)', background: 'var(--color-surface-card)' }}>
        select category
      </option>
      {options.map((name) => (
        <option key={name} value={name} style={{ color: optionColor(name), background: 'var(--color-surface-card)' }}>
          {name}
        </option>
      ))}
    </select>
  );
}

function DateInput({ value, onChange, label }) {
  return (
    <input
      type="date"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={editControl}
    />
  );
}

function AssignmentList({ assignments, categories, scenario, impactById, hiddenRows = [], filter, onFilter }) {
  const { hypothetical, edits, setEdit, added, addAssignment, updateAssignment, removeAssignment, effective } = scenario;

  const effById = React.useMemo(() => new Map(effective.map((a) => [a.id, a])), [effective]);
  const weighted = !!(categories && categories.length > 0);

  // Dropdown options: the class's weight categories, or whatever categories the
  // portal data actually uses. A class with none gets no dropdown — there is
  // nothing to pick from.
  const categoryOptions = React.useMemo(
    () =>
      weighted
        ? categories.map((c) => c.name)
        : [...new Set(assignments.map((a) => a.type).filter((t) => t !== 'Uncategorized'))],
    [weighted, categories, assignments],
  );

  // Tabs and filtering follow the EFFECTIVE category, so recategorizing a row
  // in hypothetical mode moves it between tabs too.
  const effType = (id, fallback) => {
    const eff = effById.get(id);
    return eff ? (eff.category || 'Uncategorized') : fallback;
  };
  const typeOfReal = (a) => (a.raw ? effType(a.raw.id, a.type) : a.type);
  const typeOfAdded = (a) => effType(a.id, 'Uncategorized');

  const types = [...new Set([...assignments.map(typeOfReal), ...added.map(typeOfAdded)])];
  const visible = assignments.filter((a) => filter === 'All' || typeOfReal(a) === filter);
  const visibleAdded = added.filter((a) => filter === 'All' || typeOfAdded(a) === filter);

  // One list, newest first (added hypotheticals default to today, so they
  // naturally start at the top). Ties keep insertion order.
  const rows = [
    ...visibleAdded.map((a) => ({ kind: 'added', a, date: (effById.get(a.id) ?? a).date })),
    ...visible.map((a, i) => ({
      kind: 'real',
      a,
      i,
      date: a.raw ? (effById.get(a.raw.id) ?? a.raw).date : a.isoDate,
    })),
  ].sort((x, y) => (y.date || '').localeCompare(x.date || ''));

  const rowPct = (eff) =>
    eff && eff.pointsEarned !== undefined && eff.pointsPossible
      ? Math.round((eff.pointsEarned / eff.pointsPossible) * 1000) / 10
      : null;

  function FilterTab({ id, dot }) {
    const active = filter === id;
    return (
      <button
        onClick={() => onFilter(id)}
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
          color: active ? 'var(--color-ink)' : 'var(--color-text-meta)',
        }}
      >
        {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
        {id}
      </button>
    );
  }

  const scoreCell = (raw, a) => {
    const editable = hypothetical && raw;
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

  const renderAdded = (a) => {
    const eff = effById.get(a.id) ?? a;
    const impact = impactById.get(a.id);
    const pct = rowPct(eff);
    const edit = edits[a.id] || {};
    const uncounted = weighted && !eff.category;
    return (
      <div key={a.id} style={rowCard}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <TextInputSmall
              value={a.name}
              placeholder="Hypothetical assignment"
              label="Hypothetical assignment name"
              onChange={(v) => updateAssignment(a.id, { name: v })}
            />
            <Chip tone="info">Hypothetical</Chip>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {categoryOptions.length > 0 && (
              <CategorySelect
                value={eff.category || ''}
                options={categoryOptions}
                label={`${eff.name} category`}
                onChange={(v) => setEdit(a.id, 'category', v)}
              />
            )}
            <DateInput value={eff.date} label={`${eff.name} date`} onChange={(v) => setEdit(a.id, 'date', v)} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-body)' }}>
              <input
                type="checkbox"
                checked={a.extraCredit}
                onChange={(e) => updateAssignment(a.id, { extraCredit: e.target.checked })}
                style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }}
              />
              Extra credit
            </label>
            {uncounted && <Chip tone="warn">pick a category to include this</Chip>}
          </div>
        </div>
        <div style={{ flex: '1 1 420px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div style={metricRow}>
            <ImpactChip impact={impact} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textAlign: 'right' }}>
              <ScoreInput
                value={edit.earned ?? (a.pointsEarned !== undefined ? String(a.pointsEarned) : '')}
                placeholder="—"
                label={`${eff.name} points earned`}
                onChange={(v) => setEdit(a.id, 'earned', v)}
              />
              {!a.extraCredit && (
                <>
                  <span style={{ color: 'var(--color-muted)', fontSize: 16 }}>/</span>
                  <ScoreInput
                    value={edit.possible ?? (a.pointsPossible !== undefined ? String(a.pointsPossible) : '')}
                    placeholder="—"
                    label={`${eff.name} points possible`}
                    onChange={(v) => setEdit(a.id, 'possible', v)}
                  />
                </>
              )}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', textAlign: 'right' }}>
              {pct != null ? `${pct}%` : '—'}
            </span>
            <button
              onClick={() => removeAssignment(a.id)}
              aria-label={`Remove ${eff.name}`}
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
  };

  const renderReal = (a, i) => {
    const raw = a.raw;
    const eff = raw ? (effById.get(raw.id) ?? raw) : null;
    const impact = raw ? impactById.get(raw.id) : undefined;
    const pct = hypothetical ? rowPct(eff) : a.pct;
    const editable = hypothetical && raw;
    const type = typeOfReal(a);
    return (
      <div key={`${a.title}-${i}`} style={rowCard}>
        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10 }}>{a.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {editable && categoryOptions.length > 0 ? (
              <CategorySelect
                value={(eff && eff.category) || ''}
                options={categoryOptions}
                label={`${a.title} category`}
                onChange={(v) => setEdit(raw.id, 'category', v)}
              />
            ) : (
              <Chip tone={assessmentLike(type) ? 'assessment' : 'assignment'}>{type}</Chip>
            )}
            {a.scaled && <Chip>Scaled</Chip>}
            {a.extraCredit && <Chip>Extra credit</Chip>}
            {a.notForGrade &&
              (editable ? (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-body)' }}>
                  <input
                    type="checkbox"
                    checked={eff.notForGrade}
                    onChange={(e) => setEdit(raw.id, 'notForGrade', e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }}
                  />
                  Not for grade
                </label>
              ) : (
                <Chip>Not for grade</Chip>
              ))}
            {editable ? (
              <DateInput value={eff.date} label={`${a.title} date`} onChange={(v) => setEdit(raw.id, 'date', v)} />
            ) : (
              <Chip>{a.date}</Chip>
            )}
          </div>
        </div>
        <div style={{ flex: '1 1 420px', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div style={metricRow}>
            <ImpactChip impact={impact} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textAlign: 'right' }}>
              {!editable && a.scaledScore && <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>{a.scaledScore}</span>}
              {scoreCell(raw, a)}
            </span>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', textAlign: 'right' }}>
              {pct != null ? `${pct}%` : '—'}
            </span>
          </div>
          <ScoreBar pct={pct} />
        </div>
      </div>
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
        {/* one click, one blank row — edited in place like everything else */}
        {hypothetical && (
          <button
            onClick={() => addAssignment()}
            style={{
              ...rowCard,
              border: '1px dashed var(--color-hairline-strong)',
              justifyContent: 'center',
              padding: '16px 24px',
              cursor: 'pointer',
              color: 'var(--color-body)',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 600,
              width: '100%',
            }}
          >
            + New assignment
          </button>
        )}

        {rows.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
            No assignments yet.
          </div>
        )}

        {rows.map((r) => (r.kind === 'added' ? renderAdded(r.a) : renderReal(r.a, r.i)))}

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
