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
  pointsByCategory,
} from '../calc/index';
import AssignmentList from './class/AssignmentList.jsx';
import GradeChart from './class/GradeChart.jsx';
import { Check, fmt2 } from './class/ui.jsx';
import { useScenario } from './class/useScenario.js';

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

  const [breakdown, setBreakdown] = React.useState(false);

  const anyCalculable = effective.some(isCalculable);
  const computedGrade = anyCalculable ? courseGrade(effective, categories) : null;
  const impactById = React.useMemo(
    () => new Map(assignmentImpacts(effective, categories).map((i) => [i.assignment.id, i.gradeImpact])),
    [effective, categories],
  );
  const series = React.useMemo(() => gradeSeries(effective, categories), [effective, categories]);
  const hiddenRows = React.useMemo(
    () => (categories ? hiddenPoints(categories, effective) : []),
    [categories, effective],
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

          {/* grade over time, derived from the effective assignments — edits
              and added hypotheticals visibly reshape the line */}
          <GradeChart series={series} />

          {/* toggles (Pin chart deliberately omitted) */}
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 12 }}>
            <Check label="Hypothetical mode" checked={hypothetical} onChange={scenario.toggleHypothetical} />
            <Check label="Show category breakdown" checked={breakdown} onChange={setBreakdown} />
          </div>

          {hypothetical && (
            <div style={{ fontSize: 14, color: 'var(--color-body)', marginBottom: 16 }}>
              Edit any score or add assignments below — the grade recomputes instantly, right in
              your browser. Nothing is saved or sent anywhere.
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

          <AssignmentList
            assignments={ASSIGNMENTS}
            categories={categories}
            scenario={scenario}
            impactById={impactById}
            hiddenRows={hiddenRows}
          />
        </div>
      </main>
    </div>
  );
}

export default ClassDetail;
