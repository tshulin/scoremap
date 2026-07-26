/**
 * Sidebar — shared logged-in left nav (Grades + class list, Attendance,
 * Documents, Mail, privacy note, Feedback, profile). Self-navigating: it reads
 * the current route to highlight the active item and routes on click, so pages
 * just render <Sidebar /> with no props.
 *
 * Design-system note: the reference has an icon per item; Grademax ships no
 * icon set (see design-system readme "Iconography"), so items are text-only.
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClasses, useSession, useSignOut } from '../data/SyncProvider.jsx';
import { SunIcon, MoonIcon, LogOutIcon } from '../lib/icons.jsx';

function Sidebar() {
  const classes = useClasses();
  const session = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [menuOpen, setMenuOpen] = React.useState(false);
  const [theme, setTheme] = React.useState(
    () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'dark',
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('grademax-theme', next);
    } catch (e) {
      /* ignore */
    }
    setTheme(next);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  };

  function MenuRow({ icon, label, onClick }) {
    const [hov, setHov] = React.useState(false);
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        role="menuitem"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '9px 10px',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: hov ? 'var(--color-hairline)' : 'transparent',
          color: 'var(--color-ink)',
          fontFamily: 'var(--font-sans)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--color-body)' }}>{icon}</span>
        {label}
      </button>
    );
  }

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
        onClick={() => navigate('/privacy')}
        style={{
          width: '100%',
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 14px',
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--color-muted)',
          margin: '16px 0',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        Your password and grades are private and stored on-device.
      </button>

      <NavItem label="Feedback" />
      <div style={{ position: 'relative', marginTop: 4 }}>
        {menuOpen && (
          <>
            {/* click-away overlay */}
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <div
              role="menu"
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                left: 8,
                right: 8,
                zIndex: 41,
                background: 'var(--color-surface-dark-elevated)',
                border: '1px solid var(--color-hairline-strong)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-soft-drop)',
                padding: 6,
              }}
            >
              <MenuRow
                icon={theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                onClick={toggleTheme}
              />
              <MenuRow icon={<LogOutIcon size={16} />} label="Log Out" onClick={handleLogout} />
            </div>
          </>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderTop: '1px solid var(--color-hairline)',
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-ink)' }}>{session.studentName}</span>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '2px 6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ⋮
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
