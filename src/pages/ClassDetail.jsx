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
import GradeNumber from '../components/GradeNumber.jsx';
import { DeltaValue } from '../components/RefreshDelta.jsx';
import { useAssignments, useClass, useClasses, useSyncChanges } from '../data/SyncProvider.jsx';
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

// Header type: slightly compact (a step below the old 34px/36px) so the
// sticky blocks stay narrow and the assignment lane can run wider. Long
// names step down further, then ellipsize at the width cap.
const nameFontSize = (name) => (name.length > 24 ? 16 : name.length > 16 ? 20 : 'clamp(22px, 2.2vw, 28px)');
const GRADE_FONT = 'clamp(22px, 2.4vw, 30px)';

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

  // Sticky-header geometry. Both header blocks hug their own text (the name
  // block sizes to the course name, GradeCompass-style). The assignment lane,
  // however, is reserved against the WIDEST header block any of the student's
  // classes could need (hidden ghost spans below measure them all), so every
  // class page shows assignments at the same width; the live blocks only
  // widen it further in edge cases (e.g. the hypothetical sub-line).
  const classes = useClasses();
  const namePillRef = React.useRef(null);
  const gradePillRef = React.useRef(null);
  const ghostRef = React.useRef(null);
  const [pillMaxW, setPillMaxW] = React.useState(0);
  // Height of the course-name text (block minus its 8px paddings): the
  // switcher's grid cell reserves this much on top, so it sits exactly
  // where the old in-flow header put it (h1, then 10px, then switcher).
  const [nameH, setNameH] = React.useState(41);
  React.useLayoutEffect(() => {
    const measure = () => {
      const n = namePillRef.current ? namePillRef.current.getBoundingClientRect() : null;
      const live = Math.max(
        n ? n.width : 0,
        gradePillRef.current ? gradePillRef.current.getBoundingClientRect().width : 0,
      );
      // +10 so live NumberFlow rendering never edges past the ghost text;
      // capped at the name block's own 48% width limit.
      let reserved = 0;
      if (ghostRef.current) {
        for (const el of ghostRef.current.children) {
          reserved = Math.max(reserved, el.getBoundingClientRect().width + 10);
        }
        const main = ghostRef.current.closest('main');
        if (main) reserved = Math.min(reserved, main.clientWidth * 0.48);
      }
      setPillMaxW(Math.ceil(Math.max(live, reserved)));
      if (n) setNameH(Math.round(n.height - 16));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [namePillRef, gradePillRef, ghostRef].forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
  }, [classes]);

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
        {/* GradeCompass pinned header, copied from their class page: the
            name and grade blocks carry the PAGE background (bg-background),
            no border or shadow — invisible at rest, so the unscrolled page
            looks exactly like the plain-text header. On scroll the row pins
            flush to the top and content simply vanishes behind the
            page-colored blocks (rounded on the bottom corners only, like
            their rounded-br-xl / rounded-bl-xl). Each block hugs its own
            text, so the highlight is exactly as wide as the course name;
            negative side margins keep the text at the same position the
            bare header had while letting the background bleed past it. */}
        <div
          style={{
            position: 'sticky',
            // Pins 8px down so the blocks (pulled up 8px by their negative
            // top margin, putting the text where the padding-less header
            // used to sit) end up flush with the viewport top when stuck.
            top: 8,
            zIndex: 20,
            // Zero height: the blocks overflow this box, so the row pins
            // without reserving vertical space — the header band below sets
            // the flow height, exactly like the old TopBar grid.
            height: 0,
            overflow: 'visible',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            pointerEvents: 'none',
          }}
        >
          <div
            ref={namePillRef}
            style={{
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              maxWidth: '48%',
              marginTop: -8,
              marginLeft: -16,
              padding: '8px 16px',
              background: 'var(--color-canvas)',
              borderRadius: '0 0 var(--radius-lg) 0',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: nameFontSize(CLASS_NAME),
                fontWeight: 600,
                letterSpacing: '-0.7px',
                lineHeight: 1.2,
                color: 'var(--color-ink)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {CLASS_NAME}
            </h1>
          </div>
          <div
            ref={gradePillRef}
            style={{
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              marginTop: -8,
              marginRight: -16,
              padding: '8px 16px',
              background: 'var(--color-canvas)',
              borderRadius: '0 0 0 var(--radius-lg)',
              textAlign: 'right',
              whiteSpace: 'nowrap',
            }}
          >
            {hypothetical ? (
              <div>
                <div style={{ fontSize: GRADE_FONT, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)' }}>
                  {computedGrade != null
                    ? <GradeNumber prefix={`${resolveLetter(computedGrade, scale)} `} value={computedGrade} />
                    : '—'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  hypothetical · official: {GRADE || '—'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: GRADE_FONT, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)' }}>
                {cls && cls.pct != null ? <GradeNumber prefix={`${cls.grade} `} value={cls.pct} /> : GRADE}
              </div>
            )}
          </div>
        </div>

        {/* hidden ghosts: every class's name and grade at header type, so the
            lane can be reserved for the widest one (see measure() above) */}
        <div
          ref={ghostRef}
          aria-hidden="true"
          style={{ position: 'absolute', visibility: 'hidden', height: 0, overflow: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          {classes.map((c) => (
            <span
              key={`ghost-name-${c.id}`}
              style={{ display: 'inline-block', padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: nameFontSize(c.name), fontWeight: 600, letterSpacing: '-0.7px' }}
            >
              {c.name}
            </span>
          ))}
          {classes.map((c) => (
            <span
              key={`ghost-grade-${c.id}`}
              style={{ display: 'inline-block', padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: GRADE_FONT, fontWeight: 600, letterSpacing: '-0.5px' }}
            >
              {c.pct != null ? `${c.grade} ${c.pct}%` : '—'}
            </span>
          ))}
        </div>

        {/* header band, same grid as the old TopBar: the switcher (offset by
            the course name's height, as if the h1 were still above it) and
            SyncPill's in-flow spacer share one row, so everything below
            starts at the same height it did before the sticky header. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'start',
            columnGap: 24,
            marginBottom: 8,
          }}
        >
          <div style={{ minWidth: 0, justifySelf: 'start', paddingTop: nameH + 10 }}>
            {/* compact section switcher — scrolls away under the name block */}
            <nav
              aria-label="Class sections"
              style={{
                display: 'inline-flex',
                gap: 2,
                padding: 3,
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
          <SyncPill scope="gradebook" delta={deltaLine} avoid={namePillRef} />
          <div />
        </div>

        {tab === 'assignments' && (
          <>
            {/* grade over time, derived from the effective assignments — edits
                and added hypotheticals visibly reshape the line. The chart runs
                the full main width (GradeCompass-style); the cards below keep
                the readable cap. */}
            {/* keyed by class so switching classes remounts the chart and
                replays the left→right draw-in (refreshes replay it via the
                sync timestamp inside) */}
            <GradeChart
              key={classId}
              series={series}
              activeDates={activeDates}
              activeType={filter === 'All' ? null : filter}
            />

            {/* toggles hug the graph's edges: Hypothetical mode (and Reset)
                flush with its left edge, the calculators flush with its right
                (Pin chart deliberately omitted) */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <Check label="Hypothetical mode" checked={hypothetical} onChange={scenario.toggleHypothetical} />
                {hypothetical && <PillButton onClick={scenario.reset}>↺ Reset</PillButton>}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <PillButton onClick={() => setTargetOpen(true)}>Target calculator</PillButton>
                <PillButton onClick={() => setBoundsOpen(true)}>Max / min grade</PillButton>
              </div>
            </div>

            {/* centered lane no wider than the space between the sticky
                pills (small gap each side), so a card scrolling up is never
                covered by the name or grade pill */}
            <div
              style={{
                maxWidth: pillMaxW ? `max(360px, calc(100% - ${(pillMaxW + 12) * 2}px))` : 1160,
                margin: '0 auto',
              }}
            >
              <AssignmentList
                assignments={ASSIGNMENTS}
                categories={categories}
                scenario={scenario}
                impactById={impactById}
                hiddenRows={hiddenRows}
                filter={filter}
                onFilter={setFilter}
              />
            </div>
          </>
        )}

        {tab === 'overview' && (
          // keyed by class: switching classes remounts the tab (replaying the
          // chart draw-in) and drops the previous class's what-if overrides
          <OverviewTab
            key={classId}
            assignments={effective}
            categories={categories}
            hiddenRows={hiddenRows}
          />
        )}

        {tab === 'index' && (
          <div style={{ maxWidth: 1160, margin: '0 auto' }}>
            <GradeIndexTab classId={classId} />
          </div>
        )}

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
      </main>
    </div>
  );
}

export default ClassDetail;
