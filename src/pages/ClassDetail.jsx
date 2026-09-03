/**
 * ClassDetail - one class's grade page (route: /grades/:classId): derived
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
// The grade engine runs right here in the browser - the server only supplies
// the assignment data.
import {
  assignmentImpacts,
  courseGrade,
  gradeSeries,
  hiddenPoints,
  isCalculable,
  resolveLetter,
  withHiddenAssignments,
} from '../calc/index';
import { useGradeIndex } from '../data/gradeIndexStore.js';
import { useProfilePreferences } from '../data/profilePreferences.js';
import { courseDisplayName, useCourseNameOverrides } from '../data/courseNameOverrides.js';
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
// sticky blocks stay narrow and the assignment lane can run wider.
const NAME_FONT = 'clamp(22px, 2.2vw, 28px)';
const GRADE_FONT = 'clamp(22px, 2.4vw, 30px)';
// A too-long course name scales down only as far as this fraction of full
// size; past that it ellipsizes instead of shrinking further.
const NAME_SCALE_MIN = 0.6;

function ClassDetail() {
  const { classId } = useParams();
  const cls = useClass(classId);
  const ASSIGNMENTS = useAssignments(classId);
  const { overrides: courseNameOverrides } = useCourseNameOverrides();

  const CLASS_NAME = cls ? courseDisplayName(cls, courseNameOverrides) : 'Class';
  const GRADE = cls ? (cls.pct != null ? `${cls.grade} ${cls.pct}%` : 'N/A') : '';
  const categories = cls ? cls.categories : undefined;

  const baseRaws = React.useMemo(() => ASSIGNMENTS.filter((a) => a.raw).map((a) => a.raw), [ASSIGNMENTS]);
  // Stored category totals are authoritative - they include assignments
  // it hides from the list. Reconciling them into the working set keeps the
  // computed grade, chart, impacts, and calculators on the official numbers
  // instead of renormalizing over only the visible work.
  const baseWithHidden = React.useMemo(
    () => withHiddenAssignments(baseRaws, categories),
    [baseRaws, categories],
  );
  const scenario = useScenario(baseWithHidden);
  const { hypothetical, effective } = scenario;
  // Per-class letter scale: stored letters observed on load, overridable.
  const { scale } = useGradeIndex(classId);
  const { preferences } = useProfilePreferences();

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
  // Height of a FULL-SIZE course-name line, measured from the ghosts (never
  // the live h1): the switcher's grid cell reserves this much on top, so the
  // switcher stays at the same place even when a long name's font has to
  // scale down to fit.
  const [nameH, setNameH] = React.useState(34);
  // How much the current course name must shrink to fit the block's width
  // cap - 1 when it fits at full size, and only ever the exact ratio needed
  // (never below NAME_SCALE_MIN; ellipsis takes over past that).
  const [nameScale, setNameScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const measure = () => {
      const live = Math.max(
        namePillRef.current ? namePillRef.current.getBoundingClientRect().width : 0,
        gradePillRef.current ? gradePillRef.current.getBoundingClientRect().width : 0,
      );
      // +10 so live NumberFlow rendering never edges past the ghost text;
      // everything capped at the name block's own 48% width limit (of the
      // main content box, matching the block's CSS maxWidth).
      let reserved = 0;
      if (ghostRef.current) {
        const main = ghostRef.current.closest('main');
        const mainStyle = main ? getComputedStyle(main) : null;
        const contentW = main
          ? main.clientWidth - parseFloat(mainStyle.paddingLeft) - parseFloat(mainStyle.paddingRight)
          : 0;
        const cap = contentW ? contentW * 0.48 : Infinity;
        const ghosts = ghostRef.current.children;
        for (const el of ghosts) {
          reserved = Math.max(reserved, Math.min(el.getBoundingClientRect().width + 10, cap));
        }
        // Name ghosts (all at full size) come first, one per class.
        if (ghosts.length > 0 && classes.length > 0) {
          setNameH(Math.round(ghosts[0].getBoundingClientRect().height));
          const i = classes.findIndex((c) => c.id === classId);
          if (i >= 0) {
            const textW = ghosts[i].getBoundingClientRect().width - 32;
            const availW = cap - 32;
            setNameScale(textW > availW ? Math.max(NAME_SCALE_MIN, availW / textW) : 1);
          }
        }
      }
      setPillMaxW(Math.ceil(Math.max(live, reserved)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    [namePillRef, gradePillRef, ghostRef].forEach((r) => r.current && ro.observe(r.current));
    return () => ro.disconnect();
  }, [classes, classId]);

  // Sub-tab state is local - no routing changes.
  const [tab, setTab] = React.useState('assignments');
  const [targetOpen, setTargetOpen] = React.useState(false);
  const [boundsOpen, setBoundsOpen] = React.useState(false);
  // Category filter lives here so the chart can follow it too.
  const [filter, setFilter] = React.useState('All');
  React.useEffect(() => setFilter('All'), [classId]);
  React.useEffect(() => {
    if (
      (!preferences.showGradeIndex && tab === 'index')
      || (!preferences.showOverview && tab === 'overview')
    ) {
      setTab('assignments');
    }
  }, [preferences.showGradeIndex, preferences.showOverview, tab]);

  const visibleTabs = TABS.filter(([id]) => (
    (id !== 'index' || preferences.showGradeIndex)
    && (id !== 'overview' || preferences.showOverview)
  ));

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
  // Dates that have work in the filtered category - the chart keeps its line
  // but only these dates keep their dots.
  const activeDates = React.useMemo(() => {
    if (filter === 'All') return null;
    return new Set(
      effective
        .filter((a) => isCalculable(a) && (a.category || 'Uncategorized') === filter)
        .map((a) => a.date),
    );
  }, [filter, effective]);
  // Hidden points are a property of the sample data (stored category totals
  // vs. the assignments it listed) - computed from the real rows, never the
  // scenario, or every edit/added hypothetical would masquerade as a
  // source discrepancy.
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
            no border or shadow - invisible at rest, so the unscrolled page
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
            // without reserving vertical space - the header band below sets
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
                fontSize: nameScale < 1 ? `calc(${NAME_FONT} * ${nameScale.toFixed(3)})` : NAME_FONT,
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
                    : 'N/A'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>
                  hypothetical · official: {GRADE || 'N/A'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: GRADE_FONT, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)' }}>
                {cls && cls.pct != null ? <GradeNumber prefix={`${cls.grade} `} value={cls.pct} /> : GRADE}
              </div>
            )}
          </div>
        </div>

        {/* hidden ghosts: every class's name (always at FULL size) and grade
            at header type. They reserve the lane for the widest class, anchor
            the switcher's fixed offset, and tell measure() how much the
            current name must scale to fit. */}
        <div
          ref={ghostRef}
          aria-hidden="true"
          style={{ position: 'absolute', visibility: 'hidden', height: 0, overflow: 'hidden', pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          {classes.map((c) => (
            <span
              key={`ghost-name-${c.id}`}
              style={{ display: 'inline-block', padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: NAME_FONT, fontWeight: 600, letterSpacing: '-0.7px', lineHeight: 1.2 }}
            >
              {courseDisplayName(c, courseNameOverrides)}
            </span>
          ))}
          {classes.map((c) => (
            <span
              key={`ghost-grade-${c.id}`}
              style={{ display: 'inline-block', padding: '0 16px', fontFamily: 'var(--font-sans)', fontSize: GRADE_FONT, fontWeight: 600, letterSpacing: '-0.5px' }}
            >
              {c.pct != null ? `${c.grade} ${c.pct}%` : 'N/A'}
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
            {/* compact section switcher - scrolls away under the name block */}
            {visibleTabs.length > 1 && (
              <nav
                aria-label="Class sections"
                style={{
                  display: 'inline-flex',
                  gap: 2,
                  padding: 3,
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                }}
              >
                {visibleTabs.map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
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
            )}
          </div>
          <SyncPill scope="gradebook" delta={deltaLine} avoid={namePillRef} />
          <div />
        </div>

        {tab === 'assignments' && (
          <>
            {/* grade over time, derived from the effective assignments - edits
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

            {cls && cls.categoriesUnreadable && (
              <div style={{ fontSize: 13, color: 'var(--color-grade-mid)', marginBottom: 12 }}>
                This sample class has category weights in an unreadable form, so everything
                computed here (hypotheticals, targets, the chart) uses straight point totals.
              </div>
            )}

            {/* toggles hug the graph's edges: Hypothetical mode (and Reset)
                flush with its left edge, the calculators flush with its right
                (Pin chart deliberately omitted) */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                <Check label="Hypothetical mode" checked={hypothetical} onChange={scenario.toggleHypothetical} />
                {hypothetical && (
                  <span className="gm-hypothetical-control-in" style={{ display: 'inline-flex' }}>
                    <PillButton onClick={scenario.reset}>↺ Reset</PillButton>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {preferences.showTargetCalculator && (
                  <PillButton onClick={() => setTargetOpen(true)}>Target calculator</PillButton>
                )}
                {preferences.showMaxMinGrade && (
                  <PillButton onClick={() => setBoundsOpen(true)}>Max/Min grade</PillButton>
                )}
              </div>
            </div>

            {/* Wider centered lane, close to the GradeCompass card proportions.
                It still responds to the sticky-header width on narrower screens. */}
            <div
              style={{
                width: '100%',
                maxWidth: pillMaxW
                  ? `min(1080px, max(720px, calc(100% - ${pillMaxW + 32}px)))`
                  : 1080,
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
            baseAssignments={baseWithHidden}
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
