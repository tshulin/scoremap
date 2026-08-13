/**
 * Landing - Scoremap marketing homepage.
 *
 * React component. Composes the Scoremap design-system components, which are
 * published on `window.ScoremapDesignSystem_faa73b` by the design-system
 * bundle (`_ds/.../_ds_bundle.js`). In a real React codebase these would be
 * replaced by named imports from the design-system package, e.g.
 *   import { TopNav, HeroBand, Button, ... } from '@grademax/design-system';
 *
 * The hero shows a slideshow of real product screenshots (the display
 * account, captured by scripts - see public/landing/): rounded frameless
 * captures standing upright on a 3D ring, faces outward, so the facing slide
 * is head-on with its neighbors slanting away at either side. The ring
 * rotates between slides, with a caption underneath explaining each one.
 * Dark and light captures both ship; the slideshow serves whichever matches
 * the visitor's theme.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeroBand, Button,
  FeatureCard,
} from '../lib/ds.js';
import PrivacyDialog from '../components/PrivacyDialog.jsx';
import { hasToken } from '../data/api.js';
import { useSignIn } from '../data/SyncProvider.jsx';
import { TEST_DISTRICT } from '../data/testAccount.js';
import { DISPLAY_USERNAME, DISPLAY_PASSWORD } from '../data/displayAccount.js';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, MoonIcon, SunIcon } from '../lib/icons.jsx';

// One entry per screenshot in public/landing/ ({key}-dark.png / {key}-light.png).
const SLIDES = [
  {
    key: 'dashboard',
    title: 'Every class at a glance',
    text: 'Detailed percentages, letter grades, and color coded progress for every class, straight from StudentVUE. Know the second a grade has changed and never be surprised again.',
  },
  {
    key: 'hypothetical',
    title: 'Hypothetical mode',
    text: "What would my grade be after this test? Find out using hypothetical mode. Scoremap's hypothetical calculator is 100% accurate and allows you to add finals, exams, assignments, even extra credit. Learn exactly how much each and every assignment is impacting your grade.",
  },
  {
    key: 'overview',
    title: 'Category overview',
    text: 'Most classes have categories. See the trend in your grade in all of these categories to find what you need to improve on and how much the category is impacting your final grade.',
  },
  {
    key: 'documents',
    title: 'Documents',
    text: 'No StudentVUE clutter. See a simplified document center with all report cards, transcripts, test reports, right from your browser.',
  },
  {
    key: 'mail',
    title: 'School mail',
    text: "Clean. Scoremap's mailbox focuses on usability. We removed all the StudentVUE bloat so you can see what you need to see. Filter through sender and mail subject.",
  },
  {
    key: 'gpa',
    title: 'GPA calculator',
    text: 'Calculate your GPA for the semester. No need to manually type in your grades, use our import grade feature to immediately see your GPA.',
  },
  {
    key: 'attendance',
    title: 'Attendance calendar',
    text: 'Absences, tardies, and school activities on a calendar, organized and color coded.',
  },
];

const SLIDE_INTERVAL_MS = 5000;

const SLIDE_W = 800; // the facing slide
// Side panels display at exactly the facing slide's height, so the trio
// reads as one ring seen from its center.
const SIDE_H = Math.round((SLIDE_W * 950) / 1440);

// The hero visual: the facing screenshot head-on with its two neighbors
// slanting away, blurred, at either side - with the active slide's caption
// underneath. Advances on a timer, pauses while hovered, and can be driven
// by the arrows or dots.
//
// The side panels are PRE-BAKED PNGs ({key}-{theme}-left/right.png, made by
// a capture script): the perspective tilt, the outer-edge fade-out, and the
// rounded border are rendered once into the file, so the live page
// composites three plain images - no 3D transforms or filters taxing the GPU.
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
        for (const suffix of ['', '-left', '-right']) {
          const img = new Image();
          img.src = `${base}landing/${s.key}-${theme}${suffix}.png`;
        }
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
          <img
            src={`${base}landing/${leftSlide.key}-${theme}-left.png`}
            alt=""
            aria-hidden="true"
            style={{ height: SIDE_H, width: 'auto', flexShrink: 0 }}
          />
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
          <img
            src={`${base}landing/${rightSlide.key}-${theme}-right.png`}
            alt=""
            aria-hidden="true"
            style={{ height: SIDE_H, width: 'auto', flexShrink: 0 }}
          />
        </div>
      </div>
      {/* caption + controls */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          <button
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
            style={arrowStyle}
          >
            {theme === 'dark' ? <SunIcon size={15} /> : <MoonIcon size={15} />}
          </button>
        </div>
        {/* fixed-height caption well - swapping slides must not shift the page */}
        <div style={{ minHeight: 132, textAlign: 'center' }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 8 }}>
            {active.title}
          </div>
          <div style={{ fontSize: 16, color: 'var(--color-body)', lineHeight: 1.55, maxWidth: 680, margin: '0 auto' }}>
            {active.text}
          </div>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [privacyOpen, setPrivacyOpen] = React.useState(false);
  // The footer's compact privacy note, expandable to the full explanation.
  const [privacyExpanded, setPrivacyExpanded] = React.useState(false);

  // A saved sign-in skips the pitch - straight to the grades.
  React.useEffect(() => {
    if (hasToken()) navigate('/dashboard', { replace: true });
  }, [navigate]);

  const go = (path) => () => { navigate(path); };

  // Demo mode = the built-in display account (Hisori Gotou): instant, no
  // credentials, and the same clean pages the landing screenshots show. Goes
  // through the provider's signIn (like the login page) so the first sync
  // fires.
  const tryDemo = async () => {
    try {
      await signIn({ domain: TEST_DISTRICT.domain, username: DISPLAY_USERNAME, password: DISPLAY_PASSWORD });
      navigate('/dashboard');
    } catch {
      navigate('/login');
    }
  };

  return (
    <div style={{ background: 'var(--color-canvas)' }}>
      <HeroBand
        eyebrow={
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: 'var(--color-ink)' }}>
            Scoremap
          </div>
        }
        headline="The smarter way to see your grades."
        subhead="Scoremap reads your StudentVUE data and tells you what you actually need to know."
        cta={
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* grid tracks stretch their items, so both buttons get the same
                generous width no matter their label */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: 360, maxWidth: '90vw' }}>
              <Button variant="secondary" onClick={go('/login')}>Log in</Button>
              <Button variant="primary" onClick={go('/signup')}>Sign up</Button>
            </div>
            <button
              onClick={tryDemo}
              style={{
                border: 'none',
                background: 'transparent',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                color: 'var(--color-text-link)',
              }}
            >
              Try demo mode
            </button>
          </div>
        }
        mockup={<ShowcaseCarousel />}
      />

      {/* current works in progress */}
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '16px 32px 64px' }}>
        <div
          style={{
            textAlign: 'center',
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: '-0.5px',
            color: 'var(--color-ink)',
            marginBottom: 28,
          }}
        >
          Currently in the works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 880, margin: '0 auto' }}>
          <FeatureCard title="Cumulative GPA Calculator">
            <div style={{ fontStyle: 'italic', color: 'var(--color-muted)', marginBottom: 10 }}>Started: 7/11/2026</div>
            Want to calculate your cumulative GPA? Scoremap will parse your grades from any selected
            transcript, and calculate your cumulative GPA for different colleges. Save yourself from the
            hassle of manually typing out each individual grade.
          </FeatureCard>
          <FeatureCard title="Scoremap Extension">
            <div style={{ fontStyle: 'italic', color: 'var(--color-muted)', marginBottom: 10 }}>Started: 8/2/2026</div>
            Scoremap inside a browser's toolbar. Be notified when a grade changes, skip the loading queue
            and see your grades instantly. An extension will give us a lot more flexibility as well as the
            user a lot more versatility.
          </FeatureCard>
        </div>
        <div style={{ textAlign: 'center', marginTop: 32, fontSize: 15, color: 'var(--color-body)' }}>
          Have feedback or suggestions? Email us at{' '}
          <a href="mailto:contact@scoremap.org">contact@scoremap.org</a>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-hairline)',
          padding: '32px',
          fontSize: 'var(--text-caption-size)',
          color: 'var(--color-muted)',
        }}
      >
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span>© 2026 Scoremap. Not affiliated with Edupoint or StudentVUE.</span>
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
              <span style={{ color: 'var(--color-body)' }}>Private by design.</span>
              Your info is only viewed by you and StudentVUE.
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
                Your password, login info, and data are only viewable by StudentVUE and you. Everything is
                encrypted, and thus only viewable by the StudentVUE API and your browser. Nothing is saved,
                logged, or decrypted.{' '}
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
      </div>

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}

export default Landing;
