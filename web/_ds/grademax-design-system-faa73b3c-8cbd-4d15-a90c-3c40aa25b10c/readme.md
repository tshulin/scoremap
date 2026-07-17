# Grademax Design System

## What is Grademax

Grademax is a grade-tracking web app: it syncs with a school's **StudentVUE**
account and gives students a faster, clearer way to see and calculate their
grades — current standing per class, per-assignment breakdowns, and a
"what-if" calculator to simulate the effect of a future test or missing
assignment on a final grade.

There is no existing Grademax codebase, Figma file, or logo attached to this
project. This design system was built from scratch, using a written visual
brand guide as the **visual style direction only** — colors, type scale,
spacing, radii, and component shapes, not literal screens or copy. All
product surfaces (hero, screens, copy, iconography) were designed fresh
around Grademax's actual product — grades, classes, GPA, StudentVUE — not
copied from any other company's real screens.

**Color correction (current):** the theme is dark — flat black canvas
throughout, white pill CTAs with black text, no gradient anywhere. This
replaces an earlier, incorrect light-canvas/black-CTA pass; the user
supplied real expo.dev screenshots as ground truth for the correction. Only
color values and CTA/badge shape changed — type scale, spacing scale, and
radius *tokens* (the numbers themselves) are unchanged; see Visual
foundations below for the corrected palette description.

**Sources for this project:**
- `uploads/Inter_*.ttf` — the Inter type family (18pt, 24pt, 28pt optical
  sizes, all weights/italics), provided directly by the user. Only a subset
  (18pt: Regular, Italic, Medium, SemiBold, Bold) is wired into `styles.css`
  today — see Typography below.
- A written brand/visual-style brief (pasted text, not attached as a file)
  describing colors, type scale, spacing, radii, and component shapes. Used
  as style reference; component names below are Grademax's own, not that
  brief's literal names.
- Real expo.dev screenshots (homepage, docs, pricing, a product-tour
  section), attached later as ground truth for a color-theme correction —
  the site is dark-themed with flat black backgrounds and white pill CTAs,
  not the light/gradient theme the original written brief described. Used
  only for color values and button/badge shape; Grademax's own copy,
  layout, and product content were not changed to match Expo's.
- No Figma file, GitHub repo, or existing Grademax product screenshots were
  provided. If any of those exist, attach them and this system should be
  reconciled against them.

## Intentional additions

Because no component/screen source defined Grademax's actual product
inventory, the following were authored from scratch to fit the product:

- **Grade-band colors** (`--color-grade-good` / `-mid` / `-bad`) — a
  three-tier ramp (green/yellow/red) per user-supplied reference, covering
  A+–A−, B+–B−, and C+-and-below respectively.
- **Full component set** (Button, TopNav, TextInput, Badge, FeatureCard,
  WorkflowStepCard, TestimonialCard, HeroBand, CtaBand, Footer) — sized to
  what Grademax's web app and marketing site actually need. Components
  present in the reference brief that don't apply to Grademax (code blocks,
  IDE mockups, ecosystem/partner-logo tiles, pricing tiers) were **omitted**
  rather than force-fit.
- **Grademax wordmark** — no logo was provided. Every place a mark would
  appear renders the plain Inter SemiBold wordmark "Grademax" instead. Do
  not invent a logomark; ask the user for one if needed.

## Index

- `styles.css` — root stylesheet; import this one file.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `radius.css`,
  `shadows.css`, `fonts.css` (`@font-face`).
- `assets/fonts/` — Inter 18pt TTFs actually shipped (Regular, Italic,
  Medium, SemiBold, Bold). The rest of `uploads/` (24pt/28pt optical sizes,
  Thin–Black weights) remain available if a future need arises.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `components/`
  - `buttons/Button.jsx` — primary / secondary / tertiary-text, sizes, disabled.
  - `navigation/TopNav.jsx` — marketing + app top nav.
  - `forms/TextInput.jsx` — text input, focus/disabled/error states.
  - `badges/Badge.jsx` — pill badge, incl. grade-band variant.
  - `cards/FeatureCard.jsx`, `WorkflowStepCard.jsx`, `TestimonialCard.jsx`.
  - `marketing/HeroBand.jsx`, `BrowserMockup.jsx` (browser-chrome frame used inside HeroBand), `CtaBand.jsx`, `Footer.jsx`.

**Full component list:** Button, TopNav, TextInput, Badge, FeatureCard,
WorkflowStepCard, TestimonialCard, HeroBand, BrowserMockup, CtaBand, Footer.
- `ui_kits/web-app/` — Grademax web app: Landing, Login, Dashboard, Class
  Detail, What-If Calculator — one interactive `index.html`.
- `SKILL.md` — portable skill file for using this system elsewhere.

## Content fundamentals

**Voice:** calm, editorial, confident — matter-of-fact rather than hypey.
Grademax talks about grades the way a good teacher explains a rubric: plainly,
without pressure or gamification.

- **Second person, direct:** "See your grade before your teacher posts it."
  Not "Students can see their grades."
- **Sentence case everywhere** — headlines, buttons, nav items. Never
  Title Case, never ALL CAPS (except the `caption-uppercase` label token,
  which is a type treatment, not a copy rule).
- **No exclamation points, no emoji.** Confidence reads as restraint, not
  enthusiasm. "Your grade updated." not "Your grade updated! 🎉"
- **Numbers do the talking.** Lean on the actual percentage/letter grade
  rather than adjectives — "91.4% · A−" carries more than "Great job!"
- **Short, declarative sentences.** Hero: "The smarter way to see your
  grades." Subhead adds one clause of mechanism: "Grademax reads your
  StudentVUE data and tells you what you actually need to know."
  Never stack more than two sentences of marketing copy in a row.
- **Buttons are verbs, lowercase-first:** "Connect StudentVUE", "See my
  grades", "Run the numbers" — not "Submit" or "Click here."
- **Inline links only** get the text-link blue; never used to fake a CTA.

## Visual foundations

- **Canvas:** near-black (`--color-canvas`, #111113) throughout the entire
  product — marketing site and logged-in app alike, hero included. No
  gradient wash, no atmospheric backdrop anywhere. No textures, no patterns,
  no illustration fills. Cards and chips sit on a lighter gray
  (`--color-surface-card`/`-strong`, #18191b) one step up from canvas.
- **Color:** one CTA voltage — a solid white pill. Everything else is
  grayscale (white ink / light-gray body / dim-gray muted) plus
  narrowly-scoped accents: a brightened text-link blue for inline links, and
  the semantic trio (success/warning/error) plus the three-band grade ramp
  (green/yellow/red) for grade-specific data only. Color is informational,
  never decorative. An "elevated" surface tone (`--color-surface-dark`,
  #1c1d20) differentiates a featured card from the surrounding page — a
  step up in lightness, not a theme inversion (there's only one theme now).
- **Type:** Inter only, one family for every role. Display sits at weight
  600 (never 700+) with tightening negative tracking as size increases
  (-0.5px at 22px up to -1.92px at 64px) — confident, not shouty. Body text
  runs at 400. No serif, no secondary display face.
- **Imagery:** no photography. The one recurring image motif is a **browser
  window mockup** showing an actual Grademax screen (dashboard or what-if
  calculator) as hero chrome — real product UI standing in for illustration.
  The mockup card is a dark elevated surface, not a light card. No stock
  photos, no hand-drawn illustration, no icon-heavy hero art.
- **Backgrounds:** flat near-black by default; `--color-canvas-soft`
  (#0d0e10) only to alternate a section band — barely distinguishable from
  canvas, a whisper of separation rather than a visible block.
- **Animation:** minimal and functional — short (150–200ms) ease-out fades/
  translate-ins on hero entrance and card hover lift. No bounce, no spring,
  no looping decorative motion, no parallax.
- **Hover states:** cards lift with `--shadow-soft-drop`; no color shift.
  Primary button dims slightly to `--color-primary-active` (#e4e4e7);
  secondary button border brightens. Text links get an underline on hover,
  not a color change.
- **Press states:** primary CTA drops to `--color-primary-active` with no
  scale/shrink transform — a flat color swap, deliberately understated.
- **Borders:** 1px hairlines throughout, now subtle light-on-black
  (`--color-hairline-strong` = `rgba(255,255,255,.14)` on cards and inputs,
  `--color-hairline` = `rgba(255,255,255,.08)` on plain dividers). No
  colored borders, no left-border accent stripes.
- **Shadow system:** one tier only — the soft drop shadow, used on hover,
  never at rest. Resting cards are flat with a hairline border only. No
  inner shadows, no glow.
- **Transparency / blur:** none in normal UI; hairlines use alpha so they
  read correctly regardless of what's beneath them, but there is no
  frosted/blurred surface anywhere.
- **Corner radii:** compact, developer-ergonomic — 8px on inputs, 12px on
  cards, 16px on the browser-mockup chrome. **Pill radius now covers both
  badges and filled CTA buttons** (primary/secondary) — corrected from the
  original brief's "pills are for badges only" rule to match the real
  reference site's actual buttons. Tertiary (text-link) buttons have no
  fill/radius at all.
- **Cards:** lighter-gray fill (`--color-surface-card`, #18191b), 1px
  hairline-strong border, 12px radius, 24px padding, no shadow at rest,
  soft-drop shadow on hover. The "featured" variant swaps to
  `--color-surface-dark` (#1c1d20) — one step lighter still — same shape.
- **Layout:** 96px section rhythm on marketing pages; 16–24px gaps inside
  dense in-app grids (dashboard class rows, calculator inputs). 1200px max
  content width, 12-column editorial grid for marketing copy.

## Iconography

No icon set, icon font, or SVG sprite was provided with this project, and
none should be invented from memory. The system currently uses **zero
decorative icons** — grade states are communicated with color + type
(grade-band badges, ✓/percentage text), not iconography. Where a screen
genuinely needs a glyph (nav chevrons, a close button, an external-link
mark), the UI kit uses plain Unicode characters (›, ×, ↗) styled with CSS
rather than SVG, keeping things honest about what wasn't provided. Emoji are
not used per the content voice rules above.

**If you have an icon set** (Lucide, Heroicons, a custom sprite, or brand
marks for StudentVUE/Canvas/Google Classroom integrations), attach it and
this system should be updated to use it — a proper icon system is a real
gap right now, not a style choice.

## Known gaps / caveats

- No Grademax logo — plain wordmark used everywhere. **Please attach a
  logo if you have one.**
- No real Grademax screenshots, Figma, or codebase — every UI-kit screen is
  an original design in this visual style, not a recreation of an existing
  product. If a real Grademax product exists, attach it so this system can
  be reconciled against the real thing.
- No icon set — see Iconography above.
- Only a working subset of the provided Inter files is wired in (18pt,
  5 styles). The full family (24pt/28pt optical sizes, Thin–Black weights)
  is sitting in `uploads/` if a future component needs it.
- JetBrains Mono (present in the reference brief) was intentionally left
  out — Grademax has no code/IDE surface to justify a monospace family.
