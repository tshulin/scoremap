/**
 * Login - Scoremap "Sign in" page. Connects a StudentVUE account.
 *
 * Rebuilt from the previous app's sign-in screen (username, password, domain,
 * acknowledgement checkbox) in the Scoremap design system. Composes the DS
 * components published on `window.ScoremapDesignSystem_faa73b`; the checkbox,
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
import { hasToken, recallAuthNotice } from '../data/api.js';
import BackButton from '../components/BackButton.jsx';
import { extractPortalDomain } from '../portal/domainInput';
import { DISTRICTS } from '../data/districts.js';
import { TEST_DISTRICT } from '../data/testAccount.js';
import { EyeIcon, EyeOffIcon, XIcon } from '../lib/icons.jsx';

// The built-in test district (test/test account) rides along at the end so it
// never gets lost when the real list is regenerated.
const ALL_DISTRICTS = [...DISTRICTS, TEST_DISTRICT];
const DISTRICT_DOMAINS = new Set(ALL_DISTRICTS.map((d) => d.domain));
const DISTRICT_BY_DOMAIN = new Map(ALL_DISTRICTS.map((d) => [d.domain, d]));

const normalizeSearch = (value) => value.trim().toLocaleLowerCase();

function districtSearchScore(district, query) {
  const name = district.name.toLocaleLowerCase();
  const state = district.state.toLocaleLowerCase();
  const domain = district.domain.toLocaleLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (name.includes(query)) return 3;
  if (state.startsWith(query)) return 4;
  if (domain.includes(query)) return 5;
  return null;
}

function PasswordInput({ value, onChange }) {
  const [focused, setFocused] = React.useState(false);
  const [visible, setVisible] = React.useState(false);

  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-title-sm-size)',
          fontWeight: 600,
          color: 'var(--color-ink)',
        }}
      >
        StudentVUE password
      </span>
      <div
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
        style={{
          height: 44,
          boxSizing: 'border-box',
          borderRadius: 'var(--radius-md)',
          border: `${focused ? 2 : 1}px solid ${focused ? 'var(--color-ink)' : 'var(--color-hairline-strong)'}`,
          background: 'var(--color-surface-card)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <input
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          value={value}
          onChange={onChange}
          style={{
            minWidth: 0,
            flex: 1,
            alignSelf: 'stretch',
            padding: '0 8px 0 16px',
            border: 0,
            outline: 0,
            fontSize: 'var(--text-body-md-size)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-ink)',
            background: 'transparent',
          }}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          style={{
            width: 44,
            alignSelf: 'stretch',
            flexShrink: 0,
            border: 0,
            padding: 0,
            background: 'transparent',
            color: 'var(--color-body)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </label>
  );
}

// Searchable district combobox. Typing narrows the list beneath the field;
// the arrow still opens the complete district list.
function DistrictCombobox({ query, value, onQueryChange, onSelect }) {
  const [focused, setFocused] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef(null);
  const optionRefs = React.useRef([]);
  const listId = React.useId();
  const normalizedQuery = normalizeSearch(query);
  const matches = React.useMemo(() => {
    if (showAll || !normalizedQuery) return ALL_DISTRICTS;
    return ALL_DISTRICTS
      .map((district, originalIndex) => ({
        district,
        originalIndex,
        score: districtSearchScore(district, normalizedQuery),
      }))
      .filter((result) => result.score != null)
      .sort((a, b) => a.score - b.score || a.originalIndex - b.originalIndex)
      .map((result) => result.district);
  }, [normalizedQuery, showAll]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  React.useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, showAll]);

  const choose = (district) => {
    onSelect(district);
    setOpen(false);
    setShowAll(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(0);
      } else if (matches.length) {
        setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, matches.length - 1));
      } else if (matches.length) {
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
    } else if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setShowAll(false);
    }
  };

  return (
    <div
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setOpen(false);
          setShowAll(false);
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          height: 44,
          boxSizing: 'border-box',
          borderRadius: 'var(--radius-md)',
          border: `${focused ? 2 : 1}px solid ${focused ? 'var(--color-ink)' : 'var(--color-hairline-strong)'}`,
          background: 'var(--color-surface-card)',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="School district"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Choose or search for your school district"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setShowAll(false);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={{
            minWidth: 0,
            flex: 1,
            alignSelf: 'stretch',
            padding: '0 4px 0 12px',
            border: 0,
            outline: 0,
            fontSize: 'var(--text-body-md-size)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-ink)',
            background: 'transparent',
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear district search"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onQueryChange('');
              setShowAll(false);
              setOpen(true);
              setActiveIndex(0);
              inputRef.current?.focus();
            }}
            style={{
              width: 36,
              alignSelf: 'stretch',
              flexShrink: 0,
              border: 0,
              padding: 0,
              background: 'transparent',
              color: 'var(--color-body)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <XIcon size={16} />
          </button>
        )}
        <button
          type="button"
          aria-label={open ? 'Close district list' : 'Open district list'}
          aria-expanded={open}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open && showAll) {
              setOpen(false);
              setShowAll(false);
            } else {
              const selectedIndex = ALL_DISTRICTS.findIndex((district) => district.domain === value);
              setShowAll(true);
              setOpen(true);
              setActiveIndex(Math.max(0, selectedIndex));
            }
            inputRef.current?.focus();
          }}
          style={{
            width: 42,
            alignSelf: 'stretch',
            flexShrink: 0,
            border: 0,
            padding: 0,
            background: 'transparent',
            color: 'var(--color-ink)',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              width: 8,
              height: 8,
              borderRight: '1.5px solid currentColor',
              borderBottom: '1.5px solid currentColor',
              transform: `rotate(${open ? '225deg' : '45deg'})`,
              transition: 'transform 150ms ease',
              marginTop: open ? 5 : -5,
            }}
          />
        </button>
      </div>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Matching school districts"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            maxHeight: 280,
            overflowY: 'auto',
            padding: 6,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-hairline-strong)',
            background: 'var(--color-surface-dark-elevated)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
          }}
        >
          {matches.length ? matches.map((district, index) => {
            const active = index === activeIndex;
            const selected = district.domain === value;
            return (
              <button
                id={`${listId}-option-${index}`}
                ref={(element) => { optionRefs.current[index] = element; }}
                key={`${district.domain}-${district.name}`}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(district)}
                style={{
                  width: '100%',
                  border: 0,
                  borderRadius: 'var(--radius-sm)',
                  padding: '9px 10px',
                  background: active || selected ? 'var(--color-surface-card)' : 'transparent',
                  color: 'var(--color-ink)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: selected ? 600 : 400 }}>
                  {district.name}
                </span>
                <span style={{ color: 'var(--color-muted)', fontSize: 12, flexShrink: 0 }}>
                  {district.state}
                </span>
              </button>
            );
          }) : (
            <div
              role="option"
              aria-disabled="true"
              style={{ padding: '12px 10px', color: 'var(--color-body)', fontSize: 14 }}
            >
              No matching school districts
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const signIn = useSignIn();
  // If an automatic sign-in just died, say why and prefill the non-secret
  // fields - the student only re-enters the password.
  const [notice] = React.useState(() => recallAuthNotice());
  const [username, setUsername] = React.useState(notice ? notice.username || '' : '');
  const [password, setPassword] = React.useState('');
  const [domainText, setDomainText] = React.useState(notice ? notice.domain || '' : '');
  const [districtQuery, setDistrictQuery] = React.useState(() => {
    const savedDomain = extractPortalDomain(notice ? notice.domain || '' : '');
    return savedDomain ? DISTRICT_BY_DOMAIN.get(savedDomain)?.name || '' : '';
  });
  const [agreed, setAgreed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  // Live sign-in progress: null | 'signingIn' | 'syncing'. Set the instant
  // the button is clicked so there is immediate feedback, then advanced by
  // the provider as each real phase starts.
  const [stage, setStage] = React.useState(null);
  // The portal can be slow at busy times; after a few seconds of connecting,
  // say so instead of looking frozen.
  const [slow, setSlow] = React.useState(false);

  React.useEffect(() => {
    if (stage !== 'signingIn') {
      setSlow(false);
      return undefined;
    }
    const timer = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(timer);
  }, [stage]);
  const [error, setError] = React.useState(
    notice
      ? 'Your saved sign-in stopped working. StudentVUE rejected it, usually after a password change. Enter your password to sign back in.'
      : '',
  );

  // Already signed in (saved sign-in or live session) - the dashboard is where
  // this account belongs; the form is for connecting a different one, which
  // starts with signing out.
  React.useEffect(() => {
    if (!notice && hasToken()) navigate('/dashboard', { replace: true });
  }, [navigate, notice]);

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
    setStage('signingIn');
    setError('');
    try {
      await signIn({ username, password, domain }, setStage);
      navigate('/dashboard');
    } catch (e) {
      setError(e && e.message ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setPending(false);
      setStage(null);
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

      <BackButton to="/" label="Back to home" />

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
          {/* Wordmark (no logomark exists in the system - plain wordmark per
              brand). Clicks back out to the landing page. */}
          <div
            onClick={() => navigate('/')}
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.4px',
              color: 'var(--color-ink)',
              textAlign: 'center',
              marginBottom: 20,
              cursor: 'pointer',
            }}
          >
            Scoremap
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
            Log in to Scoremap
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-body)',
              textAlign: 'center',
              marginBottom: 40,
            }}
          >
            Never used Scoremap before?{' '}
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
              <PasswordInput
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
                Scoremap pulls info from StudentVUE directly from inside your browser; none of
                your info is ever saved, your password is encrypted, and our relay passes data
                blind.
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
              <DistrictCombobox
                query={districtQuery}
                value={selectedDistrict}
                onQueryChange={(nextQuery) => {
                  setDistrictQuery(nextQuery);
                  setDomainText('');
                }}
                onSelect={(district) => {
                  setDistrictQuery(district.name);
                  setDomainText(district.domain);
                }}
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
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const nextDomain = extractPortalDomain(nextValue);
                    setDomainText(nextValue);
                    setDistrictQuery(nextDomain ? DISTRICT_BY_DOMAIN.get(nextDomain)?.name || '' : '');
                  }}
                />
                <div
                  style={{
                    fontSize: 14,
                    color: 'var(--color-body)',
                    lineHeight: 1.5,
                    marginTop: 8,
                  }}
                >
                  Any web address from your StudentVUE portal works.
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
                I understand that Scoremap is an independent, unofficial tool and is not affiliated with
                or endorsed by Edupoint Educational Systems LLC. Use of StudentVUE is subject to Edupoint
                Educational Systems LLC's terms of service, and I am responsible for ensuring my use
                complies with those terms.
              </span>
            </label>

            {error && (
              <div
                role="alert"
                className="gm-fade-in"
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

            {/* live progress - appears the instant the button is clicked and
                tracks the real phases, so the wait never looks frozen */}
            {stage && (
              <div
                role="status"
                className="gm-fade-in"
                style={{
                  textAlign: 'center',
                  fontSize: 14,
                  color: 'var(--color-body)',
                  lineHeight: 1.5,
                  marginTop: -8,
                }}
              >
                {stage === 'signingIn'
                  ? slow
                    ? 'Still connecting… the school portal can be slow at busy times.'
                    : 'Connecting to StudentVUE and signing you in…'
                  : 'Signed in ✓ Loading your grades…'}
              </div>
            )}
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
        StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Scoremap is not
        affiliated with or endorsed by Edupoint Educational Systems LLC.
      </div>
    </div>
  );
}

export default Login;
