/**
 * ClassDetail — one class's grade page (route: /grades/:classId): derived
 * grade-over-time chart, assignment list with hypothetical editing/adding,
 * and the category breakdown. A thin shell: all math lives in src/calc/,
 * scenario state in pages/class/useScenario, rendering in pages/class/.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import GradeNumber from '../components/GradeNumber.jsx';
import { DeltaValue } from '../components/RefreshDelta.jsx';
import { useAssignments, useClass, useSyncChanges } from '../data/SyncProvider.jsx';
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
  // Category filter lives here so the chart can follow it too.
  const [filter, setFilter] = React.useState('All');
  React.useEffect(() => setFilter('All'), [classId]);

  // Hypothetical mode is scoped to the Assignments tab of one class: leaving
  // the tab (or the class) turns it off and discards the scenario, so
  // Overview/Grade index always show reality and a return lands clean.
  const { toggleHypothetical } = scenario;
  React.useEffect(() => {
    if (tab !== 'assignments') toggleHypothetical(false);
  }, [tab, toggleHypothetical]);
  React.useEffect(() => {
    toggleHypothetical(false);
  }, [classId, toggleHypothetical]);

  const { list: changedClasses } = useSyncChanges();
  const myChange = changedClasses.find((c) => c.id === classId);
  const deltaLine = myChange ? (
    <span>
      <DeltaValue delta={myChange.delta} /> from last refresh
    </span>
  ) : (
    'No change since last refresh'
  );

  const anyCalculable = effective.some(isCalculable);
  const computedGrade = anyCalculable ? courseGrade(effective, categories) : null;
  const impactById = React.useMemo(
    () => new Map(assignmentImpacts(effective, categories).map((i) => [i.assignment.id, i.gradeImpact])),
    [effective, categories],
  );
  const series = React.useMemo(() => gradeSeries(effective, categories), [effective, categories]);
  // Dates that have work in the filtered category — the chart keeps its line
  // but only these dates keep their dots.
  const activeDates = React.useMemo(() => {
    if (filter === 'All') return null;
    return new Set(
      effective
        .filter((a) => isCalculable(a) && (a.category || 'Uncategorized') === filter)
        .map((a) => a.date),
    );
  }, [filter, effective]);
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
          {/* top bar: class name · refresh pill (tabs beneath it) · grade */}
          <TopBar
            pillScope="gradebook"
            pillDelta={deltaLine}
            left={
              <div>
                <h1 style={{ margin: 0, fontSize: 'clamp(24px, 2.6vw, 34px)', fontWeight: 600, letterSpacing: '-0.7px', lineHeight: 1.2, color: 'var(--color-ink)' }}>
                  {CLASS_NAME}
                </h1>
                {/* compact section switcher, flush with the course name's left edge */}
                <nav
                  aria-label="Class sections"
                  style={{
                    display: 'inline-flex',
                    gap: 2,
                    padding: 3,
                    marginTop: 10,
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline-strong)',
                  }}
                >
                  {TABS.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setTab(id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 12,
                        fontWeight: 500,
                        background: tab === id ? 'var(--color-surface-dark-elevated)' : 'transparent',
                        color: tab === id ? 'var(--color-ink)' : 'var(--color-text-meta)',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
            }
            right={
              hypothetical ? (
                <div style={{ whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)' }}>
                    {computedGrade != null
                      ? <GradeNumber prefix={`${resolveLetter(computedGrade, scale)} `} value={computedGrade} />
                      : '—'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                    hypothetical · official: {GRADE || '—'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 'clamp(24px, 2.8vw, 36px)', fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                  {cls && cls.pct != null ? <GradeNumber prefix={`${cls.grade} `} value={cls.pct} /> : GRADE}
                </div>
              )
            }
          />

          {tab === 'assignments' && (
            <>
              {/* grade over time, derived from the effective assignments — edits
                  and added hypotheticals visibly reshape the line */}
              <GradeChart
                series={series}
                activeDates={activeDates}
                activeType={filter === 'All' ? null : filter}
              />

              {/* toggles left, calculators right (Pin chart deliberately omitted) */}
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Check label="Hypothetical mode" checked={hypothetical} onChange={scenario.toggleHypothetical} />
                  {hypothetical && <PillButton onClick={scenario.reset}>↺ Reset</PillButton>}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <PillButton onClick={() => setTargetOpen(true)}>🎯 Target calculator</PillButton>
                  <PillButton onClick={() => setBoundsOpen(true)}>📐 Max / min grade</PillButton>
                </div>
              </div>

              <AssignmentList
                assignments={ASSIGNMENTS}
                categories={categories}
                scenario={scenario}
                impactById={impactById}
                hiddenRows={hiddenRows}
                filter={filter}
                onFilter={setFilter}
              />
            </>
          )}

          {tab === 'overview' && (
            <OverviewTab
              assignments={effective}
              categories={categories}
              hiddenRows={hiddenRows}
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
