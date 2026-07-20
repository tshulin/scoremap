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

export function Chip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: { background: 'var(--color-surface-strong)', border: '1px solid var(--color-hairline)', color: 'var(--color-body)' },
    assignment: { background: 'rgba(0, 201, 80, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-good)' },
    assessment: { background: 'rgba(251, 44, 54, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-bad)' },
    info: { background: 'rgba(77, 168, 255, 0.14)', border: '1px solid transparent', color: 'var(--color-text-link)' },
    warn: { background: 'rgba(240, 177, 0, 0.14)', border: '1px solid transparent', color: 'var(--color-grade-mid)' },
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
