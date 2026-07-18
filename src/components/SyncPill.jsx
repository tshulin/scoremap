// SyncPill — the "Last updated … · Refresh" pill shown at the top of every
// logged-in page, now backed by the real sync state. Also the one place that
// flags the backend's sample gradebook so invented grades never look real.
import React from 'react';
import { useSession, useSyncMeta, useSyncStatus } from '../data/SyncProvider.jsx';

const fmtTime = (date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

function SyncPill({ note }) {
  const session = useSession();
  const meta = useSyncMeta();
  const { status, refresh } = useSyncStatus();

  const label =
    status === 'syncing'
      ? 'Syncing…'
      : session.lastUpdated
        ? `Last updated ${fmtTime(session.lastUpdated)}`
        : 'Not synced yet';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 24 }}>
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
        <span>{label}</span>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            if (status !== 'syncing') refresh();
          }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <span aria-hidden="true">↻</span> Refresh
        </a>
      </div>
      {meta.gradebook.placeholder && (
        <div
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(240, 177, 0, 0.14)',
            color: 'var(--color-grade-mid)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Sample gradebook — real grades appear once the term starts.
        </div>
      )}
      {meta.attendance.placeholder && (
        <div
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            background: 'rgba(240, 177, 0, 0.14)',
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
  );
}

export default SyncPill;
