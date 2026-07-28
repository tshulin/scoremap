// TopBar — the consistent header band across logged-in pages. The refresh
// pill (SyncPill) is fixed at the center of the content area; each page slots
// its own content to the left and right of it. The bar lives inside <main>,
// so it spans only the content area — the sidebar keeps the full screen
// height and always wins the overlap.
import React from 'react';
import SyncPill from './SyncPill.jsx';

function TopBar({ left, right, pillBelow, pillDelta, pillScope }) {
  // Handed to SyncPill so the fixed-position pill can dodge a left header
  // wide enough to reach it.
  const leftRef = React.useRef(null);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'start',
        columnGap: 24,
        marginBottom: 8,
      }}
    >
      {/* justifySelf start so the box hugs the content — SyncPill measures
          this rect for overlap, and a stretched 1fr item would always read
          as reaching the pill. */}
      <div ref={leftRef} style={{ minWidth: 0, justifySelf: 'start', maxWidth: '100%' }}>{left}</div>
      <SyncPill scope={pillScope} below={pillBelow} delta={pillDelta} avoid={leftRef} />
      <div style={{ minWidth: 0, justifySelf: 'end', textAlign: 'right' }}>{right}</div>
    </div>
  );
}

export default TopBar;
