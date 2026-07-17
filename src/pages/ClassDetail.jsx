/**
 * ClassDetail — one class's grade-over-time chart + assignment list
 * (route: /grades/:classId). Reached by clicking a class on the dashboard.
 *
 * Excludes the reference's "Pin chart to top of screen" toggle. The line
 * chart uses a minimalist monochrome scheme (white line on a faint fill) —
 * no orange, per the Grademax "color is informational, never decorative"
 * rule. Assignment score bars use the design-system grade-band tokens
 * (green / yellow / red), not an arbitrary accent.
 *
 * Attaches to window.ClassDetail. Under a bundler: export default ClassDetail,
 * and import Sidebar + the DS components.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { scoreBandColor as bandColor } from '../lib/grades.js';
import { useAssignments, useClass, useGradeHistory } from '../data/SyncProvider.jsx';
// The grade engine runs right here in the browser — the server only supplies
// the assignment data.
import { assignmentImpacts, courseGrade, isCalculable, pointsByCategory } from '../calc/index';

// Category name → chip tone. Real portal categories vary by teacher
// ("Tests", "Assessments", "Homework", …), so tone is a keyword match.
const assessmentLike = (type) => /test|exam|assess|quiz|final/i.test(type);

const fmt2 = (n) => String(Math.round(n * 100) / 100);
const signed = (n) => `${n >= 0 ? '+' : ''}${fmt2(n)}%`;

function ClassDetail() {
  const { classId } = useParams();
  const cls = useClass(classId);
  const history = useGradeHistory(classId);
  const ASSIGNMENTS = useAssignments(classId);

  const CLASS_NAME = cls ? cls.name : 'Class';
  const GRADE = cls ? (cls.pct != null ? `${cls.grade} ${cls.pct}%` : '—') : '';

  const [hypothetical, setHypothetical] = React.useState(false);
  const [breakdown, setBreakdown] = React.useState(false);
  const [filter, setFilter] = React.useState('All');
  // Hypothetical-score overrides, keyed by assignment id: { earned, possible }
  // as input strings. Cleared when hypothetical mode turns off.
  const [edits, setEdits] = React.useState({});

  const categories = cls ? cls.categories : undefined;

  // Effective domain assignments = synced data + any hypothetical edits.
  const override = (raw) => {
    const e = edits[raw.id];
    if (!hypothetical || !e) return raw;
    const out = { ...raw };
    const earned = parseFloat(e.earned);
    const possible = parseFloat(e.possible);
    if (e.earned !== undefined && e.earned !== '' && Number.isFinite(earned)) {
      out.pointsEarned = earned;
    }
    if (e.possible !== undefined && e.possible !== '' && Number.isFinite(possible)) {
      out.pointsPossible = possible;
    }
    return out;
  };
  const effective = ASSIGNMENTS.filter((a) => a.raw).map((a) => override(a.raw));

  const anyCalculable = effective.some(isCalculable);
  const computedGrade = anyCalculable ? courseGrade(effective, categories) : null;
  const impactById = new Map(
    assignmentImpacts(effective, categories).map((i) => [i.assignment.id, i.gradeImpact]),
  );

  const setEdit = (id, field, value) =>
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  const toggleHypothetical = (on) => {
    setHypothetical(on);
    if (!on) setEdits({});
  };

  // ---- grade-over-time series ----
  // The backend has no grade-history endpoint yet, so this is empty until it
  // does — the chart renders only with 2+ points.
  const dates = history.dates;
  const values = history.values;

  const types = [...new Set(ASSIGNMENTS.map((a) => a.type))];
  const visible = ASSIGNMENTS.filter((a) => filter === 'All' || a.type === filter);

  // ---- chart geometry ----
  const W = 1000, H = 260, padL = 46, padR = 16, padT = 14, padB = 34;
  const yMin = 98.2, yMax = 100;
  const xAt = (i) => padL + (i / (values.length - 1)) * (W - padL - padR);
  const yAt = (v) => padT + ((yMax - v) / (yMax - yMin)) * (H - padT - padB);
  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xAt(values.length - 1).toFixed(1)} ${H - padB} L ${xAt(0).toFixed(1)} ${H - padB} Z`;
  const yTicks = [98.5, 99, 99.5, 100];

  // ---- small UI bits ----
  function ScoreInput({ value, placeholder, onChange, label }) {
    return (
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        value={value}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 64,
          padding: '6px 8px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-hairline-strong)',
          background: 'var(--color-surface-strong)',
          color: 'var(--color-ink)',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 600,
          textAlign: 'right',
        }}
      />
    );
  }

  function Check({ label, checked, onChange }) {
    return (
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 15, color: 'var(--color-ink)' }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
        />
        {label}
      </label>
    );
  }

  function Chip({ children, tone = 'neutral' }) {
    const tones = {
      neutral: { background: 'var(--color-surface-strong)', border: '1px solid var(--color-hairline)', color: 'var(--color-body)' },
      assignment: { background: 'rgba(0, 201, 80, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-good)' },
      assessment: { background: 'rgba(251, 44, 54, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-bad)' },
    };
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, lineHeight: 1.2, ...tones[tone] }}>
        {children}
      </span>
    );
  }

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <SyncPill />

          {/* header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: 'clamp(28px, 3.4vw, 42px)', fontWeight: 600, letterSpacing: '-1px', color: 'var(--color-ink)' }}>
              {CLASS_NAME}
            </h1>
            {hypothetical ? (
              <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 600, letterSpacing: '-0.5px', color: computedGrade != null ? bandColor(computedGrade) : 'var(--color-ink)' }}>
                  {computedGrade != null ? `${fmt2(computedGrade)}%` : '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  hypothetical · official: {GRADE || '—'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                {GRADE}
              </div>
            )}
          </div>

          {/* chart */}
          {values.length >= 2 && (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', marginBottom: 20 }}>
            <defs>
              <linearGradient id="gradeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={padL} y1={yAt(t)} x2={W - padR} y2={yAt(t)} stroke="var(--color-hairline)" strokeWidth="1" />
                <text x={padL - 8} y={yAt(t) + 4} textAnchor="end" fontSize="12" fill="var(--color-muted)">{t.toFixed(1)}</text>
              </g>
            ))}
            <path d={areaPath} fill="url(#gradeFill)" />
            <path d={linePath} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (
              <circle key={i} cx={xAt(i)} cy={yAt(v)} r="2.6" fill="var(--color-ink)" />
            ))}
            {dates.map((d, i) => (
              <text key={d} x={xAt(i)} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--color-muted)">{d}</text>
            ))}
          </svg>
          )}

          {/* toggles (Pin chart deliberately omitted) */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 12 }}>
            <Check label="Hypothetical mode" checked={hypothetical} onChange={toggleHypothetical} />
            <Check label="Show category breakdown" checked={breakdown} onChange={setBreakdown} />
          </div>

          {hypothetical && (
            <div style={{ fontSize: 14, color: 'var(--color-body)', marginBottom: 16 }}>
              Edit any score below — the grade recomputes instantly, right in your browser.
              Nothing is saved or sent anywhere.
            </div>
          )}

          {/* category breakdown — computed by src/calc from the (possibly edited) scores */}
          {breakdown && (
            <div
              style={{
                marginBottom: 28,
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline-strong)',
                borderRadius: 'var(--radius-xl)',
                padding: '16px 24px',
                overflowX: 'auto',
              }}
            >
              {categories ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, color: 'var(--color-ink)' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 13 }}>
                      <th style={{ padding: '6px 12px 10px 0', fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '6px 12px 10px 0', fontWeight: 600 }}>Weight</th>
                      <th style={{ padding: '6px 12px 10px 0', fontWeight: 600 }}>Points</th>
                      <th style={{ padding: '6px 0 10px 0', fontWeight: 600 }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const pts = pointsByCategory(effective).get(cat.name);
                      const hasPoints = pts && pts.pointsPossible > 0;
                      return (
                        <tr key={cat.name} style={{ borderTop: '1px solid var(--color-hairline)' }}>
                          <td style={{ padding: '10px 12px 10px 0', fontWeight: 600 }}>{cat.name}</td>
                          <td style={{ padding: '10px 12px 10px 0' }}>{fmt2(cat.weightPercentage)}%</td>
                          <td style={{ padding: '10px 12px 10px 0' }}>
                            {pts ? `${fmt2(pts.pointsEarned)}/${fmt2(pts.pointsPossible)}` : '—'}
                          </td>
                          <td style={{ padding: '10px 0' }}>
                            {hasPoints ? (
                              <span style={{ color: bandColor((pts.pointsEarned / pts.pointsPossible) * 100), fontWeight: 600 }}>
                                {fmt2((pts.pointsEarned / pts.pointsPossible) * 100)}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-muted)' }}>no graded work yet</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: 14, color: 'var(--color-body)' }}>
                  This class is graded on straight point totals — there are no weighted categories.
                </div>
              )}
            </div>
          )}

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

          {/* assignment list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                No assignments yet.
              </div>
            )}
            {visible.map((a, i) => {
              const raw = a.raw;
              const eff = raw ? override(raw) : null;
              const impact = raw ? impactById.get(raw.id) : undefined;
              const effPct =
                eff && eff.pointsEarned !== undefined && eff.pointsPossible
                  ? Math.round((eff.pointsEarned / eff.pointsPossible) * 1000) / 10
                  : null;
              const pct = hypothetical ? effPct : a.pct;
              const editable = hypothetical && raw && !a.notForGrade;
              const edit = (raw && edits[raw.id]) || {};
              return (
              <div
                key={`${a.title}-${i}`}
                style={{
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
                }}
              >
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
                    {impact !== undefined && (
                      <span title="How much this assignment moved the class grade" style={{ fontSize: 15, fontWeight: 600, color: impact < -0.005 ? 'var(--color-grade-bad)' : 'var(--color-muted)' }}>
                        {signed(impact)}
                      </span>
                    )}
                    {!editable && a.scaledScore && <span style={{ fontSize: 15, color: 'var(--color-muted)' }}>{a.scaledScore}</span>}
                    {editable ? (
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
                    ) : (
                      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)' }}>{a.score}</span>
                    )}
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', minWidth: 64, textAlign: 'right' }}>
                      {pct != null ? `${pct}%` : '—'}
                    </span>
                  </div>
                  <div style={{ width: '58.333%', alignSelf: 'flex-end', height: 8, borderRadius: 'var(--radius-pill)', background: 'var(--color-surface-dark-elevated)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct != null ? Math.min(pct, 100) : 0}%`, height: '100%', background: bandColor(pct ?? 0), borderRadius: 'var(--radius-pill)' }} />
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

export default ClassDetail;
