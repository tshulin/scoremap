/**
 * Mail — the student's school messages (route: /mail).
 *
 * The list comes from the sync layer (portal messages module scraped in the
 * browser, or the test/demo mailbox). meta.mail tells the page whether the
 * mailbox is real, sample (placeholder), or failed to load — the banner reflects
 * that instead of hardcoding "not connected".
 *
 * Uses the same card box as the Documents page for a consistent look. Clicking a
 * message opens the reader at /mail/:mailId.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { useMail, useSyncMeta } from '../data/SyncProvider.jsx';
import { PersonIcon, LinkIcon, PaperclipIcon } from '../lib/icons.jsx';

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TONES = {
  neutral: { background: 'var(--color-surface-strong)', color: 'var(--color-body)', border: '1px solid var(--color-hairline)' },
  link: { background: 'rgba(0, 201, 80, 0.14)', color: 'var(--color-grade-good)', border: '1px solid transparent' },
  attachment: { background: 'rgba(168, 85, 247, 0.14)', color: 'var(--color-preview)', border: '1px solid transparent' },
};

function Chip({ icon, tone = 'neutral', children }) {
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
        whiteSpace: 'nowrap',
        ...TONES[tone],
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function Mail() {
  const navigate = useNavigate();
  const mail = useMail();
  const meta = useSyncMeta();
  const [hovered, setHovered] = useState(null);

  const messages = [...mail.messages].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <SyncPill />

          {!meta.mail.ok && meta.mail.message && (
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
              Mail could not be loaded: {meta.mail.message}
            </div>
          )}

          {(meta.mail.placeholder || mail.unreadableMessages > 0) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {meta.mail.placeholder && (
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
                  {meta.mail.message || 'Sample messages.'}
                </div>
              )}
              {mail.unreadableMessages > 0 && (
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
                  {plural(mail.unreadableMessages, 'message')} could not be read.
                </div>
              )}
            </div>
          )}

          {/* message list — same narrow card box as Documents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                No messages.
              </div>
            )}
            {messages.map((m) => {
              const hov = hovered === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/mail/${encodeURIComponent(m.id)}`)}
                  onMouseEnter={() => setHovered(m.id)}
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
                    {m.subject}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Chip icon={<PersonIcon />}>
                      {m.sender}
                      {m.role ? ` (${m.role})` : ''}
                    </Chip>
                    <Chip>{fmtDate(m.date)}</Chip>
                    {m.links.length > 0 && (
                      <Chip tone="link" icon={<LinkIcon />}>
                        {plural(m.links.length, 'Link')}
                      </Chip>
                    )}
                    {m.attachments.length > 0 && (
                      <Chip tone="attachment" icon={<PaperclipIcon />}>
                        {plural(m.attachments.length, 'Attachment')}
                      </Chip>
                    )}
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

export default Mail;
