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

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TONES = {
  neutral: { background: 'var(--color-surface-strong)', color: 'var(--color-body)', border: '1px solid var(--color-hairline)', fontWeight: 500 },
  link: { background: 'color-mix(in srgb, var(--color-grade-good) 22%, transparent)', color: 'var(--color-grade-good)', border: '1px solid transparent', fontWeight: 600 },
  attachment: { background: 'color-mix(in srgb, var(--color-preview) 22%, transparent)', color: 'var(--color-preview)', border: '1px solid transparent', fontWeight: 600 },
};

function Chip({ icon, tone = 'neutral', children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
        ...TONES[tone],
      }}
    >
      {icon}
      {children}
    </span>
  );
}

const Dot = () => (
  <span
    style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--color-muted)',
      display: 'inline-block',
      flexShrink: 0,
    }}
  />
);

// The subject is one non-wrapping run that dissolves at the card's right edge
// (Gmail-style), so a long subject never wraps or clips.
//
// There is deliberately no inline body preview. Showing one meant fetching a
// message body per visible row — eight extra portal requests on every sync, more
// than the whole rest of the sync combined — and those requests are charged
// against a per-IP budget the entire school shares. The body loads when the
// student opens the message.
const TITLE_FADE = 'linear-gradient(to right, black 78%, transparent 98%)';

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
          <SyncPill scope="mail" />

          {!meta.mail.ok && meta.mail.message && (
            <div
              role="alert"
              className="gm-fade-in"
              style={{
                margin: '0 auto 24px',
                maxWidth: 640,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-tint-bad)',
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
                  {meta.mail.message || 'Sample messages.'}
                </div>
              )}
              {mail.unreadableMessages > 0 && (
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
                    padding: '24px 28px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    boxShadow: hov ? 'var(--shadow-soft-drop)' : 'none',
                    transition: 'box-shadow 150ms ease',
                  }}
                >
                  {/* subject, one line, fading out to the right */}
                  <div
                    style={{
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      marginBottom: 14,
                      WebkitMaskImage: TITLE_FADE,
                      maskImage: TITLE_FADE,
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.2px' }}>
                      {m.subject}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Chip icon={<Dot />}>
                      {m.sender}
                      {m.role ? ` (${m.role})` : ''}
                    </Chip>
                    <Chip>{fmtDate(m.date)}</Chip>
                    {m.links.length > 0 && (
                      <Chip tone="link">{plural(m.links.length, 'Link')}</Chip>
                    )}
                    {/* Until a body is loaded the count is unknown, but the list
                        already knows whether attachments exist. */}
                    {(m.attachments.length > 0 || m.hasAttachments) && (
                      <Chip tone="attachment">
                        {m.attachments.length > 0
                          ? plural(m.attachments.length, 'Attachment')
                          : 'Attachments'}
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
