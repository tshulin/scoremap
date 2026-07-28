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
import { extractPortalDomain } from '../portal/domainInput';
import { DISTRICTS } from '../data/districts.js';
import { TEST_DISTRICT } from '../data/testAccount.js';

// DISTRICTS is sorted by state, then name — group sequentially for <optgroup>.
// The built-in test district (test/test account) rides along at the end, in
// its own group, so it never gets lost when the real list is regenerated.
const ALL_DISTRICTS = [...DISTRICTS, TEST_DISTRICT];
const DISTRICT_GROUPS = ALL_DISTRICTS.reduce((groups, d) => {
  const last = groups[groups.length - 1];
  if (last && last.state === d.state) last.districts.push(d);
  else groups.push({ state: d.state, districts: [d] });
  return groups;
}, []);
const DISTRICT_DOMAINS = new Set(ALL_DISTRICTS.map((d) => d.domain));

// District dropdown, styled to match the DS TextInput (44px, hairline border
// thickening to 2px ink on focus) — the DS has no Select component yet.
function DistrictSelect({ value, onChange }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <select
      aria-label="School district"
      value={value}
      onChange={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 44,
        padding: '0 12px',
        boxSizing: 'border-box',
        borderRadius: 'var(--radius-md)',
        border: `${focused ? 2 : 1}px solid ${focused ? 'var(--color-ink)' : 'var(--color-hairline-strong)'}`,
        fontSize: 'var(--text-body-md-size)',
        fontFamily: 'var(--font-sans)',
        color: value ? 'var(--color-ink)' : 'var(--color-body)',
        background: 'var(--color-surface-card)',
        outline: 'none',
        width: '100%',
        cursor: 'pointer',
      }}
    >
      <option value="">Choose your school district…</option>
      {DISTRICT_GROUPS.map((group) => (
        <optgroup key={group.state} label={group.state}>
          {group.districts.map((d, i) => (
            <option key={i} value={d.domain}>
              {d.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Login() {
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [domainText, setDomainText] = React.useState('');
  const [agreed, setAgreed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  // Single source of truth is the text field; the dropdown reflects it when
  // the (normalized) text is a known district and writes into it on change.
  const domain = extractPortalDomain(domainText);
  const selectedDistrict = domain && DISTRICT_DOMAINS.has(domain) ? domain : '';

  // Sign in to StudentVUE from inside the browser (TLS terminates here, over a
  // relay that only sees ciphertext), then land on the dashboard.
  const handleLogin = async () => {
    if (!agreed || pending) return;
    if (!username || !password) {
      setError('Enter your StudentVUE username and password.');
      return;
    }
    if (!domain) {
      setError(
        domainText
          ? "Couldn't find a StudentVUE domain in what you entered. Choose your district from the list, or paste the web address of your StudentVUE portal."
          : 'Choose your school district from the list, or paste the web address of your StudentVUE portal.',
      );
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
          padding: '64px 24px',
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
                Grademax signs in to StudentVUE from inside your browser: your password is
                encrypted here and sent straight to StudentVUE, so our relay only ever passes
                along data it can't read. Your password is never sent to our servers, stored, or
                logged.
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
              <DistrictSelect
                value={selectedDistrict}
                onChange={(e) => setDomainText(e.target.value)}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: 'var(--color-muted)',
                  fontSize: 14,
                }}
              >
                <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--color-hairline-strong)' }} />
                or paste your portal link
                <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--color-hairline-strong)' }} />
              </div>
              <div>
                <TextInput
                  placeholder="[your-district]-psv.edupoint.com"
                  value={domainText}
                  onChange={(e) => setDomainText(e.target.value)}
                />
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--color-body)',
                    lineHeight: 1.5,
                    marginTop: 8,
                  }}
                >
                  Any web address from your StudentVUE portal works — with or without
                  https://, straight from your grades page, whatever you have. Grademax
                  pulls the domain out of it.
                </div>
              </div>
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
                  background: 'var(--color-tint-bad)',
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
