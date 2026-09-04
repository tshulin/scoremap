/**
 * Landing - Scoremap marketing homepage.
 *
 * React component composed from the local interface primitives.
 *
 * The hero shows a slideshow of fictional demo screenshots from public/landing/:
 * rounded frameless
 * captures standing upright on a 3D ring, faces outward, so the facing slide
 * is head-on with its neighbors slanting away at either side. The ring
 * rotates between slides, with the active slide's title underneath.
 * Dark and light captures both ship; the slideshow serves whichever matches
 * the visitor's theme.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeroBand, Button,
  FeatureCard,
} from '../lib/ds.js';
import PrivacyDialog from '../components/PrivacyDialog.jsx';
import ScoremapWordmark from '../components/ScoremapWordmark.jsx';
import { hasDemo } from '../data/api.js';
import { useOpenDemo } from '../data/SyncProvider.jsx';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, GitHubIcon, MoonIcon, SunIcon } from '../lib/icons.jsx';

const GITHUB_REPO_URL = 'https://github.com/tshulin/scoremap';

// One entry per screenshot in public/landing/ ({key}-dark.png / {key}-light.png).
const SLIDES = [
  {
    key: 'dashboard',
    title: 'Every Class at a Glance',
  },
  {
    key: 'hypothetical',
    title: 'Hypothetical Mode',
  },
  {
    key: 'overview',
    title: 'Category Overview',
  },
  {
    key: 'documents',
    title: 'Documents',
  },
  {
    key: 'mail',
    title: 'School Mail',
  },
  {
    key: 'gpa',
    title: 'GPA Calculator',
  },
  {
    key: 'attendance',
    title: 'Attendance Calendar',
  },
];

const SLIDE_INTERVAL_MS = 5000;

const SLIDE_W = 800; // the facing slide
// Side panels display at exactly the facing slide's height, so the trio
// reads as one ring seen from its center.
const SIDE_H = Math.round((SLIDE_W * 950) / 1440);

// The hero visual: the facing screenshot head-on with its two neighbors
// slanting away, blurred, at either side - with the active slide's title
// underneath. Advances on a timer, pauses while hovered, and can be driven
// by the arrows or dots.
//
// Side panels reuse the same sanitized fictional screenshots as the center.
function ShowcaseCarousel() {
  // Monotonic, deliberately never wrapped: the angle just keeps growing, so
  // the ring always turns the direction you asked instead of unwinding.
  const [index, setIndex] = React.useState(0);
  // Which way the last change turned, so the turn-in animation matches.
  const [dir, setDir] = React.useState(1);
  const [paused, setPaused] = React.useState(false);
  // Auto-advance stops for good once the visitor scrolls down a bit - a
  // hero that keeps changing mid-read is an interruption, not a feature.
  // The arrows and dots keep working.
  const [autoOff, setAutoOff] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 160) setAutoOff(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The landing page renders before any sign-in, so the stored theme is the
  // only signal; captures exist for both. State (not a plain read) so the
  // gallery re-renders with the matching captures when the toggle flips it.
  const [theme, setTheme] = React.useState(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-theme') === 'light'
      ? 'light'
      : 'dark',
  );

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('grademax-theme', next);
    } catch {
      /* storage unavailable - the choice just won't persist */
    }
    setTheme(next);
  };

  React.useEffect(() => {
    if (paused || autoOff) return undefined;
    const timer = setInterval(() => {
      setDir(1);
      setIndex((i) => i + 1);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, autoOff]);

  const step = (delta) => {
    setDir(delta > 0 ? 1 : -1);
    setIndex((i) => i + delta);
  };
  const base = import.meta.env.BASE_URL || '/';
  const activeIndex = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;
  const active = SLIDES[activeIndex];

  const arrowStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--color-hairline-strong)',
    background: 'var(--color-surface-card)',
    color: 'var(--color-body)',
    cursor: 'pointer',
    flexShrink: 0,
  };

  const n = SLIDES.length;
  const leftSlide = SLIDES[(activeIndex + n - 1) % n];
  const rightSlide = SLIDES[(activeIndex + 1) % n];

  // Warm the whole theme's image set shortly after mount, so every advance -
  // forward, back, or a dot jump - swaps between already-decoded images
  // instead of popping in as files arrive.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      for (const s of SLIDES) {
        const img = new Image();
        img.src = `${base}landing/${s.key}-${theme}.png`;
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [base, theme]);

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Safety clip only - the trio is sized to fit inside the viewport. */}
      <div style={{ overflow: 'hidden' }}>
        <div
          key={activeIndex}
          className={dir > 0 ? 'gm-turn-in-right' : 'gm-turn-in-left'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}
        >
          <button
            type="button"
            aria-label={`Show previous screenshot: ${leftSlide.title}`}
            onClick={() => step(-1)}
            style={{
              height: SIDE_H,
              width: 360,
              flexShrink: 0,
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <img
              src={`${base}landing/${leftSlide.key}-${theme}.png`}
              alt=""
              aria-hidden="true"
              draggable="false"
              style={{
                height: '100%',
                width: '100%',
                objectFit: 'cover',
                objectPosition: 'right center',
                display: 'block',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-hairline-strong)',
                opacity: 0.55,
                transform: 'perspective(900px) rotateY(18deg)',
                transformOrigin: 'right center',
              }}
            />
          </button>
          <img
            src={`${base}landing/${active.key}-${theme}.png`}
            alt={`Scoremap - ${active.title}`}
            style={{
              width: SLIDE_W,
              flexShrink: 0,
              aspectRatio: '1440 / 950',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-hairline-strong)',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            aria-label={`Show next screenshot: ${rightSlide.title}`}
            onClick={() => step(1)}
            style={{
              height: SIDE_H,
              width: 360,
              flexShrink: 0,
              padding: 0,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <img
              src={`${base}landing/${rightSlide.key}-${theme}.png`}
              alt=""
              aria-hidden="true"
              draggable="false"
              style={{
                height: '100%',
                width: '100%',
                objectFit: 'cover',
                objectPosition: 'left center',
                display: 'block',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-hairline-strong)',
                opacity: 0.55,
                transform: 'perspective(900px) rotateY(-18deg)',
                transformOrigin: 'left center',
              }}
            />
          </button>
        </div>
      </div>
      {/* title + controls */}
      <div className="gm-carousel-meta">
        <div className="gm-carousel-controls">
          <div className="gm-carousel-navigation">
            <button aria-label="Previous screenshot" onClick={() => step(-1)} style={arrowStyle}>
              <ChevronLeftIcon size={16} />
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {SLIDES.map((s, i) => (
                <button
                  key={s.key}
                  aria-label={`Show ${s.title}`}
                  onClick={() => {
                    // Shortest way around the ring to the chosen slide.
                    let delta = i - activeIndex;
                    if (delta > SLIDES.length / 2) delta -= SLIDES.length;
                    if (delta < -SLIDES.length / 2) delta += SLIDES.length;
                    if (delta !== 0) step(delta);
                  }}
                  style={{
                    width: 8,
                    height: 8,
                    padding: 0,
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    background: i === activeIndex ? 'var(--color-ink)' : 'var(--color-hairline-strong)',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>
            <button aria-label="Next screenshot" onClick={() => step(1)} style={arrowStyle}>
              <ChevronRightIcon size={16} />
            </button>
          </div>
          <button
            className="gm-carousel-theme"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            style={arrowStyle}
          >
            {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
        </div>
        <div className="gm-carousel-caption">
          <h3 style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-ink)', margin: 0 }}>
            {active.title}
          </h3>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const openDemo = useOpenDemo();
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  // The footer's compact privacy note, expandable to the full explanation.
  const [privacyExpanded, setPrivacyExpanded] = React.useState(false);

  // A saved demo skips the pitch - straight to the grades.
  React.useEffect(() => {
    if (hasDemo()) navigate('/dashboard', { replace: true });
  }, [navigate]);


  // The demo is the whole app now: the built-in display account, served from
  // fictional data bundled into the page. No external requests.
  const tryDemo = async () => {
    try {
      await openDemo('display');
      navigate('/dashboard');
    } catch {
      /* the sample account cannot fail to sign in; stay put if it somehow does */
    }
  };

  return (
    <main style={{ background: 'var(--color-canvas)' }}>
      {/* Service notice for the retired, fictional-data demo. */}
      <section
        style={{
          background: 'var(--color-surface-raised, rgba(127,127,127,0.10))',
          borderBottom: '1px solid var(--color-border, rgba(127,127,127,0.25))',
          padding: '18px 32px',
        }}
      >
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            lineHeight: 1.55,
            color: 'var(--color-ink)',
            textAlign: 'center',
          }}
        >
          <strong>Scoremap is no longer in service.</strong>{' '}
          Connections to external school systems have been permanently removed, and all
          related servers have been shut down. What remains is an offline demo using fictional data.
          <Link
            to="/shutdown"
            style={{
              display: 'block',
              width: 'fit-content',
              margin: '6px auto 0',
              color: 'inherit',
              fontWeight: 500,
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            Learn more
          </Link>
        </div>
      </section>

      <section style={{ position: 'relative' }}>
        <HeroBand
        eyebrow={
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)' }}>
            <ScoremapWordmark />
          </div>
        }
        headline={
          <h1 style={{ font: 'inherit', letterSpacing: 'inherit', color: 'inherit', margin: 0 }}>
            The smarter way to see your grades.
          </h1>
        }
        subhead={
          <p style={{ font: 'inherit', color: 'inherit', margin: 0 }}>
            A grade dashboard, kept online as a demonstration.
          </p>
        }
        cta={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* grid tracks stretch their items, so both buttons get the same
                generous width no matter their label */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, width: 360, maxWidth: '90vw' }}>
              <Button variant="primary" onClick={tryDemo}>Open the demo</Button>
            </div>
          </div>
        }
        mockup={<ShowcaseCarousel />}
        />
      </section>

      <section
        style={{
          maxWidth: 760,
          margin: '0 auto',
          padding: '12px 32px 56px',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.4px',
            color: 'var(--color-ink)',
          }}
        >
          Completely Open Source
        </h2>
        <p
          style={{
            margin: '0 auto 18px',
            maxWidth: 680,
            color: 'var(--color-body)',
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Scoremap is completely open source. You can inspect the retired interface, fictional
          datasets, and local grade calculations. Feel free to check it out.
        </p>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open Scoremap on GitHub"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--color-ink)',
            fontSize: 15,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <GitHubIcon size={19} />
          View on GitHub
        </a>
      </section>

      <footer
        style={{
          borderTop: '1px solid var(--color-hairline)',
          padding: '32px',
          fontSize: 'var(--text-caption-size)',
          color: 'var(--color-muted)',
        }}
      >
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>© 2026 Scoremap. Not affiliated with any school district, school information system, or vendor.</span>
            <button
              onClick={() => setPrivacyExpanded((v) => !v)}
              aria-expanded={privacyExpanded}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-caption-size)',
                color: 'var(--color-muted)',
                padding: 0,
              }}
            >
              <span style={{ color: 'var(--color-body)' }}>Fictional data only.</span>
              No external school-system connections.
              <span
                style={{
                  display: 'inline-flex',
                  transition: 'transform 200ms ease',
                  transform: privacyExpanded ? 'rotate(180deg)' : 'none',
                }}
              >
                <ChevronDownIcon size={14} />
              </span>
            </button>
          </div>
          {privacyExpanded && (
            <div className="gm-fade-in" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <div style={{ maxWidth: 520, color: 'var(--color-body)', lineHeight: 1.6 }}>
                This retired demo contains only fictional sample data bundled with the site. It has no sign-in
                and does not connect to an external school system.{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setPrivacyOpen(true);
                  }}
                >
                  Learn more.
                </a>
              </div>
            </div>
          )}
        </div>
      </footer>

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </main>
  );
}

export default Landing;
