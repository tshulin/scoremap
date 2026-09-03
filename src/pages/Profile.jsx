import React from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { useClasses, useSession } from '../data/SyncProvider.jsx';
import { courseDisplayName, useCourseNameOverrides } from '../data/courseNameOverrides.js';
import { useProfilePreferences } from '../data/profilePreferences.js';
import { displayCourseName } from '../lib/courseNames.js';
import { PersonIcon } from '../lib/icons.jsx';
import { Dialog } from './class/ui.jsx';

function FeatureToggle({ checked, description, label, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '16px 0',
        borderTop: '1px solid var(--color-hairline)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--color-ink)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px' }}>{label}</div>
        <div style={{ marginTop: 4, color: 'var(--color-body)', fontSize: 14, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 40,
          height: 24,
          flexShrink: 0,
          padding: 0,
          border: '1px solid var(--color-hairline-strong)',
          borderRadius: 'var(--radius-pill)',
          background: checked ? '#2d57d1' : 'var(--color-surface-strong)',
          cursor: 'pointer',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 19 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? '#fff' : 'var(--color-body)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.22)',
            transition: 'left 150ms ease, background 150ms ease',
          }}
        />
      </button>
    </div>
  );
}

export default function Profile() {
  const session = useSession();
  const classes = useClasses();
  const { preferences, setPreference } = useProfilePreferences();
  const { overrides: courseNameOverrides, renameCourse, resetCourseName } = useCourseNameOverrides();
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [selectedCourseId, setSelectedCourseId] = React.useState('');
  const [draftName, setDraftName] = React.useState('');
  const [renameError, setRenameError] = React.useState('');

  const selectedCourse = classes.find((course) => String(course.id) === selectedCourseId);
  const originalCourseName = selectedCourse ? displayCourseName(selectedCourse.name) : '';
  const hasCustomName = selectedCourse
    ? typeof courseNameOverrides[String(selectedCourse.id)] === 'string'
    : false;

  const selectCourse = (courseId) => {
    const course = classes.find((item) => String(item.id) === courseId);
    setSelectedCourseId(courseId);
    setDraftName(course ? courseDisplayName(course, courseNameOverrides) : '');
    setRenameError('');
  };

  const openRenameDialog = () => {
    const firstCourse = classes[0];
    const firstId = firstCourse ? String(firstCourse.id) : '';
    setSelectedCourseId(firstId);
    setDraftName(firstCourse ? courseDisplayName(firstCourse, courseNameOverrides) : '');
    setRenameError('');
    setRenameOpen(true);
  };

  const saveCourseName = (event) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!selectedCourse || !nextName) {
      setRenameError('Enter a name for the selected course.');
      return;
    }
    if (nextName === originalCourseName) resetCourseName(selectedCourse.id);
    else renameCourse(selectedCourse.id, nextName);
    setRenameOpen(false);
  };

  const restoreCourseName = () => {
    if (!selectedCourse) return;
    resetCourseName(selectedCourse.id);
    setRenameOpen(false);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '40px 36px 56px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
          <header style={{ marginBottom: 22 }}>
            <h1 style={{ margin: '0 0 6px', color: 'var(--color-ink)', fontSize: 27, fontWeight: 600, letterSpacing: '-0.6px' }}>
              Profile
            </h1>
            <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 15, lineHeight: 1.55 }}>
              Manage your Scoremap profile and preferences.
            </p>
          </header>

          <section
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: 20,
              marginBottom: 16,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--color-avatar-bg)',
                border: '1px solid var(--color-hairline-strong)',
                color: 'var(--color-body)',
              }}
            >
              <PersonIcon size={20} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', color: 'var(--color-ink)', fontSize: 18, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.studentName || 'Scoremap student'}
              </div>
              <div style={{ marginTop: 3, color: 'var(--color-body)', fontSize: 13 }}>
                Grade {session.grade || '—'}
              </div>
            </div>
          </section>

          <section
            style={{
              padding: '2px 20px',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ padding: '17px 0 13px' }}>
              <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px' }}>
                Feature preferences
              </h2>
              <p style={{ margin: '5px 0 0', color: 'var(--color-body)', fontSize: 14, lineHeight: 1.5 }}>
                Choose which tools appear on your class pages.
              </p>
            </div>
            <FeatureToggle
              label="Max/min grade"
              description="Show the Max/Min grade calculator button."
              checked={preferences.showMaxMinGrade}
              onChange={(value) => setPreference('showMaxMinGrade', value)}
            />
            <FeatureToggle
              label="Grade index"
              description="Show the Grade index tab."
              checked={preferences.showGradeIndex}
              onChange={(value) => setPreference('showGradeIndex', value)}
            />
            <FeatureToggle
              label="Overview tab"
              description="Show the Overview tab on class pages."
              checked={preferences.showOverview}
              onChange={(value) => setPreference('showOverview', value)}
            />
            <FeatureToggle
              label="Target calculator"
              description="Show the Target calculator button."
              checked={preferences.showTargetCalculator}
              onChange={(value) => setPreference('showTargetCalculator', value)}
            />
          </section>

          <section
            style={{
              marginTop: 16,
              padding: 20,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.2px' }}>
              Course names
            </h2>
            <p style={{ margin: '5px 0 16px', color: 'var(--color-body)', fontSize: 14, lineHeight: 1.5 }}>
              Use a custom name anywhere Scoremap displays a course.
            </p>
            <button
              type="button"
              onClick={openRenameDialog}
              disabled={classes.length === 0}
              style={{
                padding: '9px 14px',
                border: 0,
                borderRadius: 'var(--radius-md)',
                background: '#2d57d1',
                color: '#fff',
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                fontWeight: 600,
                cursor: classes.length ? 'pointer' : 'not-allowed',
                opacity: classes.length ? 1 : 0.55,
              }}
            >
              Rename a course
            </button>
          </section>
        </div>
      </main>

      {renameOpen && (
        <Dialog title="Rename a course" onClose={() => setRenameOpen(false)} maxWidth={480}>
          <form onSubmit={saveCourseName}>
            <label
              htmlFor="rename-course-select"
              style={{ display: 'block', marginBottom: 7, color: 'var(--color-ink)', fontSize: 14, fontWeight: 600 }}
            >
              Which course do you want to rename?
            </label>
            <select
              id="rename-course-select"
              value={selectedCourseId}
              onChange={(event) => selectCourse(event.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                marginBottom: 18,
                border: '1px solid var(--color-hairline-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-strong)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            >
              {classes.map((course) => (
                <option key={course.id} value={String(course.id)}>
                  {course.periodNum ? `Period ${course.periodNum} · ` : ''}{courseDisplayName(course, courseNameOverrides)}
                </option>
              ))}
            </select>

            <label
              htmlFor="rename-course-input"
              style={{ display: 'block', marginBottom: 7, color: 'var(--color-ink)', fontSize: 14, fontWeight: 600 }}
            >
              What do you want to call it?
            </label>
            <input
              id="rename-course-input"
              value={draftName}
              maxLength={80}
              onChange={(event) => {
                setDraftName(event.target.value);
                setRenameError('');
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--color-hairline-strong)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-surface-strong)',
                color: 'var(--color-ink)',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ minHeight: 20, marginTop: 6, color: 'var(--color-grade-bad)', fontSize: 13 }}>
              {renameError}
            </div>

            <p style={{ margin: '2px 0 18px', color: 'var(--color-muted)', fontSize: 13, lineHeight: 1.5 }}>
              This only changes the name shown in this local demo. The bundled course data is not changed.
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                {hasCustomName && (
                  <button
                    type="button"
                    onClick={restoreCourseName}
                    style={{
                      padding: '9px 12px',
                      border: '1px solid var(--color-hairline-strong)',
                      borderRadius: 'var(--radius-md)',
                      background: 'transparent',
                      color: 'var(--color-body)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Use original name
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setRenameOpen(false)}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--color-hairline-strong)',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--color-body)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 14px',
                    border: 0,
                    borderRadius: 'var(--radius-md)',
                    background: '#2d57d1',
                    color: '#fff',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save name
                </button>
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
