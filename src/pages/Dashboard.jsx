/**
 * Dashboard — logged-in "Grades" overview (route: /dashboard).
 *
 * Recreates the reference dashboard (left sidebar + full-width class rows with
 * grade + progress bar) in the Grademax design system. Built from DS tokens;
 * the sidebar/rows are page-local layout (no cataloged DS shell yet).
 *
 * Design-system note: the reference has an icon per nav item and per row chip.
 * Grademax has no icon set (see design-system readme "Iconography"), so nav
 * items are text-only and chips use text. Wire in Lucide/Heroicons here once an
 * icon set is attached.
 *
 * Loaded via <script type="text/babel" src>, so it attaches to
 * `window.DashboardPage`. Under a bundler, replace that line with
 * `export default DashboardPage` and import the DS components.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../lib/ds.js';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { useClasses, useSession, useSyncMeta, useSyncStatus } from '../data/SyncProvider.jsx';
import { gradeBandColor } from '../lib/grades.js';

function DashboardPage() {
  const navigate = useNavigate();
  const classes = useClasses();
  const session = useSession();
  const meta = useSyncMeta();
  const { status } = useSyncStatus();
  const totalNew = classes.reduce((n, c) => n + (c.isNew || 0), 0);
  const [hovered, setHovered] = React.useState(null);

  // ---- small building blocks ----
  function Chip({ children, tone = 'neutral' }) {
    const tones = {
      neutral: { background: 'var(--color-surface-strong)', border: '1px solid var(--color-hairline)', color: 'var(--color-body)' },
      new: { background: 'rgba(0, 201, 80, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-good)', fontWeight: 600 },
    };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          lineHeight: 1.2,
          ...tones[tone],
        }}
      >
        {children}
      </span>
    );
  }

  function ProgressBar({ pct, color }) {
    return (
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-surface-dark-elevated)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 'var(--radius-pill)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      {/* ---------- Sidebar ---------- */}
      <Sidebar />

      {/* ---------- Main ---------- */}
      <main style={{ flex: 1, padding: '32px 40px 48px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <SyncPill />

          {/* semester selector */}
          {session.semester && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <Button variant="secondary" size="sm">
                {session.semester} <span aria-hidden="true" style={{ opacity: 0.7 }}>⌄</span>
              </Button>
            </div>
          )}

          {/* class rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {classes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                {status === 'syncing'
                  ? 'Syncing your gradebook…'
                  : meta.gradebook.message || 'No grades available yet.'}
              </div>
            )}
            {classes.map((c) => {
              const color = gradeBandColor(c.grade);
              const hov = hovered === c.name;
              const periodNum = c.period.replace(/[^0-9]/g, '');
              return (
                <div
                  key={c.name}
                  onClick={() => { navigate(`/grades/${c.id}`); }}
                  onMouseEnter={() => setHovered(c.name)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 28,
                    flexWrap: 'wrap',
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline-strong)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '14px 24px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    boxShadow: hov ? 'var(--shadow-soft-drop)' : 'none',
                    transition: 'box-shadow 150ms ease',
                  }}
                >
                  <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        flexShrink: 0,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--color-surface-dark-elevated)',
                        border: '1px solid var(--color-hairline-strong)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontWeight: 600,
                        color: 'var(--color-ink)',
                      }}
                    >
                      {periodNum}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.3px', color: 'var(--color-ink)', marginBottom: 4 }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--color-body)' }}>
                        {c.teacher} <span style={{ color: 'var(--color-muted)' }}>·</span> {c.room}
                      </div>
                    </div>
                  </div>

                  <div style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 16, minWidth: 220 }}>
                    <div style={{ width: 150, flexShrink: 0, textAlign: 'right', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px', color: 'var(--color-ink)', whiteSpace: 'nowrap' }}>
                      {c.pct != null ? `${c.grade} ${c.pct}%` : '—'}
                    </div>
                    <ProgressBar pct={c.pct ?? 0} color={color} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* new assignments summary */}
          {totalNew > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 20,
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px 20px',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-ink)' }}>{totalNew} new assignments</span>
                <Button variant="secondary" size="sm">Mark as seen</Button>
              </div>
            </div>
          )}

          {/* footer */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40, fontSize: 14, color: 'var(--color-body)' }}>
            <a href="#">Report an issue</a>
            <span style={{ color: 'var(--color-muted)' }}>·</span>
            <a href="#">Suggest a feature</a>
            <span style={{ color: 'var(--color-muted)' }}>·</span>
            <a href="#">Provide feedback</a>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--color-muted)' }}>
            Grademax is not affiliated with or endorsed by Edupoint Educational Systems LLC.
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
