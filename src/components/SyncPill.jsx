// SyncPill — the "Last updated … · Refresh" pill shown at the top of every
// logged-in page, now backed by the real sync state. Also the one place that
// flags demo mode and the backend's sample gradebook so invented grades never
// look real.
//
// The pill is position:absolute against the document, at the horizontal
// center of the content area (viewport minus the sidebar), so it occupies the
// same spot on every page — switching tabs never moves it — while still
// scrolling away with the content. Pages with a header in TopBar's `left`
// slot pass `avoid` — a ref to that element — and the pill shifts right only
// when that element would actually overlap the centered pill.
//
// `scope` names the resource this page displays ('gradebook' | 'attendance' |
// 'documents' | 'mail'), and Refresh re-fetches only that one. Omitting it
// re-syncs everything, which is four times the requests — pass it.
import React from 'react';
import { useSession, useSyncMeta, useSyncStatus } from '../data/SyncProvider.jsx';

const SIDEBAR_WIDTH = 280; // keep in sync with Sidebar's width
const PILL_TOP = 32; // matches every logged-in page's <main> padding-top
const AVOID_GAP = 24; // matches TopBar's columnGap

const fmtTime = (date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function SyncPill({ note, scope, below, delta, avoid }) {
  const session = useSession();
  const meta = useSyncMeta();
  const { status, refresh } = useSyncStatus();

  const wrapRef = React.useRef(null);
  const [shift, setShift] = React.useState(0);
  const [spacerHeight, setSpacerHeight] = React.useState(34);

  React.useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;

    const measure = () => {
      setSpacerHeight(wrap.offsetHeight);
      const el = avoid?.current;
      if (!el) return;
      // The left edge the pill would have unshifted — computed from the
      // viewport, not read back from the DOM, so the shift can't feed itself.
      const centeredLeft = (window.innerWidth + SIDEBAR_WIDTH - wrap.offsetWidth) / 2;
      const leftRect = el.getBoundingClientRect();
      // Vertical comparison can use live rects: both elements scroll together,
      // and the shift only moves the pill horizontally, so no feedback loop.
      const wrapRect = wrap.getBoundingClientRect();
      const overlapsVertically = leftRect.bottom > wrapRect.top && leftRect.top < wrapRect.bottom;
      const needed = leftRect.right + AVOID_GAP - centeredLeft;
      setShift(overlapsVertically && needed > 0 ? Math.round(needed) : 0);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    if (avoid?.current) ro.observe(avoid.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [avoid]);

  const label =
    status === 'syncing'
      ? 'Syncing…'
      : session.lastUpdated
        ? `Last updated ${fmtTime(session.lastUpdated)}`
        : 'Not synced yet';

  return (
    <>
      <div
        ref={wrapRef}
        style={{
          // Absolute against the document (no positioned ancestor): anchored
          // to the same coordinates on every page, scrolls with the content.
          position: 'absolute',
          top: PILL_TOP,
          left: `calc(50vw + ${SIDEBAR_WIDTH / 2 + shift}px)`,
          transform: 'translateX(-50%)',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* The pill and whatever a page slots under it share this wrapper, so
            the widest of the two (in practice the pill) sets both widths. */}
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: delta ? '8px 14px' : '7px 14px',
              borderRadius: delta ? 'var(--radius-lg)' : 'var(--radius-pill)',
              border: '1px solid var(--color-hairline-strong)',
              background: 'var(--color-surface-card)',
              fontSize: 13,
              color: 'var(--color-body)',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--color-text-updated)' }}>{label}</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (status !== 'syncing') refresh(scope);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <span aria-hidden="true">↻</span> Refresh
              </a>
            </div>
            {delta && <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{delta}</div>}
          </div>
          {below}
        </div>
        {session.demo && (
          <div
            className="gm-fade-in"
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-surface-demo)',
              color: 'var(--color-text-link)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Demo mode — everything here is sample data.
          </div>
        )}
        {!session.demo && meta.gradebook.placeholder && (
          <div
            className="gm-fade-in"
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-tint-mid)',
              color: 'var(--color-grade-mid)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sample gradebook — real grades appear once the term starts.
          </div>
        )}
        {!session.demo && meta.attendance.placeholder && (
          <div
            className="gm-fade-in"
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-tint-mid)',
              color: 'var(--color-grade-mid)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sample attendance — real absences appear once they’re recorded.
          </div>
        )}
        {note}
      </div>
      {/* In-flow stand-in for the fixed pill, so page content below keeps its
          old offset instead of sliding underneath it. */}
      <div aria-hidden="true" style={{ height: spacerHeight, marginBottom: 24 }} />
    </>
  );
}

export default SyncPill;
