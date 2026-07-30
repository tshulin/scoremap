/**
 * Landing — Grademax marketing homepage.
 *
 * React component. Composes the Grademax design-system components, which are
 * published on `window.GrademaxDesignSystem_faa73b` by the design-system
 * bundle (`_ds/.../_ds_bundle.js`). In a real React codebase these would be
 * replaced by named imports from the design-system package, e.g.
 *   import { TopNav, HeroBand, Button, ... } from '@grademax/design-system';
 *
 * Loaded in the browser preview via <script type="text/babel" src>, so it
 * attaches itself to `window.Landing` at the bottom of the file instead of
 * using `export default`. Under a bundler (Vite/webpack), delete the
 * `window.Landing = Landing` line and add `export default Landing`.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TopNav, HeroBand, BrowserMockup, Button, Badge,
  FeatureCard,
} from '../lib/ds.js';
import PrivacyDialog from '../components/PrivacyDialog.jsx';

function Landing() {
  const navigate = useNavigate();
  const [privacyOpen, setPrivacyOpen] = React.useState(false);

  function DashboardPreview() {
    const rows = [
      { name: 'AP Biology', pct: '94.2%', grade: 'A' },
      { name: 'Algebra II', pct: '88.6%', grade: 'B+' },
      { name: 'World History', pct: '76.1%', grade: 'C' },
      { name: 'Chemistry', pct: '91.0%', grade: 'A−' },
    ];
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', marginBottom: 12 }}>DASHBOARD</div>
        {rows.map((r) => (
          <div
            key={r.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '1px solid var(--color-hairline)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-ink)' }}>{r.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--color-body)' }}>{r.pct}</span>
              <Badge tone="grade" grade={r.grade} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const go = (path) => () => { navigate(path); };

  return (
    <div style={{ background: 'var(--color-canvas)' }}>
      <TopNav
        links={[]}
        rightSlot={
          <>
            <Button variant="nav" onClick={go('/login')}>Sign in</Button>
            <Button variant="primary" size="sm" onClick={go('/signup')}>Get started</Button>
          </>
        }
      />
      <HeroBand
        eyebrow={<Badge tone="outline">Built for StudentVUE</Badge>}
        headline="The smarter way to see your grades."
        subhead="Grademax reads your StudentVUE data and tells you what you actually need to know."
        cta={<Button variant="primary" onClick={go('/login')}>Connect StudentVUE</Button>}
        mockup={
          <BrowserMockup>
            <DashboardPreview />
          </BrowserMockup>
        }
      />

      {/* 2×2 feature card grid — below the dashboard mockup preview */}
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '0 32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <FeatureCard title="Grade chart">
            See how your grade has changed over time — per-assignment impact, category breakdown, and new assignment tracking as scores post.
          </FeatureCard>
          <FeatureCard title="Grade calculator">
            A hypothetical "what-if" mode: simulate scores and calculate exactly what you need on upcoming assignments or the final.
          </FeatureCard>
          <FeatureCard title="Attendance &amp; more">
            Daily attendance breakdown, missed periods, report cards, documents, and mail — all in one place.
          </FeatureCard>
          <FeatureCard title="Private login">
            Your password, login info, and grades are only seen by StudentVUE and you.{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setPrivacyOpen(true);
              }}
            >
              Learn more ↗
            </a>
          </FeatureCard>
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
          © 2026 Grademax. Not affiliated with Edupoint or StudentVUE.
        </div>
      </div>

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}

export default Landing;
