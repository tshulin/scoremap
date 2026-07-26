/**
 * ClassDetail — one class's grade page (route: /grades/:classId): derived
 * grade-over-time chart, assignment list with hypothetical editing/adding,
 * and the category breakdown. A thin shell: all math lives in src/calc/,
 * scenario state in pages/class/useScenario, rendering in pages/class/.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { scoreBandColor as bandColor } from '../lib/grades.js';
import { useAssignments, useClass } from '../data/SyncProvider.jsx';
// The grade engine runs right here in the browser — the server only supplies
// the assignment data.
import {
  assignmentImpacts,
  courseGrade,
  gradeSeries,
  hiddenPoints,
  isCalculable,
  resolveLetter,
} from '../calc/index';
import { useGradeIndex } from '../data/gradeIndexStore.js';
import AssignmentList from './class/AssignmentList.jsx';
import BoundsDialog from './class/BoundsDialog.jsx';
import GradeChart from './class/GradeChart.jsx';
import GradeIndexTab from './class/GradeIndexTab.jsx';
import OverviewTab from './class/OverviewTab.jsx';
import TargetDialog from './class/TargetDialog.jsx';
import { Check, PillButton, fmt2 } from './class/ui.jsx';
import { useScenario } from './class/useScenario.js';

const TABS = [
  ['assignments', 'Assignments'],
  ['overview', 'Overview'],
  ['index', 'Grade index'],
];

function ClassDetail() {
  const { classId } = useParams();
  const cls = useClass(classId);
  const ASSIGNMENTS = useAssignments(classId);

  const CLASS_NAME = cls ? cls.name : 'Class';
  const GRADE = cls ? (cls.pct != null ? `${cls.grade} ${cls.pct}%` : '—') : '';
  const categories = cls ? cls.categories : undefined;

  const baseRaws = React.useMemo(() => ASSIGNMENTS.filter((a) => a.raw).map((a) => a.raw), [ASSIGNMENTS]);
  const scenario = useScenario(baseRaws);
  const { hypothetical, effective } = scenario;
  // Per-class letter scale: portal letters observed on sync, overridable.
  const { scale } = useGradeIndex(classId);

  // Sub-tab state is local — no routing changes.
  const [tab, setTab] = React.useState('assignments');
  const [targetOpen, setTargetOpen] = React.useState(false);
  const [boundsOpen, setBoundsOpen] = React.useState(false);

  const anyCalculable = effective.some(isCalculable);
  const computedGrade = anyCalculable ? courseGrade(effective, categories) : null;
  const impactById = React.useMemo(
    () => new Map(assignmentImpacts(effective, categories).map((i) => [i.assignment.id, i.gradeImpact])),
    [effective, categories],
  );
  const series = React.useMemo(() => gradeSeries(effective, categories), [effective, categories]);
  // Hidden points are a property of the synced data (portal category totals
  // vs. the assignments it listed) — computed from the real rows, never the
  // scenario, or every edit/added hypothetical would masquerade as a
  // portal discrepancy.
  const hiddenRows = React.useMemo(
    () => (categories ? hiddenPoints(categories, baseRaws) : []),
    [categories, baseRaws],
  );

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
                  {computedGrade != null
                    ? `${resolveLetter(computedGrade, scale)} ${fmt2(computedGrade)}%`
                    : '—'}
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

          {/* sub-tabs (Grade index joins in a later phase) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: 4, borderRadius: 'var(--radius-lg)', background: 'var(--color-surface-card)', border: '1px solid var(--color-hairline-strong)', marginBottom: 20 }}>
            {TABS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  fontWeight: 500,
                  background: tab === id ? 'var(--color-surface-dark-elevated)' : 'transparent',
                  color: tab === id ? 'var(--color-ink)' : 'var(--color-body)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'assignments' && (
            <>
              {/* grade over time, derived from the effective assignments — edits
                  and added hypotheticals visibly reshape the line */}
              <GradeChart series={series} />

              {/* toggles + calculators (Pin chart deliberately omitted) */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <Check label="Hypothetical mode" checked={hypothetical} onChange={scenario.toggleHypothetical} />
                {hypothetical && <PillButton onClick={scenario.reset}>↺ Reset</PillButton>}
                <PillButton onClick={() => setTargetOpen(true)}>🎯 Target calculator</PillButton>
                <PillButton onClick={() => setBoundsOpen(true)}>📐 Max / min grade</PillButton>
              </div>

              {hypothetical && (
                <div style={{ fontSize: 14, color: 'var(--color-body)', marginBottom: 16 }}>
                  Every assignment below is editable — score, category, date — and “+ New assignment”
                  drops in a blank one. The grade recomputes instantly, right in your browser; Reset
                  clears your changes. Nothing is saved or sent anywhere.
                </div>
              )}

              <AssignmentList
                assignments={ASSIGNMENTS}
                categories={categories}
                scenario={scenario}
                impactById={impactById}
                hiddenRows={hiddenRows}
              />
            </>
          )}

          {tab === 'overview' && (
            <OverviewTab
              assignments={effective}
              categories={categories}
              hiddenRows={hiddenRows}
              hypothetical={hypothetical}
            />
          )}

          {tab === 'index' && <GradeIndexTab classId={classId} />}

          {targetOpen && (
            <TargetDialog
              onClose={() => setTargetOpen(false)}
              effective={effective}
              categories={categories}
              scale={scale}
            />
          )}

          {boundsOpen && (
            <BoundsDialog
              onClose={() => setBoundsOpen(false)}
              baseAssignments={baseRaws}
              effective={effective}
              hypothetical={hypothetical}
              categories={categories}
              scale={scale}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default ClassDetail;
