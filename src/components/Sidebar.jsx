/**
 * Sidebar — shared logged-in left nav (Grades + class list, Attendance,
 * Documents, Mail, privacy note, Feedback, profile). Self-navigating: it reads
 * the current route to highlight the active item and routes on click, so pages
 * just render <Sidebar /> with no props.
 *
 * Design-system note: the reference has an icon per item; Scoremap ships no
 * icon set (see design-system readme "Iconography"), so items are text-only.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClasses, useSession, useSignOut } from '../data/SyncProvider.jsx';
import { SunIcon, MoonIcon, LogOutIcon } from '../lib/icons.jsx';
import PrivacyDialog from './PrivacyDialog.jsx';

// Module-level (not inside Sidebar): a component defined inside the render
// function gets a new identity every render, so React remounts its DOM node —
// which kills in-flight CSS transitions (the sun/moon rotate swap) and resets
// the gm-press-pop click feedback.
function IconButton({ label, onClick, className, onAnimationEnd, children }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={className}
      onAnimationEnd={onAnimationEnd}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        flexShrink: 0,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: hov ? 'var(--color-hairline)' : 'transparent',
        color: 'var(--color-body)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Sidebar() {
  const classes = useClasses();
  const session = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  // True while the theme button plays its click-feedback pop (gm-press-pop);
  // cleared on animationend so every click re-triggers it.
  const [themePop, setThemePop] = React.useState(false);
  const [theme, setTheme] = React.useState(
    () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark',
  );

  const toggleTheme = () => {
    setThemePop(true);
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('grademax-theme', next);
    } catch (e) {
      /* ignore */
    }
    setTheme(next);
  };

  // Sun and moon stacked; the active one rotates in while the other rotates
  // out — the reference app's dark-toggle icon animation.
  const themeIcon = (
    <span style={{ position: 'relative', display: 'inline-flex', width: 16, height: 16 }}>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'inline-flex',
          transition: 'transform 300ms ease, opacity 300ms ease',
          transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
          opacity: theme === 'dark' ? 1 : 0,
        }}
      >
        <SunIcon size={16} />
      </span>
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'inline-flex',
          transition: 'transform 300ms ease, opacity 300ms ease',
          transform: theme === 'dark' ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
          opacity: theme === 'dark' ? 0 : 1,
        }}
      >
        <MoonIcon size={16} />
      </span>
    </span>
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Derive the active section + class straight from the URL.
  let section = 'grades';
  let activeClassId = null;
  if (pathname.startsWith('/attendance')) section = 'attendance';
  else if (pathname.startsWith('/documents')) section = 'documents';
  else if (pathname.startsWith('/gpa-calculator')) section = 'gpa-calculator';
  else if (pathname.startsWith('/mail')) section = 'mail';
  else if (pathname.startsWith('/grades/')) activeClassId = decodeURIComponent(pathname.split('/')[2] || '');

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
          background: active ? 'var(--color-nav-active)' : 'transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        background: 'var(--color-surface-sidebar)',
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
        Scoremap
      </div>

      <nav style={{ flex: 1, overflowY: 'auto' }}>
        <NavItem label="Grades" active={section === 'grades' && !activeClassId} onClick={() => navigate('/dashboard')} />
        {classes.map((c) => (
          <NavItem key={c.id} label={c.name} sub active={activeClassId === c.id} onClick={() => navigate(`/grades/${c.id}`)} />
        ))}
        <div style={{ height: 12 }} />
        <NavItem label="Attendance" active={section === 'attendance'} onClick={() => navigate('/attendance')} />
        <NavItem label="Documents" active={section === 'documents'} onClick={() => navigate('/documents')} />
        <NavItem label="Mail" active={section === 'mail'} onClick={() => navigate('/mail')} />
        <NavItem label="GPA calculator" active={section === 'gpa-calculator'} onClick={() => navigate('/gpa-calculator')} />
      </nav>

      <button
        type="button"
        onClick={() => setPrivacyOpen(true)}
        style={{
          width: '100%',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--color-text-privacy)',
          margin: '16px 0',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        Your password, login info, and grades are only seen by StudentVUE and you.
      </button>

      <NavItem label="Feedback" />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '10px 8px 10px 12px',
          borderTop: '1px solid var(--color-hairline)',
          marginTop: 4,
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-ink)',
          }}
        >
          {session.studentName}
        </span>
        <IconButton
          label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className={themePop ? 'gm-press-pop' : undefined}
          onAnimationEnd={() => setThemePop(false)}
        >
          {themeIcon}
        </IconButton>
        <IconButton label="Log out" onClick={handleLogout}>
          <LogOutIcon size={16} />
        </IconButton>
      </div>

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </aside>
  );
}

export default Sidebar;
