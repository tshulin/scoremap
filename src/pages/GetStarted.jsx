/**
 * GetStarted - Scoremap "Get started" / sign-up page (route: /signup).
 *
 * Asks how the student signs in to StudentVUE, then branches:
 *   • "with Google"     → /signup/google  (create-a-password explainer)
 *   • "with a password" → /login          (the sign-in page)
 *
 * POC note: routes are static harness files here - "with Google" opens
 * signup/google.html and "with a password" opens the sign-in page. Under a
 * real router, swap the onClick navigations for <Link to="/signup/google">
 * and <Link to="/login">.
 *
 * Loaded via <script type="text/babel" src>, so it attaches to
 * `window.GetStarted`. Under a bundler, replace that line with
 * `export default GetStarted`.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../lib/ds.js';
import BackButton from '../components/BackButton.jsx';

function GetStarted() {
  const navigate = useNavigate();

  const go = (path) => () => { navigate(path); };

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
      <BackButton to="/" label="Back to home" />
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
            width: 460,
            maxWidth: '100%',
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: 32,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 15, color: 'var(--color-muted)', marginBottom: 6 }}>
            Sign up for Scoremap
          </div>
          <div
            style={{
              fontSize: 'var(--text-display-sm-size)',
              fontWeight: 'var(--text-display-sm-weight)',
              letterSpacing: 'var(--text-display-sm-tracking)',
              color: 'var(--color-ink)',
              marginBottom: 24,
            }}
          >
            How do you sign in to StudentVUE?
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={go('/signup/google')}>
              with Google
            </Button>
            <Button variant="secondary" onClick={go('/login')}>
              with a password
            </Button>
          </div>

          <div style={{ fontSize: 14, color: 'var(--color-body)', marginTop: 28 }}>
            Already used Scoremap?{' '}
            <Link to="/login">Log in</Link>
          </div>
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
        StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Scoremap is not
        affiliated with or endorsed by Edupoint Educational Systems LLC.
      </div>
    </div>
  );
}

export default GetStarted;
