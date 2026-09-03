import React from 'react';

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  type = 'button',
}) {
  const [hover, setHover] = React.useState(false);
  const variants = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      borderColor: 'var(--color-primary)',
    },
    secondary: {
      background: 'var(--color-surface-card)',
      color: 'var(--color-ink)',
      borderColor: 'var(--color-hairline-strong)',
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--color-text-link)',
      borderColor: 'transparent',
      padding: 0,
      height: 'auto',
    },
    nav: {
      background: 'transparent',
      color: 'var(--color-ink)',
      borderColor: 'transparent',
      padding: 0,
      height: 'auto',
    },
  };
  const hoverStyle = !disabled && hover
    ? variant === 'primary'
      ? { background: 'var(--color-primary-active)', borderColor: 'var(--color-primary-active)' }
      : variant === 'secondary'
        ? { borderColor: 'var(--color-ink)' }
        : { textDecoration: 'underline' }
    : {};

  return React.createElement('button', {
    type,
    disabled,
    onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-button-size)',
      fontWeight: 'var(--text-button-weight)',
      lineHeight: 'var(--text-button-leading)',
      borderRadius: variant === 'tertiary' || variant === 'nav' ? 0 : 'var(--radius-pill)',
      border: '1px solid transparent',
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
      padding: size === 'sm' ? '8px 14px' : '10px 18px',
      height: size === 'sm' ? 34 : 40,
      boxSizing: 'border-box',
      ...variants[variant],
      ...hoverStyle,
    },
  }, children);
}

export function FeatureCard({ title, children, dark = false }) {
  const [hover, setHover] = React.useState(false);
  return React.createElement('div', {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: dark ? 'var(--color-surface-dark)' : 'var(--color-surface-card)',
      color: dark ? 'var(--color-on-dark)' : 'var(--color-ink)',
      border: dark ? 'none' : '1px solid var(--color-hairline-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)',
      boxShadow: hover ? 'var(--shadow-soft-drop)' : 'none',
      transition: 'box-shadow 150ms ease',
    },
  },
  React.createElement('div', {
    style: { fontSize: 'var(--text-title-md-size)', fontWeight: 600, marginBottom: 8 },
  }, title),
  React.createElement('div', {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: dark ? 'var(--color-on-dark-soft)' : 'var(--color-body)',
      lineHeight: 1.5,
    },
  }, children));
}

export function HeroBand({ eyebrow, headline, subhead, cta, mockup }) {
  return React.createElement('div', {
    style: {
      background: 'var(--color-canvas)',
      padding: '96px 32px 64px',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)',
    },
  },
  eyebrow && React.createElement('div', {
    style: { marginBottom: 24, display: 'flex', justifyContent: 'center' },
  }, eyebrow),
  React.createElement('div', {
    style: {
      fontSize: 'clamp(32px, 6vw, var(--text-display-mega-size))',
      fontWeight: 'var(--text-display-mega-weight)',
      letterSpacing: 'var(--text-display-mega-tracking)',
      lineHeight: 'var(--text-display-mega-leading)',
      color: 'var(--color-ink)',
      maxWidth: 720,
      margin: '0 auto 20px',
    },
  }, headline),
  React.createElement('div', {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--color-body)',
      maxWidth: 480,
      margin: '0 auto 32px',
      lineHeight: 1.5,
    },
  }, subhead),
  React.createElement('div', { style: { marginBottom: 56 } }, cta),
  mockup);
}
