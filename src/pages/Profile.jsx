import React from 'react';
import Sidebar from '../components/Sidebar.jsx';
import { useSession } from '../data/SyncProvider.jsx';
import { PersonIcon } from '../lib/icons.jsx';

const STORAGE_KEY = 'scoremap-profile-feature-toggles-v1';
const DEFAULT_TOGGLES = {
  featurePreview: false,
  compactView: false,
  extraInsights: false,
};

const loadToggles = () => {
  try {
    return { ...DEFAULT_TOGGLES, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return DEFAULT_TOGGLES;
  }
};

function FeatureToggle({ checked, description, label, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 24,
        padding: '20px 0',
        borderTop: '1px solid var(--color-hairline)',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ color: 'var(--color-ink)', fontSize: 15, fontWeight: 600 }}>{label}</div>
        <div style={{ marginTop: 5, color: 'var(--color-body)', fontSize: 13, lineHeight: 1.5 }}>
          {description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: 44,
          height: 26,
          flexShrink: 0,
          padding: 0,
          border: '1px solid var(--color-hairline-strong)',
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--color-grade-good)' : 'var(--color-surface-strong)',
          cursor: 'pointer',
          transition: 'background 150ms ease, border-color 150ms ease',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: checked ? '#fff' : 'var(--color-body)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.22)',
            transition: 'left 150ms ease, background 150ms ease',
          }}
        />
      </button>
    </div>
  );
}

export default function Profile() {
  const session = useSession();
  const [toggles, setToggles] = React.useState(loadToggles);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
    } catch {
      // Preferences remain usable for this session when storage is unavailable.
    }
  }, [toggles]);

  const updateToggle = (key, value) => setToggles((current) => ({ ...current, [key]: value }));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '48px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 760, margin: '0 auto' }}>
          <header style={{ marginBottom: 28 }}>
            <h1 style={{ margin: '0 0 8px', color: 'var(--color-ink)', fontSize: 30, fontWeight: 600, letterSpacing: '-0.7px' }}>
              Profile
            </h1>
            <p style={{ margin: 0, color: 'var(--color-body)', fontSize: 15, lineHeight: 1.6 }}>
              Manage your Scoremap profile and preferences.
            </p>
          </header>

          <section
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 24,
              marginBottom: 20,
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'var(--color-avatar-bg)',
                border: '1px solid var(--color-hairline-strong)',
                color: 'var(--color-body)',
              }}
            >
              <PersonIcon size={22} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', color: 'var(--color-ink)', fontSize: 20, fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {session.studentName || 'Scoremap student'}
              </div>
              <div style={{ marginTop: 4, color: 'var(--color-body)', fontSize: 13 }}>
                Grade {session.grade || '—'}
              </div>
            </div>
          </section>

          <section
            style={{
              padding: '4px 24px',
              background: 'var(--color-surface-card)',
              border: '1px solid var(--color-hairline-strong)',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div style={{ padding: '20px 0 16px' }}>
              <h2 style={{ margin: 0, color: 'var(--color-ink)', fontSize: 18, fontWeight: 600, letterSpacing: '-0.25px' }}>
                Feature preferences
              </h2>
              <p style={{ margin: '6px 0 0', color: 'var(--color-body)', fontSize: 13, lineHeight: 1.5 }}>
                These are placeholder controls for features added later.
              </p>
            </div>
            <FeatureToggle
              label="Feature preview"
              description="Try upcoming Scoremap features when they become available."
              checked={toggles.featurePreview}
              onChange={(value) => updateToggle('featurePreview', value)}
            />
            <FeatureToggle
              label="Compact view"
              description="Reserve a preference for a denser page layout."
              checked={toggles.compactView}
              onChange={(value) => updateToggle('compactView', value)}
            />
            <FeatureToggle
              label="Extra insights"
              description="Reserve a preference for additional grade insights."
              checked={toggles.extraInsights}
              onChange={(value) => updateToggle('extraInsights', value)}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
