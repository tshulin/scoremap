/**
 * Attendance - month calendar + list view (route: /attendance).
 *
 * Records come from the backend's /api/attendance via the sync layer. Each
 * record: { date, status, note, reason, periods: [{ period, reason, note }] }.
 * `unreadableAbsences` counts rows the backend parser could not read - shown as
 * a warning so a short list is never mistaken for a complete one.
 *
 * Two views, toggled by a segmented control:
 *   • Calendar - the selected month, navigable forward/back; days with records
 *     are marked with a status-colored chip. Legend below.
 *   • List - every record, newest first (like the old GradeCompass view), each
 *     row expandable to the affected periods.
 */
import React, { useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { useAttendance, useClasses, useSyncMeta } from '../data/SyncProvider.jsx';
import { courseDisplayName, useCourseNameOverrides } from '../data/courseNameOverrides.js';

// StudentVUE status bands → design-system band colors.
const STATUS = {
  excused: { label: 'Excused', color: 'var(--color-grade-good)', bg: 'var(--color-tint-good)' },
  tardy: { label: 'Tardy', color: 'var(--color-grade-mid)', bg: 'var(--color-tint-mid)' },
  unexcused: { label: 'Unexcused', color: 'var(--color-grade-bad)', bg: 'var(--color-tint-bad)' },
  activity: { label: 'Activity', color: 'var(--color-text-link)', bg: 'var(--color-tint-accent)' },
};
const statusMeta = (s) => STATUS[s] || { label: s, color: 'var(--color-muted)', bg: 'var(--color-surface-strong)' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-based
const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const longDate = (iso) =>
  parseISO(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

function StatusBadge({ status }) {
  const m = statusMeta(status);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.2,
        background: m.bg,
        color: m.color,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

function Attendance() {
  const now = new Date();

  const { records, unreadableAbsences } = useAttendance();
  const meta = useSyncMeta();
  const classes = useClasses();
  const { overrides: courseNameOverrides } = useCourseNameOverrides();

  const [view, setView] = useState('calendar');
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [expanded, setExpanded] = useState({});

  // Period number → class name, from the synced gradebook (empty out of term).
  const periodClass = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.periodNum, courseDisplayName(c, courseNameOverrides)])),
    [classes, courseNameOverrides],
  );

  const byDate = useMemo(() => {
    const m = {};
    records.forEach((e) => {
      (m[e.date] = m[e.date] || []).push(e);
    });
    return m;
  }, [records]);
  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => setCursor(new Date(now.getFullYear(), now.getMonth(), 1));

  // ---- small UI bits ----
  function ViewTab({ id, label }) {
    const active = view === id;
    return (
      <button
        onClick={() => setView(id)}
        style={{
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
        {label}
      </button>
    );
  }

  function ArrowBtn({ dir, onClick }) {
    const [hov, setHov] = useState(false);
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        aria-label={dir === -1 ? 'Previous month' : 'Next month'}
        style={{
          width: 34,
          height: 34,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-hairline-strong)',
          background: hov ? 'var(--color-surface-dark-elevated)' : 'var(--color-surface-card)',
          color: 'var(--color-ink)',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        {dir === -1 ? '‹' : '›'}
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <SyncPill scope="attendance" />

          {(unreadableAbsences > 0 || meta.attendance.message) && (
            <div
              role="alert"
              className="gm-fade-in"
              style={{
                margin: '0 auto 24px',
                maxWidth: 640,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-tint-mid)',
                color: 'var(--color-grade-mid)',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {meta.attendance.message
                ? `Attendance could not be loaded: ${meta.attendance.message}`
                : `${unreadableAbsences} attendance ${unreadableAbsences === 1 ? 'record' : 'records'} could not be read. This list may be incomplete.`}
            </div>
          )}

          {/* header + view toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 4,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline-strong)',
              }}
            >
              <ViewTab id="calendar" label="Calendar" />
              <ViewTab id="list" label="List" />
            </div>
          </div>

          {view === 'calendar' ? (
            <div style={{ maxWidth: 940, margin: '0 auto' }}>
              {/* month navigation */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 16 }}>
                <ArrowBtn dir={-1} onClick={() => shiftMonth(-1)} />
                <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--color-ink)', minWidth: 190, textAlign: 'center' }}>
                  {MONTHS[month]} {year}
                </div>
                <ArrowBtn dir={1} onClick={() => shiftMonth(1)} />
                <button
                  onClick={goToday}
                  style={{
                    marginLeft: 4,
                    padding: '7px 14px',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid var(--color-hairline-strong)',
                    background: 'var(--color-surface-card)',
                    color: 'var(--color-body)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Today
                </button>
              </div>

              {/* weekday header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
                {WEEKDAYS.map((w) => (
                  <div key={w} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                    {w}
                  </div>
                ))}
              </div>

              {/* day grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gridAutoRows: 74, gap: 6 }}>
                {cells.map((day, i) => {
                  if (!day) return <div key={`e${i}`} />;
                  const iso = isoOf(year, month, day);
                  const events = byDate[iso] || [];
                  const isToday = iso === todayIso;
                  return (
                    <div
                      key={iso}
                      style={{
                        height: 74,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        padding: 6,
                        boxSizing: 'border-box',
                        borderRadius: 'var(--radius-md)',
                        border: `1px solid ${isToday ? 'var(--color-hairline-strong)' : 'var(--color-hairline)'}`,
                        background: events.length ? 'var(--color-surface-card)' : 'transparent',
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <span
                          style={
                            isToday
                              ? {
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 22,
                                  height: 22,
                                  borderRadius: 'var(--radius-full)',
                                  background: 'var(--color-ink)',
                                  color: 'var(--color-on-primary)',
                                  fontSize: 13,
                                  fontWeight: 700,
                                }
                              : { fontSize: 13, fontWeight: 500, color: 'var(--color-body)' }
                          }
                        >
                          {day}
                        </span>
                      </div>
                      {events.map((e, j) => {
                        const m = statusMeta(e.status);
                        return (
                          <div
                            key={j}
                            title={e.note || m.label}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              padding: '3px 7px',
                              borderRadius: 'var(--radius-sm)',
                              background: m.bg,
                              color: m.color,
                              fontSize: 11,
                              fontWeight: 600,
                              lineHeight: 1.3,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <span style={{ width: 6, height: 6, marginTop: 4, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                            <span style={{ minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                              {e.note || m.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {/* legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'center', marginTop: 20 }}>
                {Object.keys(STATUS).map((key) => {
                  const m = STATUS[key];
                  return (
                    <div key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-body)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.color }} />
                      {m.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* list view */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {sorted.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                  No attendance records.
                </div>
              )}
              {sorted.map((e, i) => {
                const open = !!expanded[i];
                return (
                  <div key={i} style={{ borderBottom: '1px solid var(--color-hairline)', padding: '18px 4px' }}>
                    <div
                      onClick={() => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }))}
                      role="button"
                      aria-expanded={open}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, cursor: 'pointer', userSelect: 'none' }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-ink)', lineHeight: 1.5 }}>
                        {longDate(e.date)}
                        {e.note ? `: ${e.note}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                        <StatusBadge status={e.status} />
                        <span
                          aria-hidden="true"
                          style={{
                            width: 28,
                            height: 28,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--color-muted)',
                            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {open && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(e.periods || []).length === 0 && (
                          <div style={{ fontSize: 15, color: 'var(--color-body)' }}>{e.reason || 'N/A'}</div>
                        )}
                        {(e.periods || []).map((p) => (
                          <div key={p.period} style={{ fontSize: 15, color: 'var(--color-body)' }}>
                            {periodClass[p.period] || `Period ${p.period}`}: {p.reason || 'N/A'}
                            {p.note ? `: ${p.note}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Attendance;
