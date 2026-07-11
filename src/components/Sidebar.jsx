/**
 * Sidebar — shared logged-in left nav (Grades + class list, Attendance,
 * Documents, Mail, privacy note, Feedback, profile). Used by Dashboard and
 * ClassDetail so the chrome stays identical across the app.
 *
 * Props:
 *   activeClass — class name to highlight in the nav (optional)
 *   onClass(name) / onGrades() — navigation callbacks (optional; default to
 *     static POC harness files)
 *
 * Design-system note: the reference has an icon per item; Grademax ships no
 * icon set (see design-system readme "Iconography"), so items are text-only.
 *
 * Attaches to window.Sidebar. Under a bundler: export default Sidebar.
 */
import React from 'react';
import { useClasses, useSession } from '../data/SyncProvider.jsx';

function Sidebar({ activeId = null, onClass, onGrades }) {
  const classes = useClasses();
  const session = useSession();
  function NavItem({ label, active, sub, onClick }) {
    const [hov, setHov] = React.useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          fontSize: sub ? 14 : 15,
          fontWeight: active ? 600 : 500,
          padding: sub ? '7px 12px 7px 24px' : '9px 12px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 2,
          cursor: 'pointer',
          color: active || hov ? 'var(--color-ink)' : 'var(--color-body)',
          background: active ? 'var(--color-surface-strong)' : 'transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
    );
  }

  const goClass = (id) => () => { if (onClass) onClass(id); };
  const goGrades = () => { if (onGrades) onGrades(); };

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--color-hairline)',
        padding: '24px 16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)', padding: '0 12px', marginBottom: 24 }}>
        Grademax
      </div>

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        <NavItem label="Grades" active={!activeId} onClick={goGrades} />
        {classes.map((c) => (
          <NavItem key={c.id} label={c.name} sub active={activeId === c.id} onClick={goClass(c.id)} />
        ))}
        <div style={{ height: 12 }} />
        <NavItem label="Attendance" />
        <NavItem label="Documents" />
        <NavItem label="Mail" />
      </nav>

      <div
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--color-muted)',
          margin: '16px 0',
        }}
      >
        Your password and grades are private.
      </div>

      <NavItem label="Feedback" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          marginTop: 4,
          borderTop: '1px solid var(--color-hairline)',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{session.studentName}</span>
        <span aria-hidden="true" style={{ color: 'var(--color-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>⋮</span>
      </div>
    </aside>
  );
}

export default Sidebar;
