/**
 * MailDetail — a single message, Gmail-style reading pane (route: /mail/:mailId).
 *
 * FRONTEND ONLY. Resolves the message from the placeholder MAIL list in Mail.jsx
 * (the backend will supply the real message + attachment/link URLs later). Keeps
 * the app sidebar and drops all of Gmail's chrome (compose, folder list, toolbar
 * icons) the app doesn't need — just a clean read view in the Grademax style.
 */
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { ArrowLeftIcon, LinkIcon, PaperclipIcon } from '../lib/icons.jsx';
import { MAIL } from './Mail.jsx';

const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Shell({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>{children}</div>
      </main>
    </div>
  );
}

function BackButton({ onClick }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
        padding: '6px 4px',
        border: 'none',
        background: 'transparent',
        color: hov ? 'var(--color-ink)' : 'var(--color-body)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      <ArrowLeftIcon size={18} />
      Back
    </button>
  );
}

function MailDetail() {
  const navigate = useNavigate();
  const { mailId } = useParams();
  const m = MAIL.find((x) => x.id === mailId);

  if (!m) {
    return (
      <Shell>
        <BackButton onClick={() => navigate('/mail')} />
        <div style={{ color: 'var(--color-muted)', fontSize: 15 }}>
          Message not found. <Link to="/mail">Back to Mail</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <BackButton onClick={() => navigate('/mail')} />

      {/* subject */}
      <h1 style={{ margin: '0 0 20px', fontSize: 'clamp(22px, 2.6vw, 30px)', fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1.25, color: 'var(--color-ink)' }}>
        {m.subject}
      </h1>

      {/* sender header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, color: 'var(--color-ink)' }}>
              <span style={{ fontWeight: 600 }}>{m.sender}</span>{' '}
              <span style={{ color: 'var(--color-muted)' }}>&lt;{m.email}&gt;</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
              {m.role}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{longDate(m.date)}</div>
      </div>

      <div style={{ height: 1, background: 'var(--color-hairline)', margin: '24px 0 28px' }} />

      {/* body */}
      <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-body)' }}>
        {m.body.map((p, i) => (
          <p key={i} style={{ margin: '0 0 16px', whiteSpace: 'pre-line' }}>
            {p}
          </p>
        ))}
      </div>

      {/* links */}
      {m.links.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
            {plural(m.links.length, 'Link')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.links.map((l, i) => (
              <a key={i} href={l.url} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-link)', fontSize: 14, width: 'fit-content' }}>
                <LinkIcon size={14} />
                {l.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* attachments */}
      {m.attachments.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
            {plural(m.attachments.length, 'Attachment')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {m.attachments.map((a, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                  color: 'var(--color-ink)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: 'var(--color-preview)', display: 'inline-flex' }}>
                  <PaperclipIcon size={16} />
                </span>
                {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

export default MailDetail;
