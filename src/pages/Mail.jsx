/**
 * Mail - the student's school messages (route: /mail).
 *
 * The list comes from the sync layer (portal messages module scraped in the
 * browser, or the test/demo mailbox). meta.mail tells the page whether the
 * mailbox is real, sample (placeholder), or failed to load - the banner reflects
 * that instead of hardcoding "not connected".
 *
 * Uses the same card box as the Documents page for a consistent look, and the
 * same vertical rhythm: a filter bar sits where Documents puts its category
 * switcher, so the first card of both lists lands at the same spot. The bar
 * narrows the list with a text search over subjects and a dropdown that picks
 * a sender. Both work on data the list scrape already has - subjects and
 * senders - never message bodies, which would cost a portal request per
 * message (see the note above TITLE_FADE). Clicking a message opens the reader
 * at /mail/:mailId.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import SyncPill from '../components/SyncPill.jsx';
import { useMail, useSession, useSyncMeta } from '../data/SyncProvider.jsx';
import { ChevronDownIcon, LinkIcon, PaperclipIcon, PersonIcon, SearchIcon, XIcon } from '../lib/icons.jsx';

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TONES = {
  neutral: { background: 'var(--color-surface-strong)', color: 'var(--color-body)', border: '1px solid var(--color-hairline)' },
  link: { background: 'color-mix(in srgb, var(--color-grade-good) 22%, transparent)', color: 'var(--color-grade-good)', border: '1px solid transparent' },
  attachment: { background: 'color-mix(in srgb, var(--color-preview) 22%, transparent)', color: 'var(--color-preview)', border: '1px solid transparent' },
};

// Same chip metrics as the Documents page so both lists read identically.
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

// The subject is one non-wrapping run that dissolves at the card's right edge
// (Gmail-style), so a long subject never wraps or clips.
//
// There is deliberately no inline body preview. Showing one meant fetching a
// message body per visible row - eight extra portal requests on every sync, more
// than the whole rest of the sync combined - and those requests are charged
// against a per-IP budget the entire school shares. The body loads when the
// student opens the message.
const TITLE_FADE = 'linear-gradient(to right, black 78%, transparent 98%)';

function SenderOption({ label, count, active, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      role="option"
      aria-selected={active}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        background: hov ? 'var(--color-nav-active)' : 'transparent',
        color: active || hov ? 'var(--color-ink)' : 'var(--color-body)',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span style={{ color: 'var(--color-muted)', fontSize: 13, fontWeight: 500, flexShrink: 0 }}>{count}</span>}
    </button>
  );
}

function Mail() {
  const navigate = useNavigate();
  const mail = useMail();
  const session = useSession();
  const meta = useSyncMeta();
  const [hovered, setHovered] = useState(null);
  const [search, setSearch] = useState('');
  const [sender, setSender] = useState(null);
  const [searchFocus, setSearchFocus] = useState(false);
  const [senderOpen, setSenderOpen] = useState(false);
  const senderRef = useRef(null);

  useEffect(() => {
    if (!senderOpen) return undefined;
    const onDown = (e) => {
      if (senderRef.current && !senderRef.current.contains(e.target)) setSenderOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setSenderOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [senderOpen]);

  const senders = useMemo(() => {
    const counts = new Map();
    for (const m of mail.messages) counts.set(m.sender, (counts.get(m.sender) || 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [mail.messages]);

  const query = search.trim().toLowerCase();
  const messages = mail.messages
    .filter((m) => (!sender || m.sender === sender) && (!query || m.subject.toLowerCase().includes(query)))
    .sort((a, b) => b.date.localeCompare(a.date));

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

          {/* In demo/test mode the SyncPill's "everything here is sample data"
              pill already covers it (same rule SyncPill applies to the sample
              gradebook/attendance pills) - repeating it here would push the
              list below where the Documents list starts. */}
          {((!session.demo && meta.mail.placeholder) || mail.unreadableMessages > 0) && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {!session.demo && meta.mail.placeholder && (
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

          {/* filter bar - subject search plus a sender picker. Sits in the
              same slot as the Documents category switcher (same height, same
              24px gap to the list), so the first card of both lists lands at
              the same spot. */}
          {mail.messages.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 4,
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-card)',
                border: '1px solid var(--color-hairline-strong)',
                boxShadow: searchFocus ? 'var(--shadow-soft-drop)' : 'none',
                transition: 'box-shadow 150ms ease',
                boxSizing: 'border-box',
                maxWidth: 820,
                margin: '0 auto 24px',
              }}
            >
              <span style={{ display: 'inline-flex', color: 'var(--color-muted)', paddingLeft: 12, flexShrink: 0 }}>
                <SearchIcon size={16} />
              </span>
              <input
                type="text"
                className="gm-bare-input"
                aria-label="Search mail subjects"
                placeholder="Search subjects"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 15,
                  padding: '8px 6px',
                }}
              />
              {search !== '' && (
                <button
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: 6,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'var(--color-muted)',
                    flexShrink: 0,
                  }}
                >
                  <XIcon size={14} />
                </button>
              )}
              <span aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', margin: '6px 2px', background: 'var(--color-hairline)', flexShrink: 0 }} />
              <div ref={senderRef} style={{ position: 'relative', flexShrink: 0, maxWidth: '45%' }}>
                <button
                  aria-haspopup="listbox"
                  aria-expanded={senderOpen}
                  onClick={() => setSenderOpen((o) => !o)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    maxWidth: '100%',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    background: sender ? 'var(--color-surface-dark-elevated)' : 'transparent',
                    color: sender ? 'var(--color-ink)' : 'var(--color-body)',
                  }}
                >
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                    <PersonIcon size={14} />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sender || 'From'}</span>
                  <span style={{ display: 'inline-flex', flexShrink: 0 }}>
                    <ChevronDownIcon size={14} />
                  </span>
                </button>
                {senderOpen && (
                  <div
                    role="listbox"
                    aria-label="Filter by sender"
                    className="gm-pop-in"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      zIndex: 30,
                      minWidth: 240,
                      maxWidth: 320,
                      maxHeight: 300,
                      overflowY: 'auto',
                      padding: 6,
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-surface-dark-elevated)',
                      border: '1px solid var(--color-hairline-strong)',
                      boxShadow: 'var(--shadow-soft-drop)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <SenderOption
                      label="Everyone"
                      active={sender === null}
                      onClick={() => {
                        setSender(null);
                        setSenderOpen(false);
                      }}
                    />
                    {senders.map(([name, count]) => (
                      <SenderOption
                        key={name}
                        label={name}
                        count={count}
                        active={sender === name}
                        onClick={() => {
                          setSender(name);
                          setSenderOpen(false);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* message list - same narrow card box as Documents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                {mail.messages.length === 0 ? 'No messages.' : 'No messages match.'}
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
                  {/* subject, one line, fading out to the right */}
                  <div
                    style={{
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      marginBottom: 10,
                      WebkitMaskImage: TITLE_FADE,
                      maskImage: TITLE_FADE,
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', letterSpacing: '-0.2px' }}>
                      {m.subject}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Chip icon={<PersonIcon size={14} />}>
                      {m.sender}
                      {m.role ? ` (${m.role})` : ''}
                    </Chip>
                    <Chip>{fmtDate(m.date)}</Chip>
                    {m.links.length > 0 && (
                      <Chip icon={<LinkIcon size={14} />} tone="link">{plural(m.links.length, 'Link')}</Chip>
                    )}
                    {/* Until a body is loaded the count is unknown, but the list
                        already knows whether attachments exist. */}
                    {(m.attachments.length > 0 || m.hasAttachments) && (
                      <Chip icon={<PaperclipIcon size={14} />} tone="attachment">
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
