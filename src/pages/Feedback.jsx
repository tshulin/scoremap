import React from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { MailIcon, MessageSquareIcon } from '../lib/icons.jsx';

const CONTACT_EMAIL = 'contact@scoremap.org';

const card = {
  flex: '1 1 320px',
  background: 'var(--color-surface-card)',
  border: '1px solid var(--color-hairline-strong)',
  borderRadius: 'var(--radius-xl)',
  padding: '24px 28px',
  boxSizing: 'border-box',
};

const actionLink = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  marginTop: 22,
  padding: '0 18px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-primary)',
  color: 'var(--color-on-primary)',
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
};

function FeedbackCard({ icon: Icon, title, children, href, linkText, external = false }) {
  return (
    <section style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ display: 'inline-flex', color: 'var(--color-body)' }}>
          <Icon size={20} />
        </span>
        <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 20, fontWeight: 400, letterSpacing: '-0.3px' }}>
          {title}
        </h2>
      </div>
      <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 15, lineHeight: 1.65 }}>
        {children}
      </p>
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
        style={actionLink}
      >
        {linkText}
      </a>
    </section>
  );
}

function Feedback() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '48px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
          <header style={{ marginBottom: 28 }}>
            <h1 style={{ margin: '0 0 8px', color: 'var(--color-ink)', fontSize: 30, letterSpacing: '-0.7px' }}>
              Feedback
            </h1>
            <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 16, lineHeight: 1.6 }}>
              Help us improve Scoremap or get in touch with the team.
            </p>
          </header>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <FeedbackCard
              icon={MessageSquareIcon}
              title="Report a bug or suggest a feature"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Scoremap feedback')}`}
              linkText="Email us"
            >
              To report a bug or suggest a feature, send us an email.
            </FeedbackCard>

            <FeedbackCard
              icon={MailIcon}
              title="Contact us"
              href={`mailto:${CONTACT_EMAIL}`}
              linkText={CONTACT_EMAIL}
            >
              To contact us directly, send us an email.
            </FeedbackCard>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Feedback;
