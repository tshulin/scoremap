// Small shared UI bits + formatters for the class page and its dialogs.
import React from 'react';

export const fmt2 = (n) => String(Math.round(n * 100) / 100);
export const signed = (n) => `${n >= 0 ? '+' : ''}${fmt2(n)}%`;

// Category name → chip tone. Real portal categories vary by teacher
// ("Tests", "Assessments", "Homework", …), so tone is a keyword match.
export const assessmentLike = (type) => /test|exam|assess|quiz|final/i.test(type);

export const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Wednesday, 3/4/2026" — chart tooltip format.
export const weekdayDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${m}/${d}/${y}`;
};

// Local calendar date — toISOString() is UTC and flips to tomorrow in the
// evening (US timezones), which would misplace added assignments on the chart.
export const todayIso = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export function Chip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { background: 'var(--color-surface-strong)', border: '1px solid var(--color-hairline)', color: 'var(--color-body)' },
    assignment: { background: 'var(--color-tint-good)', border: '1px solid transparent', color: 'var(--color-grade-good)' },
    assessment: { background: 'var(--color-tint-bad)', border: '1px solid transparent', color: 'var(--color-grade-bad)' },
    info: { background: 'var(--color-tint-accent)', border: '1px solid transparent', color: 'var(--color-text-link)' },
    warn: { background: 'var(--color-tint-mid)', border: '1px solid transparent', color: 'var(--color-grade-mid)' },
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, lineHeight: 1.2, ...tones[tone] }}>
      {children}
    </span>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 15, color: 'var(--color-ink)' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}

export function ScoreInput({ value, placeholder, onChange, label, width = 64 }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min="0"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width,
        padding: '6px 8px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-surface-strong)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
        fontWeight: 600,
        textAlign: 'right',
      }}
    />
  );
}

// Plain fixed-position overlay — no portal, no library (per the plan). The
// backdrop click and the ✕ both close; content clicks stay inside.
export function Dialog({ title, onClose, children, maxWidth = 720 }) {
  return (
    <div
      onClick={onClose}
      className="gm-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="gm-pop-in"
        role="dialog"
        aria-label={title}
        style={{
          background: 'var(--color-surface-card)',
          border: '1px solid var(--color-hairline-strong)',
          borderRadius: 'var(--radius-xl)',
          padding: '20px 24px 24px',
          width: '100%',
          maxWidth,
          maxHeight: '85vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-ink)' }}>{title}</div>
          <button
            onClick={onClose}
            aria-label={`Close ${title}`}
            style={{ border: 'none', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Secondary pill button (dialog openers, small actions).
export function PillButton({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-surface-card)',
        color: 'var(--color-text-pill)',
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function TextInputSmall({ value, placeholder, onChange, label, width = 220 }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width,
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-surface-strong)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
      }}
    />
  );
}
