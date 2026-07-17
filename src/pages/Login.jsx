/**
 * Login — Grademax "Sign in" page. Connects a StudentVUE account.
 *
 * Rebuilt from the previous app's sign-in screen (username, password, domain,
 * acknowledgement checkbox) in the Grademax design system. Composes the DS
 * components published on `window.GrademaxDesignSystem_faa73b`; the checkbox,
 * domain-helper banner, and inline field help are built from DS tokens since
 * the system has no dedicated components for them yet.
 *
 * Loaded via <script type="text/babel" src>, so it attaches to `window.Login`.
 * Under a bundler, replace that line with `export default Login`.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TextInput, Button } from '../lib/ds.js';
import { useSignIn } from '../data/SyncProvider.jsx';

function Login() {
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [domain, setDomain] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  // Sign in through the Grademax backend (which logs in to StudentVUE
  // server-side), then land on the dashboard.
  const handleLogin = async () => {
    if (!agreed || pending) return;
    if (!username || !password || !domain) {
      setError('Enter your StudentVUE username, password, and district domain.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await signIn({ username, password, domain });
      navigate('/dashboard');
    } catch (e) {
      setError(e && e.message ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setPending(false);
    }
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
      {/* Full-width primary button override (DS Button ignores style/className). */}
      <style>{`.gm-login-submit button { width: 100%; }`}</style>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '96px 24px 64px',
        }}
      >
        <div style={{ width: 420, maxWidth: '100%' }}>
          {/* Wordmark (no logomark exists in the system — plain wordmark per brand). */}
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.4px',
              color: 'var(--color-ink)',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            Grademax
          </div>
          <div
            style={{
              fontSize: 'var(--text-display-sm-size)',
              fontWeight: 'var(--text-display-sm-weight)',
              letterSpacing: 'var(--text-display-sm-tracking)',
              color: 'var(--color-ink)',
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Log in to Grademax
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-body)',
              textAlign: 'center',
              marginBottom: 40,
            }}
          >
            Never used Grademax before?{' '}
            <Link to="/signup">Sign up</Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <TextInput
              label="StudentVUE username"
              placeholder="student@school.net"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />

            <div>
              <TextInput
                label="StudentVUE password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--color-body)',
                  lineHeight: 1.5,
                  marginTop: 8,
                }}
              >
                Grademax signs in to StudentVUE for you to fetch your grades. Your password is
                used only for that sign-in, is kept in memory just while your session is active,
                and is never written to disk or logged.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span
                style={{
                  fontSize: 'var(--text-title-sm-size)',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                }}
              >
                StudentVUE domain
              </span>
              {/* Domain-helper banner */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-hairline-strong)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 14,
                  color: 'var(--color-ink)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-hairline-strong)',
                    color: 'var(--color-body)',
                    fontSize: 12,
                    fontStyle: 'italic',
                    fontWeight: 600,
                  }}
                >
                  i
                </span>
                <span>
                  Grademax can <a href="#">find your domain for you</a>.
                </span>
              </div>
              <TextInput
                placeholder="[your-district]-psv.edupoint.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
            </div>

            {/* Acknowledgement checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--color-body)',
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  marginTop: 2,
                  accentColor: 'var(--color-primary)',
                  cursor: 'pointer',
                }}
              />
              <span>
                I understand that Grademax is an independent, unofficial tool and is not affiliated with
                or endorsed by Edupoint Educational Systems LLC. Use of StudentVUE is subject to Edupoint
                Educational Systems LLC's terms of service, and I am responsible for ensuring my use
                complies with those terms.
              </span>
            </label>

            {error && (
              <div
                role="alert"
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(251, 44, 54, 0.14)',
                  color: 'var(--color-grade-bad)',
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <div className="gm-login-submit">
              <Button variant="primary" disabled={!agreed || pending} onClick={handleLogin}>
                {pending ? 'Signing in…' : (
                  <>
                    <span aria-hidden="true">→</span> Log in
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '24px',
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

export default Login;
