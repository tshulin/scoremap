/* @ds-bundle: {"format":4,"namespace":"ScoremapDesignSystem_faa73b","components":[{"name":"Badge","sourcePath":"components/badges/Badge.jsx"},{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"FeatureCard","sourcePath":"components/cards/FeatureCard.jsx"},{"name":"TestimonialCard","sourcePath":"components/cards/TestimonialCard.jsx"},{"name":"WorkflowStepCard","sourcePath":"components/cards/WorkflowStepCard.jsx"},{"name":"TextInput","sourcePath":"components/forms/TextInput.jsx"},{"name":"BrowserMockup","sourcePath":"components/marketing/BrowserMockup.jsx"},{"name":"CtaBand","sourcePath":"components/marketing/CtaBand.jsx"},{"name":"Footer","sourcePath":"components/marketing/Footer.jsx"},{"name":"HeroBand","sourcePath":"components/marketing/HeroBand.jsx"},{"name":"TopNav","sourcePath":"components/navigation/TopNav.jsx"}],"sourceHashes":{"components/badges/Badge.jsx":"1356c07d57c5","components/buttons/Button.jsx":"10f890a5e477","components/cards/FeatureCard.jsx":"3f21983ba052","components/cards/TestimonialCard.jsx":"20d99a3da502","components/cards/WorkflowStepCard.jsx":"fdd114d5af4a","components/forms/TextInput.jsx":"520fde212dfc","components/marketing/BrowserMockup.jsx":"b7f25b5804a5","components/marketing/CtaBand.jsx":"27308dcc02d7","components/marketing/Footer.jsx":"7bc806996685","components/marketing/HeroBand.jsx":"c86bc78a886d","components/navigation/TopNav.jsx":"47f8fd5d958e","ui_kits/web-app/AppShell.jsx":"abbd8900f425","ui_kits/web-app/ClassDetail.jsx":"9936f950160e","ui_kits/web-app/Dashboard.jsx":"db805efd8316","ui_kits/web-app/Landing.jsx":"8280f9db38a8","ui_kits/web-app/Login.jsx":"0280ffe47fc4","ui_kits/web-app/WhatIfCalculator.jsx":"0cd06186b69b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.ScoremapDesignSystem_faa73b = window.ScoremapDesignSystem_faa73b || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/badges/Badge.jsx
try { (() => {
/**
 * Badge - small pill. `tone="neutral"` is the default surface-strong badge
 * (section labels, status chips). `tone="grade"` maps a letter grade to one
 * of three color bands for quick visual scanning: A+–A− green, B+–B− yellow,
 * C+ and below red.
 */
function gradeColor(grade) {
  const g = (grade || 'A').trim();
  const letter = g[0].toUpperCase();
  if (letter === 'A') return 'var(--color-grade-good)';
  if (letter === 'B') return 'var(--color-grade-mid)';
  return 'var(--color-grade-bad)';
}
function Badge({
  children,
  tone = 'neutral',
  grade
}) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 'var(--text-caption-uppercase-size)',
    fontWeight: 'var(--text-caption-uppercase-weight)',
    letterSpacing: 'var(--text-caption-uppercase-tracking)',
    textTransform: 'uppercase',
    borderRadius: 'var(--radius-pill)',
    padding: '4px 10px',
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
    flexShrink: 0
  };
  if (tone === 'grade') {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        ...base,
        background: gradeColor(grade),
        color: '#fff'
      }
    }, grade);
  }
  if (tone === 'outline') {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        ...base,
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        color: 'var(--color-body)',
        padding: '6px 14px'
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("span", {
    style: {
      ...base,
      background: 'var(--color-surface-strong)',
      color: 'var(--color-ink)'
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/badges/Badge.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
/**
 * Button - Scoremap's single CTA family.
 * variant: 'primary' | 'secondary' | 'tertiary' | 'nav'
 * size: 'md' | 'sm'
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  type = 'button'
}) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-button-size)',
    fontWeight: 'var(--text-button-weight)',
    lineHeight: 'var(--text-button-leading)',
    // Corrected to match real expo.dev reference screenshots: filled CTAs
    // (primary/secondary) are full pill shapes there, not the md/8px radius
    // originally specified. Tertiary stays plain text, no radius needed.
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
    boxSizing: 'border-box'
  };
  const variants = {
    primary: {
      background: 'var(--color-primary)',
      color: 'var(--color-on-primary)',
      borderColor: 'var(--color-primary)'
    },
    secondary: {
      background: 'var(--color-surface-card)',
      color: 'var(--color-ink)',
      borderColor: 'var(--color-hairline-strong)'
    },
    tertiary: {
      background: 'transparent',
      color: 'var(--color-text-link)',
      borderColor: 'transparent',
      padding: 0,
      height: 'auto'
    },
    nav: {
      background: 'transparent',
      color: 'var(--color-ink)',
      borderColor: 'transparent',
      padding: 0,
      height: 'auto'
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = !disabled && hover ? variant === 'primary' ? {
    background: 'var(--color-primary-active)',
    borderColor: 'var(--color-primary-active)'
  } : variant === 'secondary' ? {
    borderColor: 'var(--color-ink)'
  } : {
    textDecoration: 'underline'
  } : {};
  return /*#__PURE__*/React.createElement("button", {
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...variants[variant],
      ...hoverStyle
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/cards/FeatureCard.jsx
try { (() => {
/**
 * FeatureCard - flat card, hairline border, 12px radius. `dark` inverts to
 * the surface-dark fill for one featured card per section.
 */
function FeatureCard({
  title,
  children,
  dark = false
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
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
      transition: 'box-shadow 150ms ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-title-md-size)',
      fontWeight: 600,
      marginBottom: 8
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: dark ? 'var(--color-on-dark-soft)' : 'var(--color-body)',
      lineHeight: 1.5
    }
  }, children));
}
Object.assign(__ds_scope, { FeatureCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/FeatureCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/TestimonialCard.jsx
try { (() => {
/** TestimonialCard - quote card, flat, hairline-free (sits on canvas-soft). */
function TestimonialCard({
  quote,
  name,
  detail
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-card)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--color-ink)',
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, "\u201C", quote, "\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      fontWeight: 600,
      color: 'var(--color-ink)'
    }
  }, name), detail && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--color-muted)'
    }
  }, detail));
}
Object.assign(__ds_scope, { TestimonialCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/TestimonialCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/WorkflowStepCard.jsx
try { (() => {
/**
 * WorkflowStepCard - a step in a "how it works" row. 32px icon plate +
 * step number + label + body copy.
 */
function WorkflowStepCard({
  step,
  label,
  children,
  icon
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-card)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      boxSizing: 'border-box',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 'var(--radius-md)',
      background: 'var(--color-surface-strong)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--color-ink)',
      marginBottom: 14
    }
  }, icon || step), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--color-muted)',
      marginBottom: 4
    }
  }, "STEP ", step), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-title-sm-size)',
      fontWeight: 600,
      color: 'var(--color-ink)',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--color-body)',
      lineHeight: 1.5
    }
  }, children));
}
Object.assign(__ds_scope, { WorkflowStepCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/WorkflowStepCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextInput.jsx
try { (() => {
/**
 * TextInput - single-line text field. 44px height (AAA touch target),
 * hairline-strong border, thickens to 2px ink on focus.
 */
function TextInput({
  label,
  placeholder,
  error,
  disabled = false,
  type = 'text',
  value,
  onChange
}) {
  const [focused, setFocused] = React.useState(false);
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-title-sm-size)',
      fontWeight: 600,
      color: 'var(--color-ink)'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    disabled: disabled,
    value: value,
    onChange: onChange,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: {
      height: 44,
      padding: '12px 16px',
      boxSizing: 'border-box',
      borderRadius: 'var(--radius-md)',
      border: `${focused ? 2 : 1}px solid ${error ? 'var(--color-error)' : focused ? 'var(--color-ink)' : 'var(--color-hairline-strong)'}`,
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--color-ink)',
      background: disabled ? 'var(--color-canvas-soft)' : 'var(--color-surface-card)',
      outline: 'none',
      opacity: disabled ? 0.6 : 1
    }
  }), error && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-caption-size)',
      color: 'var(--color-error)'
    }
  }, error));
}
Object.assign(__ds_scope, { TextInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextInput.jsx", error: String((e && e.message) || e) }); }

// components/marketing/BrowserMockup.jsx
try { (() => {
/**
 * BrowserMockup - the brand's one recurring image motif: a plain browser-
 * chrome frame around a real Scoremap screen (used inside HeroBand). Not a
 * generic device bezel - flat, 16px radius, hairline border, no skeuomorphism.
 */
function BrowserMockup({
  children,
  width = 760
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      maxWidth: '100%',
      margin: '0 auto',
      background: 'var(--color-surface-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-hairline-strong)',
      boxShadow: 'var(--shadow-soft-drop)',
      overflow: 'hidden',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 36,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '0 14px',
      borderBottom: '1px solid var(--color-hairline)'
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: 'var(--color-hairline-strong)'
    }
  }))), /*#__PURE__*/React.createElement("div", null, children));
}
Object.assign(__ds_scope, { BrowserMockup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/BrowserMockup.jsx", error: String((e && e.message) || e) }); }

// components/marketing/CtaBand.jsx
try { (() => {
/** CtaBand - pre-footer band, centered display headline + one CTA. */
function CtaBand({
  headline,
  cta
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      padding: '96px 32px',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-lg-size)',
      fontWeight: 'var(--text-display-lg-weight)',
      letterSpacing: 'var(--text-display-lg-tracking)',
      lineHeight: 'var(--text-display-lg-leading)',
      color: 'var(--color-ink)',
      marginBottom: 28
    }
  }, headline), cta);
}
Object.assign(__ds_scope, { CtaBand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/CtaBand.jsx", error: String((e && e.message) || e) }); }

// components/marketing/Footer.jsx
try { (() => {
/** Footer - closing light footer, 5-column link list. */
function Footer({
  columns = []
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      borderTop: '1px solid var(--color-hairline)',
      padding: '64px 32px 48px',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, 1fr)`,
      gap: 32
    }
  }, columns.map(col => /*#__PURE__*/React.createElement("div", {
    key: col.title
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--color-ink)',
      marginBottom: 12
    }
  }, col.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, col.links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      fontSize: 'var(--text-body-sm-size)',
      color: 'var(--color-body)',
      textDecoration: 'none'
    }
  }, l)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '32px auto 0',
      paddingTop: 24,
      borderTop: '1px solid var(--color-hairline)',
      fontSize: 'var(--text-caption-size)',
      color: 'var(--color-muted)'
    }
  }, "\xA9 2026 Scoremap. Not affiliated with Edupoint or StudentVUE."));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/Footer.jsx", error: String((e && e.message) || e) }); }

// components/marketing/HeroBand.jsx
try { (() => {
/**
 * HeroBand - marketing hero. Flat black canvas (reference-corrected: no
 * gradient wash - the real expo.dev hero is completely flat), eyebrow pill,
 * white display headline + light-gray subhead + single primary CTA, then a
 * browser-window mockup of the actual Scoremap dashboard beneath it (the
 * brand's one recurring image motif - real product UI as chrome, not
 * illustration).
 */
function HeroBand({
  eyebrow,
  headline,
  subhead,
  cta,
  mockup
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)',
      padding: '96px 32px 64px',
      textAlign: 'center',
      fontFamily: 'var(--font-sans)'
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24,
      display: 'flex',
      justifyContent: 'center'
    }
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'clamp(32px, 6vw, var(--text-display-mega-size))',
      fontWeight: 'var(--text-display-mega-weight)',
      letterSpacing: 'var(--text-display-mega-tracking)',
      lineHeight: 'var(--text-display-mega-leading)',
      color: 'var(--color-ink)',
      maxWidth: 720,
      margin: '0 auto 20px'
    }
  }, headline), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-body-md-size)',
      color: 'var(--color-body)',
      maxWidth: 480,
      margin: '0 auto 32px',
      lineHeight: 1.5
    }
  }, subhead), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 56
    }
  }, cta), mockup);
}
Object.assign(__ds_scope, { HeroBand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/marketing/HeroBand.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopNav.jsx
try { (() => {
/**
 * TopNav - 64px marketing/app header. Wordmark left, nav links center-left,
 * auth actions right. `variant="app"` swaps the marketing nav-link set for
 * an in-app breadcrumb-style label (used inside the logged-in web app).
 */
function TopNav({
  variant = 'marketing',
  links = ['Dashboard', 'Classes', 'Calculator'],
  activeLink,
  rightSlot
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      background: 'var(--color-canvas)',
      borderBottom: '1px solid var(--color-hairline)',
      fontFamily: 'var(--font-sans)',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 40
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      letterSpacing: '-0.3px',
      color: 'var(--color-ink)'
    }
  }, "Scoremap"), variant === 'marketing' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 28
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#",
    style: {
      fontSize: 'var(--text-nav-link-size)',
      fontWeight: 'var(--text-nav-link-weight)',
      color: l === activeLink ? 'var(--color-ink)' : 'var(--color-body)',
      textDecoration: 'none'
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, rightSlot));
}
Object.assign(__ds_scope, { TopNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/AppShell.jsx
try { (() => {
/**
 * AppShell - logged-in web-app chrome: minimal app-mode TopNav + left
 * sidebar nav (Dashboard / Classes / Calculator). Kit-local layout, not a
 * cataloged DS primitive - composes TopNav + Button from the DS bundle.
 */
function AppShell({
  active,
  onNavigate,
  children
}) {
  const {
    TopNav,
    Button
  } = window.ScoremapDesignSystem_faa73b;
  const items = ['Dashboard', 'Calculator'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100%',
      background: 'var(--color-canvas-soft)'
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    variant: "app",
    rightSlot: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm"
    }, "Log out")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 200,
      flexShrink: 0,
      background: 'var(--color-canvas)',
      borderRight: '1px solid var(--color-hairline)',
      padding: '24px 16px',
      boxSizing: 'border-box',
      minHeight: 'calc(100vh - 64px)'
    }
  }, items.map(item => /*#__PURE__*/React.createElement("div", {
    key: item,
    onClick: () => onNavigate && onNavigate(item),
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 500,
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      marginBottom: 4,
      cursor: 'pointer',
      color: active === item ? 'var(--color-ink)' : 'var(--color-body)',
      background: active === item ? 'var(--color-surface-strong)' : 'transparent'
    }
  }, item))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 32,
      boxSizing: 'border-box'
    }
  }, children)));
}
window.AppShell = AppShell;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/ClassDetail.jsx
try { (() => {
/**
 * ClassDetail - per-assignment breakdown + category weights for one class.
 */
const ASSIGNMENTS = [{
  name: 'Lab report: cell respiration',
  category: 'Labs',
  score: '18/20',
  pct: 90
}, {
  name: 'Unit 4 quiz',
  category: 'Quizzes',
  score: '27/30',
  pct: 90
}, {
  name: 'Homework 4.3',
  category: 'Homework',
  score: '10/10',
  pct: 100
}, {
  name: 'Midterm exam',
  category: 'Exams',
  score: '84/100',
  pct: 84
}, {
  name: 'Homework 4.4',
  category: 'Homework',
  score: 'missing',
  pct: 0
}];
const CATEGORIES = [{
  name: 'Exams',
  weight: 40
}, {
  name: 'Quizzes',
  weight: 25
}, {
  name: 'Labs',
  weight: 20
}, {
  name: 'Homework',
  weight: 15
}];
function ClassDetail({
  classInfo,
  onBack,
  onOpenCalculator
}) {
  const {
    Badge,
    Button
  } = window.ScoremapDesignSystem_faa73b;
  const c = classInfo || {
    name: 'AP Biology',
    teacher: 'Ms. Alvarez',
    pct: 94.2,
    grade: 'A'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "tertiary",
    onClick: onBack,
    style: {
      marginBottom: 16
    }
  }, "\u2039 Back to classes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-sm-size)',
      fontWeight: 'var(--text-display-sm-weight)',
      letterSpacing: 'var(--text-display-sm-tracking)',
      color: 'var(--color-ink)'
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--color-muted)',
      marginTop: 4
    }
  }, c.teacher)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 600,
      color: 'var(--color-ink)',
      letterSpacing: '-0.5px'
    }
  }, c.pct, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "grade",
    grade: c.grade
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 260px',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: 8
    }
  }, ASSIGNMENTS.map(a => /*#__PURE__*/React.createElement("div", {
    key: a.name,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '14px 16px',
      borderBottom: '1px solid var(--color-hairline)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-ink)'
    }
  }, a.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-muted)',
      marginTop: 2
    }
  }, a.category)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: a.score === 'missing' ? 'var(--color-grade-bad)' : 'var(--color-body)'
    }
  }, a.score)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      alignSelf: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--color-ink)',
      marginBottom: 14
    }
  }, "Category weights"), CATEGORIES.map(cat => /*#__PURE__*/React.createElement("div", {
    key: cat.name,
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-body)'
    }
  }, cat.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-ink)',
      fontWeight: 600
    }
  }, cat.weight, "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      background: 'var(--color-surface-strong)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 3,
      width: `${cat.weight}%`,
      background: 'var(--color-ink)'
    }
  })))), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: onOpenCalculator,
    style: {
      width: '100%',
      marginTop: 8
    }
  }, "Run what-if calculator"))));
}
window.ClassDetail = ClassDetail;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/ClassDetail.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Dashboard.jsx
try { (() => {
/**
 * Dashboard - every class + current grade at a glance.
 */
const DASHBOARD_CLASSES = [{
  name: 'AP Biology',
  teacher: 'Ms. Alvarez',
  pct: 94.2,
  grade: 'A'
}, {
  name: 'Algebra II',
  teacher: 'Mr. Chen',
  pct: 88.6,
  grade: 'B+'
}, {
  name: 'World History',
  teacher: 'Mr. Douglas',
  pct: 76.1,
  grade: 'C'
}, {
  name: 'Chemistry',
  teacher: 'Dr. Patel',
  pct: 91.0,
  grade: 'A−'
}, {
  name: 'English 11',
  teacher: 'Ms. Reyes',
  pct: 82.4,
  grade: 'B−'
}, {
  name: 'Studio Art',
  teacher: 'Mr. Kim',
  pct: 97.8,
  grade: 'A+'
}];
function Dashboard({
  onOpenClass,
  onOpenCalculator
}) {
  const {
    Badge,
    Button
  } = window.ScoremapDesignSystem_faa73b;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-sm-size)',
      fontWeight: 'var(--text-display-sm-weight)',
      letterSpacing: 'var(--text-display-sm-tracking)',
      color: 'var(--color-ink)'
    }
  }, "Your classes"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--color-muted)',
      marginTop: 4
    }
  }, "Quarter 3 \xB7 synced 4 minutes ago")), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    onClick: onOpenCalculator
  }, "Open calculator")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16
    }
  }, DASHBOARD_CLASSES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.name,
    onClick: () => onOpenClass && onOpenClass(c),
    style: {
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      cursor: 'pointer',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--color-ink)'
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--color-muted)',
      marginTop: 2
    }
  }, c.teacher)), /*#__PURE__*/React.createElement(Badge, {
    tone: "grade",
    grade: c.grade
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 600,
      color: 'var(--color-ink)',
      letterSpacing: '-0.5px',
      marginTop: 16
    }
  }, c.pct, "%")))));
}
window.Dashboard = Dashboard;
window.DASHBOARD_CLASSES = DASHBOARD_CLASSES;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Landing.jsx
try { (() => {
/**
 * Landing - Scoremap marketing homepage. Composed from HeroBand, FeatureCard,
 * WorkflowStepCard, TestimonialCard, CtaBand, Footer, TopNav.
 * Loaded via <script type="text/babel" src>, not a module - exposes itself as window.Landing.
 */
function Landing({
  onGetStarted
}) {
  const {
    TopNav,
    HeroBand,
    BrowserMockup,
    Button,
    Badge,
    FeatureCard,
    WorkflowStepCard,
    TestimonialCard,
    CtaBand,
    Footer
  } = window.ScoremapDesignSystem_faa73b;
  function DashboardPreview() {
    const rows = [{
      name: 'AP Biology',
      pct: '94.2%',
      grade: 'A'
    }, {
      name: 'Algebra II',
      pct: '88.6%',
      grade: 'B+'
    }, {
      name: 'World History',
      pct: '76.1%',
      grade: 'C'
    }, {
      name: 'Chemistry',
      pct: '91.0%',
      grade: 'A−'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-muted)',
        marginBottom: 12
      }
    }, "DASHBOARD"), rows.map(r => /*#__PURE__*/React.createElement("div", {
      key: r.name,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 0',
        borderBottom: '1px solid var(--color-hairline)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-ink)'
      }
    }, r.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--color-body)'
      }
    }, r.pct), /*#__PURE__*/React.createElement(Badge, {
      tone: "grade",
      grade: r.grade
    })))));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas)'
    }
  }, /*#__PURE__*/React.createElement(TopNav, {
    activeLink: "Home",
    links: ['Home', 'How it works', 'Pricing'],
    rightSlot: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "nav",
      onClick: onGetStarted
    }, "Sign in"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      onClick: onGetStarted
    }, "Get started"))
  }), /*#__PURE__*/React.createElement(HeroBand, {
    eyebrow: /*#__PURE__*/React.createElement(Badge, {
      tone: "outline"
    }, "Built for StudentVUE"),
    headline: "The smarter way to see your grades.",
    subhead: "Scoremap reads your StudentVUE data and tells you what you actually need to know.",
    cta: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: onGetStarted
    }, "Connect StudentVUE"),
    mockup: /*#__PURE__*/React.createElement(BrowserMockup, null, /*#__PURE__*/React.createElement(DashboardPreview, null))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto',
      padding: '0 32px 96px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-sm-size)',
      fontWeight: 'var(--text-display-sm-weight)',
      letterSpacing: 'var(--text-display-sm-tracking)',
      color: 'var(--color-ink)',
      textAlign: 'center',
      marginBottom: 40
    }
  }, "How it works"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(WorkflowStepCard, {
    step: 1,
    label: "Connect StudentVUE"
  }, "Sign in with your district credentials \u2014 read-only, nothing is changed on your account."), /*#__PURE__*/React.createElement(WorkflowStepCard, {
    step: 2,
    label: "See every class at a glance"
  }, "Scoremap pulls your current grade, per-assignment breakdown, and category weights."), /*#__PURE__*/React.createElement(WorkflowStepCard, {
    step: 3,
    label: "Run the numbers"
  }, "Simulate a future test or missing assignment and see the effect on your final grade instantly."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-canvas-soft)',
      padding: '96px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement(FeatureCard, {
    title: "Live sync, not screenshots"
  }, "Scoremap reads your StudentVUE data the moment it updates \u2014 no manual refreshing, no stale numbers."), /*#__PURE__*/React.createElement(FeatureCard, {
    title: "What-if calculator",
    dark: true
  }, "See exactly what score you need on the final to land the grade you want, before it's too late to matter.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 24,
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(TestimonialCard, {
    quote: "I finally know my grade before report cards come out.",
    name: "Maya R.",
    detail: "11th grade"
  }), /*#__PURE__*/React.createElement(TestimonialCard, {
    quote: "The what-if calculator told me exactly what I needed on the final.",
    name: "Devon K.",
    detail: "10th grade"
  })))), /*#__PURE__*/React.createElement(CtaBand, {
    headline: "See your real grade in under a minute.",
    cta: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: onGetStarted
    }, "Connect StudentVUE")
  }), /*#__PURE__*/React.createElement(Footer, {
    columns: [{
      title: 'Product',
      links: ['Dashboard', 'Calculator', 'Classes']
    }, {
      title: 'Company',
      links: ['About', 'Contact']
    }, {
      title: 'Legal',
      links: ['Privacy', 'Terms']
    }]
  }));
}
window.Landing = Landing;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Landing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/Login.jsx
try { (() => {
/**
 * Login - connect StudentVUE account. Single form, no distractions.
 */
function Login({
  onSubmit
}) {
  const {
    TextInput,
    Button
  } = window.ScoremapDesignSystem_faa73b;
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--color-canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 360
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 600,
      color: 'var(--color-ink)',
      marginBottom: 6,
      textAlign: 'center'
    }
  }, "Scoremap"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-sm-size)',
      fontWeight: 'var(--text-display-sm-weight)',
      letterSpacing: 'var(--text-display-sm-tracking)',
      color: 'var(--color-ink)',
      textAlign: 'center',
      marginBottom: 8
    }
  }, "Connect StudentVUE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--color-body)',
      textAlign: 'center',
      marginBottom: 32,
      lineHeight: 1.5
    }
  }, "Sign in with your district credentials. Read-only \u2014 Scoremap never changes anything on your account."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(TextInput, {
    label: "District username",
    placeholder: "jdoe",
    value: username,
    onChange: e => setUsername(e.target.value)
  }), /*#__PURE__*/React.createElement(TextInput, {
    label: "Password",
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => onSubmit && onSubmit(),
    style: {
      width: '100%'
    }
  }, "Connect StudentVUE"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-muted)',
      textAlign: 'center',
      marginTop: 16
    }
  }, "Not affiliated with Edupoint or StudentVUE.")));
}
window.Login = Login;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/WhatIfCalculator.jsx
try { (() => {
/**
 * WhatIfCalculator - simulate a future/missing assignment score and see the
 * projected effect on the class's final grade, live.
 */
function pctToGrade(pct) {
  if (pct >= 93) return 'A';
  if (pct >= 90) return 'A−';
  if (pct >= 87) return 'B+';
  if (pct >= 83) return 'B';
  if (pct >= 80) return 'B−';
  if (pct >= 77) return 'C+';
  if (pct >= 73) return 'C';
  if (pct >= 70) return 'C−';
  if (pct >= 67) return 'D+';
  if (pct >= 60) return 'D';
  return 'F';
}
function WhatIfCalculator({
  classInfo,
  onBack
}) {
  const {
    Button,
    Badge
  } = window.ScoremapDesignSystem_faa73b;
  const c = classInfo || {
    name: 'AP Biology',
    pct: 94.2,
    grade: 'A'
  };
  const [currentWeight, setCurrentWeight] = React.useState(88); // points already earned, out of 100 weighted
  const [hypoScore, setHypoScore] = React.useState(85);
  const [hypoWeight, setHypoWeight] = React.useState(20); // this assignment's weight, %

  // simple weighted projection: blend current avg with hypothetical score at its weight
  const projected = React.useMemo(() => {
    const remaining = 100 - hypoWeight;
    const value = (c.pct * remaining + hypoScore * hypoWeight) / 100;
    return Math.round(value * 10) / 10;
  }, [hypoScore, hypoWeight, c.pct]);
  const delta = Math.round((projected - c.pct) * 10) / 10;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "tertiary",
    onClick: onBack,
    style: {
      marginBottom: 16
    }
  }, "\u2039 Back"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-display-sm-size)',
      fontWeight: 'var(--text-display-sm-weight)',
      letterSpacing: 'var(--text-display-sm-tracking)',
      color: 'var(--color-ink)',
      marginBottom: 6
    }
  }, "What-if calculator"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--color-body)',
      marginBottom: 32
    }
  }, c.name, " \xB7 current grade ", c.pct, "%"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 300px',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-card)',
      border: '1px solid var(--color-hairline-strong)',
      borderRadius: 'var(--radius-lg)',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 28
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-ink)',
      fontWeight: 600
    }
  }, "Hypothetical score"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-ink)',
      fontWeight: 600
    }
  }, hypoScore, "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: hypoScore,
    onChange: e => setHypoScore(Number(e.target.value)),
    style: {
      width: '100%',
      accentColor: '#ffffff'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-muted)',
      marginTop: 6
    }
  }, "What you might score on the final exam.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-ink)',
      fontWeight: 600
    }
  }, "Assignment weight"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--color-ink)',
      fontWeight: 600
    }
  }, hypoWeight, "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "1",
    max: "50",
    value: hypoWeight,
    onChange: e => setHypoWeight(Number(e.target.value)),
    style: {
      width: '100%',
      accentColor: '#ffffff'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-muted)',
      marginTop: 6
    }
  }, "How much this counts toward the final grade."))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--color-surface-dark-elevated)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      color: 'var(--color-on-dark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      border: '1px solid var(--color-hairline-strong)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--color-on-dark-soft)',
      marginBottom: 8
    }
  }, "Projected grade"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 44,
      fontWeight: 600,
      letterSpacing: '-1px',
      marginBottom: 8
    }
  }, projected, "%"), /*#__PURE__*/React.createElement(Badge, {
    tone: "grade",
    grade: pctToGrade(projected)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--color-on-dark-soft)',
      marginTop: 14
    }
  }, delta >= 0 ? '+' : '', delta, " pts vs. current"))));
}
window.WhatIfCalculator = WhatIfCalculator;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/WhatIfCalculator.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.FeatureCard = __ds_scope.FeatureCard;

__ds_ns.TestimonialCard = __ds_scope.TestimonialCard;

__ds_ns.WorkflowStepCard = __ds_scope.WorkflowStepCard;

__ds_ns.TextInput = __ds_scope.TextInput;

__ds_ns.BrowserMockup = __ds_scope.BrowserMockup;

__ds_ns.CtaBand = __ds_scope.CtaBand;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.HeroBand = __ds_scope.HeroBand;

__ds_ns.TopNav = __ds_scope.TopNav;

})();
