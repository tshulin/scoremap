/**
 * Documents — the student's document center (route: /documents).
 *
 * The list comes from the backend's /api/documents via the sync layer; clicking
 * a document fetches it through /api/documents/:docToken and opens it in the
 * browser's built-in viewer (auth headers prevent using a plain link).
 *
 * A segmented filter (one tab per category present) narrows the list; the
 * category badge is shown only in "All" (redundant once a single category is
 * selected).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { downloadDocument } from '../data/api.js';
import { useDocuments, useSyncMeta } from '../data/SyncProvider.jsx';

// Known category → band color + subtle chip background (matches the filter
// dots). Categories the portal sends that aren't listed get a neutral chip.
const CATEGORY = {
  Transcript: { color: 'var(--color-grade-bad)', bg: 'rgba(251, 44, 54, 0.14)' },
  'Report Card': { color: 'var(--color-grade-mid)', bg: 'rgba(240, 177, 0, 0.14)' },
  'MAP Growth Family Report': { color: 'var(--color-text-link)', bg: 'rgba(77, 168, 255, 0.14)' },
};

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

function Documents() {
  const documents = useDocuments();
  const meta = useSyncMeta();
  const [filter, setFilter] = useState('All');
  const [hovered, setHovered] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const documentUrls = useRef(new Set());

  useEffect(() => {
    return () => {
      documentUrls.current.forEach((url) => URL.revokeObjectURL(url));
      documentUrls.current.clear();
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(documents.map((d) => d.category))],
    [documents],
  );

  const visible = documents
    .filter((d) => filter === 'All' || d.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const openDoc = async (doc) => {
    if (downloading) return;

    // Reserve the tab during the click so the browser does not block it after
    // the asynchronous document request finishes.
    const viewer = window.open('', '_blank');
    if (!viewer) {
      setDownloadError('Allow pop-ups for Grademax to open documents in a new tab.');
      return;
    }

    viewer.document.title = 'Opening document…';
    setDownloading(doc.id);
    setDownloadError('');

    try {
      const { blob, fileName } = await downloadDocument(doc.docToken);
      const viewableBlob =
        blob.type === 'application/octet-stream' && fileName.toLowerCase().endsWith('.pdf')
          ? blob.slice(0, blob.size, 'application/pdf')
          : blob;
      const url = URL.createObjectURL(viewableBlob);

      if (viewer.closed) {
        URL.revokeObjectURL(url);
        return;
      }

      documentUrls.current.add(url);
      viewer.opener = null;
      viewer.location.replace(url);
    } catch (e) {
      if (!viewer.closed) viewer.close();
      setDownloadError(e && e.message ? e.message : 'Document could not be opened.');
    } finally {
      setDownloading(null);
    }
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
          <SyncPill />

          {(meta.documents.message || downloadError) && (
            <div
              role="alert"
              style={{
                margin: '0 auto 24px',
                maxWidth: 640,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(251, 44, 54, 0.14)',
                color: 'var(--color-grade-bad)',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'center',
              }}
            >
              {meta.documents.message
                ? `Documents could not be loaded: ${meta.documents.message}`
                : downloadError}
            </div>
          )}

          {/* category filter — one tab per category present */}
          {categories.length > 0 && (
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
                {categories.map((cat) => (
                  <FilterTab
                    key={cat}
                    id={cat}
                    dot={CATEGORY[cat] ? CATEGORY[cat].color : 'var(--color-muted)'}
                  />
                ))}
              </div>
            </div>
          )}

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
