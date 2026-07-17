/**
 * Documents — the student's document center (route: /documents).
 *
 * FRONTEND ONLY. DOCUMENTS below is local placeholder data matching the shape a
 * StudentVUE pull produces (title, category, date, and eventually a download
 * url). The backend will supply the real list + the per-document link later —
 * swap DOCUMENTS and wire `openDoc` to the real url then.
 *
 * A segmented filter (All / Transcript / Report Card / MAP Growth Family Report)
 * narrows the list; the category badge is shown only in "All" (redundant once a
 * single category is selected).
 */
import React, { useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';

// --- placeholder data (backend/StudentVUE will replace this) ---
const DOCUMENTS = [
  { id: 'd1', title: '25-26 Q4 Progress Report FHS', category: 'Report Card', date: '2026-05-04' },
  { id: 'd2', title: '25-26 Q3 Report Card FHS', category: 'Report Card', date: '2026-03-24' },
  { id: 'd3', title: '25-26 Q3 Progress Report', category: 'Report Card', date: '2026-02-17' },
  { id: 'd4', title: '25-26 S1 Transcript - 1-22-2026', category: 'Transcript', date: '2026-01-22' },
  { id: 'd5', title: '25-26 S1 Transcript dtd 1-16-2026 Madabhavi, Shali', category: 'Transcript', date: '2026-01-16' },
  { id: 'd6', title: '25-26 S1 Report Card', category: 'Report Card', date: '2026-01-13' },
  { id: 'd7', title: '25-26 Q2 Progress Report', category: 'Report Card', date: '2025-11-17' },
  { id: 'd8', title: '25-26 Transcript dtd 10-31-2025', category: 'Transcript', date: '2025-10-31' },
  { id: 'd9', title: '24-25 S2 Transcript dtd 6-16-2025', category: 'Transcript', date: '2025-06-16' },
  { id: 'd10', title: '24-25 Transcript dtd 5-1-2025', category: 'Transcript', date: '2025-05-01' },
  { id: 'd11', title: '24-25 Transcript 1-16-2025', category: 'Transcript', date: '2025-01-16' },
  { id: 'd12', title: '2023-2024 Spring MAP Family Report', category: 'MAP Growth Family Report', date: '2024-06-07' },
  { id: 'd13', title: '2023-2024 Winter MAP Family Report', category: 'MAP Growth Family Report', date: '2024-02-08' },
  { id: 'd14', title: '2023-2024 Fall MAP Family Report', category: 'MAP Growth Family Report', date: '2023-09-15' },
  { id: 'd15', title: '22-23 Fall MAP Family Report', category: 'MAP Growth Family Report', date: '2022-09-15' },
];

// Category → band color + subtle chip background (matches the filter dots).
const CATEGORY = {
  Transcript: { color: 'var(--color-grade-bad)', bg: 'rgba(251, 44, 54, 0.14)' },
  'Report Card': { color: 'var(--color-grade-mid)', bg: 'rgba(240, 177, 0, 0.14)' },
  'MAP Growth Family Report': { color: 'var(--color-text-link)', bg: 'rgba(77, 168, 255, 0.14)' },
};

const FILTERS = ['All', 'Transcript', 'Report Card', 'MAP Growth Family Report'];

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

function Documents() {
  const [filter, setFilter] = useState('All');
  const [hovered, setHovered] = useState(null);

  const visible = DOCUMENTS
    .filter((d) => filter === 'All' || d.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Opening a document is a backend concern (needs the real url) — placeholder.
  const openDoc = (doc) => {
    if (doc.url) window.open(doc.url, '_blank', 'noopener');
  };

  function FilterTab({ id, dot }) {
    const active = filter === id;
    return (
      <button
        onClick={() => setFilter(id)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 15,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          background: active ? 'var(--color-surface-dark-elevated)' : 'transparent',
          color: active ? 'var(--color-ink)' : 'var(--color-body)',
        }}
      >
        {dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />}
        {id}
      </button>
    );
  }

  function Chip({ children, tone }) {
    const style = tone
      ? { background: tone.bg, color: tone.color, border: '1px solid transparent' }
      : { background: 'var(--color-surface-strong)', color: 'var(--color-body)', border: '1px solid var(--color-hairline)' };
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: '4px 10px',
          borderRadius: 'var(--radius-sm)',
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          ...style,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-hairline-strong)',
                background: 'var(--color-surface-card)',
                fontSize: 13,
                color: 'var(--color-body)',
              }}
            >
              <span>Last updated last month</span>
              <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden="true">↻</span> Refresh
              </a>
            </div>
          </div>

          {/* category filter */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: 4,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline-strong)',
                maxWidth: '100%',
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <FilterTab id="All" />
              <FilterTab id="Transcript" dot="var(--color-grade-bad)" />
              <FilterTab id="Report Card" dot="var(--color-grade-mid)" />
              <FilterTab id="MAP Growth Family Report" dot="var(--color-text-link)" />
            </div>
          </div>

          {/* document list — narrower than the full content width */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
            {visible.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                No documents.
              </div>
            )}
            {visible.map((doc) => {
              const hov = hovered === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => openDoc(doc)}
                  onMouseEnter={() => setHovered(doc.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline-strong)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px 24px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    boxShadow: hov ? 'var(--shadow-soft-drop)' : 'none',
                    transition: 'box-shadow 150ms ease',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10, letterSpacing: '-0.2px' }}>
                    {doc.title}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {filter === 'All' && <Chip tone={CATEGORY[doc.category]}>{doc.category}</Chip>}
                    <Chip>{fmtDate(doc.date)}</Chip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Documents;
