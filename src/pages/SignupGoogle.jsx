/**
 * SignupGoogle — "Create a password" explainer (route: /signup/google).
 *
 * Where "with Google" leads: Grademax can't federate Google sign-in into
 * StudentVUE, so it explains the student must create a StudentVUE password.
 *
 * POC note: this is intentionally a static explainer — the "How to set your
 * StudentVUE password" helper and the email/link copy are placeholders to be
 * wired up later. The "log in" link points at the sign-in page.
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

function SignupGoogle() {

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
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px',
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
              Sign up for Grademax
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
            Grademax isn't able to use Sign in with Google to sign you in. You'll need to create a
            password for StudentVUE that Grademax can sign you in with instead.
          </p>
          <p style={para}>
            You'll still be able to use Sign in with Google with StudentVUE afterwards.
          </p>

          <div>
            <Button variant="secondary">
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

      <div
        style={{
          padding: 24,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--color-muted)',
          lineHeight: 1.5,
        }}
      >
        StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Grademax is not
        affiliated with or endorsed by Edupoint Educational Systems LLC.
      </div>
    </div>
  );
}

export default SignupGoogle;
