/**
 * MailDetail - a single message, Gmail-style reading pane (route: /mail/:mailId).
 *
 * Resolves the message from the synced mailbox (useMail). Links open in a new
 * tab; attachments download through the portal (or the generated test-account
 * PDFs) and open in the browser's viewer, same flow as Documents. Keeps the app
 * sidebar and drops all of Gmail's chrome the app doesn't need - just a clean
 * read view in the Scoremap style.
 */
import DOMPurify from 'dompurify';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { downloadMailAttachment, getMailMessage } from '../data/api.js';
import { useMail } from '../data/SyncProvider.jsx';
import { ArrowLeftIcon, LinkIcon, PaperclipIcon } from '../lib/icons.jsx';

const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const RICH_MAIL_TAGS = [
  'a', 'b', 'blockquote', 'br', 'code', 'del', 'div', 'em', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong',
  'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];

const SAFE_STYLE_VALUES = {
  'font-style': /^(?:normal|italic|oblique)$/i,
  'font-weight': /^(?:normal|bold|bolder|lighter|[1-9]00)$/i,
  'text-align': /^(?:left|right|center|justify|start|end)$/i,
  'text-decoration': /^(?:none|underline|line-through)(?:\s+(?:solid|double|dotted|dashed|wavy))?$/i,
  'white-space': /^(?:normal|pre|pre-line|pre-wrap)$/i,
};

function sanitizeMailHtml(html) {
  if (!html || typeof DOMParser === 'undefined') return '';
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: RICH_MAIL_TAGS,
    ALLOWED_ATTR: ['colspan', 'href', 'rowspan', 'style', 'title'],
  });
  const document = new DOMParser().parseFromString(clean, 'text/html');
  document.querySelectorAll('[style]').forEach((element) => {
    const safeDeclarations = [];
    for (const [property, allowed] of Object.entries(SAFE_STYLE_VALUES)) {
      const value = element.style.getPropertyValue(property).trim();
      if (value && allowed.test(value)) safeDeclarations.push(`${property}: ${value}`);
    }
    if (safeDeclarations.length) element.setAttribute('style', safeDeclarations.join('; '));
    else element.removeAttribute('style');
  });
  document.querySelectorAll('a').forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    if (!/^(?:https?:|mailto:)/i.test(href)) {
      anchor.removeAttribute('href');
      return;
    }
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noreferrer noopener');
  });
  return document.body.innerHTML;
}

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
  const mail = useMail();
  const listed = mail.messages.find((x) => x.id === mailId);

  // The portal's message list carries no body, so anything the sync did not
  // prefetch loads here on open. `loaded` holds that fetched message.
  const [loaded, setLoaded] = useState(null);
  const [bodyError, setBodyError] = useState('');
  const [loadingBody, setLoadingBody] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const attachmentUrls = useRef(new Set());

  const needsBody = !!listed && !listed.bodyLoaded;
  useEffect(() => {
    if (!needsBody) return;
    let alive = true;
    setLoadingBody(true);
    setBodyError('');
    getMailMessage(listed.id, listed.isSystemMessage)
      .then((full) => {
        if (!alive) return;
        setLoaded({
          ...listed,
          body: full.body,
          bodyHtml: full.bodyHtml,
          links: full.links,
          attachments: full.attachments,
          bodyLoaded: true,
        });
      })
      .catch((e) => {
        if (alive) setBodyError(e && e.message ? e.message : 'This message could not be loaded.');
      })
      .finally(() => {
        if (alive) setLoadingBody(false);
      });
    return () => {
      alive = false;
    };
  }, [needsBody, listed]);

  const m = loaded && listed && loaded.id === listed.id ? loaded : listed;
  const richBody = useMemo(() => sanitizeMailHtml(m?.bodyHtml || ''), [m?.bodyHtml]);

  useEffect(() => {
    return () => {
      attachmentUrls.current.forEach((url) => URL.revokeObjectURL(url));
      attachmentUrls.current.clear();
    };
  }, []);

  const openAttachment = async (attachment) => {
    if (downloading) return;
    setDownloading(attachment.token);
    setDownloadError('');

    try {
      const { blob, fileName } = await downloadMailAttachment(attachment.token);
      const viewableBlob =
        blob.type === 'application/octet-stream' && fileName.toLowerCase().endsWith('.pdf')
          ? blob.slice(0, blob.size, 'application/pdf')
          : blob;
      const url = URL.createObjectURL(viewableBlob);
      const viewer = window.open(url, '_blank');

      if (viewer) {
        attachmentUrls.current.add(url);
        viewer.opener = null;
      } else {
        // An asynchronous open can be blocked by stricter popup settings.
        // Falling back to the current tab still avoids downloading the file.
        window.location.assign(url);
      }
    } catch (e) {
      setDownloadError(e && e.message ? e.message : 'Attachment could not be opened.');
    } finally {
      setDownloading(null);
    }
  };

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
              <span style={{ fontWeight: 600 }}>{m.sender}</span>
              {m.email && <span style={{ color: 'var(--color-muted)' }}> &lt;{m.email}&gt;</span>}
            </div>
            {m.role && (
              <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 2 }}>
                {m.role}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>{longDate(m.date)}</div>
      </div>

      <div style={{ height: 1, background: 'var(--color-hairline)', margin: '24px 0 28px' }} />

      {(downloadError || bodyError) && (
        <div
          role="alert"
          className="gm-fade-in"
          style={{
            margin: '0 0 24px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-tint-bad)',
            color: 'var(--color-grade-bad)',
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          {downloadError || bodyError}
        </div>
      )}

      {/* body */}
      <div style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--color-ink)' }}>
        {loadingBody && !m.bodyLoaded && (
          <p style={{ margin: 0, color: 'var(--color-muted)' }}>Loading message…</p>
        )}
        {richBody ? (
          <div className="gm-mail-rich" dangerouslySetInnerHTML={{ __html: richBody }} />
        ) : (
          m.body.map((p, i) => (
            <p key={i} style={{ margin: '0 0 16px', whiteSpace: 'pre-line' }}>
              {p}
            </p>
          ))
        )}
      </div>

      {/* links */}
      {!richBody && m.links.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--color-muted)', marginBottom: 12 }}>
            {plural(m.links.length, 'Link')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {m.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-link)', fontSize: 14, width: 'fit-content' }}
              >
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
            {m.attachments.map((a) => (
              <button
                key={a.token}
                onClick={() => openAttachment(a)}
                aria-busy={downloading === a.token}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: downloading === a.token ? 'wait' : 'pointer',
                }}
              >
                <span style={{ color: 'var(--color-preview)', display: 'inline-flex' }}>
                  <PaperclipIcon size={16} />
                </span>
                {a.name}
                {downloading === a.token && <span style={{ color: 'var(--color-muted)' }}>Opening…</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}

export default MailDetail;
