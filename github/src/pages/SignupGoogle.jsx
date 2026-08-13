/**
 * SignupGoogle - "Create a password" explainer (route: /signup/google).
 *
 * Where "with Google" leads: Scoremap can't federate Google sign-in into
 * StudentVUE, so it explains the student must create a StudentVUE password.
 *
 * The password-help modal converts any page on a district's StudentVUE site
 * into that district's password-reset URL. The "log in" link points at the
 * sign-in page.
 *
 * Loaded via <script type="text/babel" src>, so it attaches to
 * `window.SignupGoogle`. Under a bundler, replace that line with
 * `export default SignupGoogle`.
 *
 * NOTE ON PATHS: this page's harness lives at signup/google.html (one folder
 * deep), so its links back to root pages use the ../ prefix.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../lib/ds.js';
import BackButton from '../components/BackButton.jsx';

function SignupGoogle() {
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [studentVueUrl, setStudentVueUrl] = React.useState('');
  const [urlError, setUrlError] = React.useState('');

  React.useEffect(() => {
    if (!helpOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setHelpOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [helpOpen]);

  const openPasswordReset = () => {
    const value = studentVueUrl.trim();
    if (!value) {
      setUrlError('Paste a link to your district’s StudentVUE website.');
      return;
    }

    try {
      const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
      const resetUrl = new URL(withProtocol);

      if (!['http:', 'https:'].includes(resetUrl.protocol) || !resetUrl.hostname) {
        throw new Error('Invalid StudentVUE URL');
      }

      resetUrl.protocol = 'https:';
      resetUrl.pathname = '/PXP2_Password_Help.aspx';
      resetUrl.search = '';
      resetUrl.hash = '';
      setUrlError('');
      window.open(resetUrl.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      setUrlError('Enter a valid StudentVUE link, such as https://your-district-psv.edupoint.com.');
    }
  };

  const para = {
    fontSize: 'var(--text-body-md-size)',
    color: 'var(--color-body)',
    lineHeight: 1.6,
    margin: 0,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-canvas)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <BackButton to="/signup" label="Back to sign up" />
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px 40px',
        }}
      >
        <div
          style={{
            width: 560,
            maxWidth: '100%',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div>
            <div style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 6 }}>
              Sign up for Scoremap
            </div>
            <div
              style={{
                fontSize: 'var(--text-display-sm-size)',
                fontWeight: 'var(--text-display-sm-weight)',
                letterSpacing: 'var(--text-display-sm-tracking)',
                color: 'var(--color-ink)',
              }}
            >
              Create a password
            </div>
          </div>

          <p style={para}>
            Scoremap isn't able to use Sign in with Google to sign you in. You'll need to create a
            password for StudentVUE that Scoremap can sign you in with instead.
          </p>
          <p style={para}>
            You'll still be able to use Sign in with Google with StudentVUE afterwards.
          </p>

          <p style={para}>
            Note: If you've previously used platforms such as GradeCompass or SynergyPlus, you can
            use the same StudentVUE password to log in to Scoremap. You don't need to create a new
            password.
          </p>

          <div>
            <Button variant="secondary" onClick={() => setHelpOpen(true)}>
              <span aria-hidden="true">ⓘ</span> How to set your StudentVUE password
            </Button>
          </div>

          <p style={para}>
            You should receive an email that will contain a link to set your password. This may take a
            few minutes. Once you've created your password, you can{' '}
            <Link to="/login">log in</Link>.
          </p>
          <p style={para}>
            If you never receive an email the first time, wait a while and try again. Some students have
            reported needing to try several times over the course of a few days before they received the
            email.
          </p>
        </div>
      </div>

      {helpOpen && (
        <div
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHelpOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-help-title"
            style={{
              width: 760,
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 48px)',
              overflowY: 'auto',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              boxSizing: 'border-box',
              color: 'var(--color-ink)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 8 }}>
              <h2
                id="password-help-title"
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm-size)',
                  fontWeight: 'var(--text-display-sm-weight)',
                  letterSpacing: 'var(--text-display-sm-tracking)',
                }}
              >
                Password Reset Help
              </h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label="Close password reset help"
                style={{
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  color: 'var(--color-body)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <p style={{ ...para, marginBottom: 28 }}>
              The exact link to reset your password depends on your district. If you don't know how
              to find it, try these steps:
            </p>

            <section style={{ marginBottom: 32 }}>
              <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600 }}>
                Find automatically
              </h3>
              <p style={{ ...para, marginBottom: 16 }}>
                Paste a link to any page on your district's StudentVUE website and we'll take you to
                the password reset page:
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 420px' }}>
                  <input
                    type="url"
                    value={studentVueUrl}
                    onChange={(event) => {
                      setStudentVueUrl(event.target.value);
                      if (urlError) setUrlError('');
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') openPasswordReset();
                    }}
                    autoFocus
                    placeholder="https://your-district-psv.edupoint.com"
                    aria-label="StudentVUE website link"
                    aria-invalid={Boolean(urlError)}
                    style={{
                      width: '100%',
                      height: 44,
                      padding: '10px 14px',
                      boxSizing: 'border-box',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${urlError ? 'var(--color-error)' : 'var(--color-hairline-strong)'}`,
                      outline: 'none',
                      background: 'var(--color-surface-dark-elevated)',
                      color: 'var(--color-ink)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 'var(--text-body-md-size)',
                    }}
                  />
                  {urlError && (
                    <div role="alert" style={{ marginTop: 8, color: 'var(--color-error)', fontSize: 13 }}>
                      {urlError}
                    </div>
                  )}
                </div>
                <Button variant="primary" onClick={openPasswordReset}>
                  Open reset page
                </Button>
              </div>
            </section>

            <section>
              <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>
                Find manually
              </h3>
              <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <ol
                  style={{
                    flex: '1 1 340px',
                    margin: 0,
                    paddingLeft: 22,
                    color: 'var(--color-body)',
                    fontSize: 'var(--text-body-md-size)',
                    lineHeight: 1.6,
                  }}
                >
                  <li style={{ marginBottom: 12 }}>
                    On your district's StudentVUE website, go to the login page. You may need to
                    temporarily log out to get there.
                  </li>
                  <li style={{ marginBottom: 12 }}>Open the “More Options” dropdown.</li>
                  <li>
                    Click “Forgot Password.” It does not matter whether you had a password previously.
                  </li>
                </ol>
                <a
                  href="/studentvue-password-help.png"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open the StudentVUE password help example at full size"
                  style={{ flex: '0 1 280px', display: 'block' }}
                >
                  <img
                    src="/studentvue-password-help.png"
                    alt="StudentVUE login page with More Options open and the Forgot Password link visible"
                    style={{
                      display: 'block',
                      width: '100%',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-hairline-strong)',
                    }}
                  />
                </a>
              </div>
            </section>
          </div>
        </div>
      )}

      <div
        style={{
          padding: 24,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--color-muted)',
          lineHeight: 1.5,
        }}
      >
        StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Scoremap is not
        affiliated with or endorsed by Edupoint Educational Systems LLC.
      </div>
    </div>
  );
}

export default SignupGoogle;
