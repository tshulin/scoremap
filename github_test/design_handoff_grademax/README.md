# Handoff: Grademax web app

## Overview
Grademax is a grade-tracking web app that syncs with a student's StudentVUE
account and gives a faster, clearer view of grades — current standing per
class, per-assignment breakdowns, and a grade-over-time chart. This package
contains the marketing + logged-in screens as interactive design references.

## About the design files
The files in this bundle are **design references built in HTML/React** —
prototypes showing the intended look and behavior, **not** production code to
ship as-is. The task is to **recreate these designs in the target codebase**
using its own routing, state, and data layer. If there's no codebase yet,
React + Vite is the natural choice since the prototypes are already React
components.

Each screen is a real React component. In this prototype they run in the
browser via Babel-standalone and read the design-system components off a
global (`window.GrademaxDesignSystem_faa73b`). Two mechanical swaps make each
file bundler-ready (both are noted in a comment at the bottom of every
component file):

1. Replace `window.X = X;` with `export default X;`
2. Replace the `const { Button, ... } = window.GrademaxDesignSystem_faa73b;`
   destructure with named imports from the design-system package.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and interactions.
Recreate pixel-for-pixel using the design system's tokens and components
(don't re-derive values). Every color/type/radius already resolves to a
design-system CSS variable.

## Design system
All visuals come from the bound **Grademax design system** in
`_ds/grademax-design-system-faa73b3c-8cbd-4d15-a90c-3c40aa25b10c/`:

- `tokens/*.css` — colors, typography, spacing, radius, shadows, fonts
  (design tokens as CSS custom properties — style against `var(--*)`).
- `styles.css` — root stylesheet.
- `_ds_bundle.js` — compiled React components, exported on
  `window.GrademaxDesignSystem_faa73b`. Components used here: **Button,
  TopNav, TextInput, Badge, FeatureCard, HeroBand, BrowserMockup, Footer**.
- `readme.md` — full brand/voice/visual-foundations documentation. Read this
  first; the notes below assume it.

Publish this design system as an internal package (or vendor it) so the app
can `import { Button, Card, ... }` instead of reading a global.

## Screens / views

### 1. Landing — `src/pages/Landing.jsx` (`Grademax Landing.html`), route `/`
Marketing homepage. `TopNav` (wordmark + Sign in / Get started, no nav links),
`HeroBand` (eyebrow badge, display headline, subhead, "Connect StudentVUE"
CTA, and a `BrowserMockup` showing a dashboard preview), a **2×2 FeatureCard
grid** (Grade chart, Grade calculator, Attendance & more, Private login — the
last with a "Learn more" link), then `Footer`. Nav/CTA navigate to
`/login` and `/signup`.

### 2. Get started — `src/pages/GetStarted.jsx` (`signup.html`), route `/signup`
Card asking "How do you sign in to StudentVUE?" with two secondary buttons:
- **with Google** → `/signup/google`
- **with a password** → `/login`
Plus "Already used Grademax? Log in" and the Edupoint trademark footer.

### 3. Create a password — `src/pages/SignupGoogle.jsx` (`signup/google.html`), route `/signup/google`
Explainer shown after choosing Google: Grademax can't federate Google sign-in
into StudentVUE, so the student must create a StudentVUE password. Static
placeholder copy ("How to set your StudentVUE password" helper + email
instructions) to be wired later. "log in" link → `/login`.

### 4. Sign in — `src/pages/Login.jsx` (`Grademax Sign In.html`), route `/login`
Auth form: StudentVUE username, password (+ "we can't see your password or
grades" helper), StudentVUE domain (with a "find your domain for you" info
banner and `[your-district]-psv.edupoint.com` input), and a required
acknowledgement checkbox (the Log in button is disabled until it's checked).
On submit → `/dashboard`. "Sign up" link → `/signup`.

### 5. Dashboard — `src/pages/Dashboard.jsx` (`Grademax Dashboard.html`), route `/dashboard`
Left `Sidebar` + main column. Header sync pill ("Last updated… · Refresh") and
a "Semester 2" selector. Full-width class rows, each: a circular period badge,
class name, "teacher · room" subline (left); grade letter + percentage
(right-aligned, fixed-width column) and an aligned progress bar. Bars are
capped at 100% and all start/end at the same x regardless of value. Below:
"N new assignments · Mark as seen" card and footer links. Clicking a row →
class detail.

### 6. Class detail — `src/pages/ClassDetail.jsx` (`Grademax Class Detail.html`), route `/grades/:classId`
Left `Sidebar` (active class highlighted) + main. Header (class name + grade),
a **minimalist grade-over-time line chart** (white line on a faint fill —
intentionally monochrome, no accent color), two toggles (Hypothetical mode,
Show category breakdown — the reference's "Pin chart" toggle is omitted), an
**All / Assessments / Assignments** segmented filter (functional), and a list
of assignment cards. Each card: title, category badge (green Assignments / red
Assessments), Scaled + date chips (left); delta / score / percentage
right-aligned above a progress bar (right). Bar track is deliberately shortened
(≈58% width); the colored fill still reflects the score using grade-band tokens.

## Shared components
- `src/components/Sidebar.jsx` — logged-in left nav (Grades + class list,
  Attendance, Documents, Mail, privacy note, Feedback, profile). Props:
  `activeClass`, `onClass`, `onGrades`. Used by Dashboard and ClassDetail.

## Interactions & behavior
- **Navigation:** in the prototype, buttons/links use
  `window.location.href = '<file>.html'`. Replace with the router's `navigate`
  / `<Link>`. Intended routes are listed per screen above.
- **Login gating:** Log in button `disabled` until the acknowledgement
  checkbox is checked.
- **Class-detail filter:** `All | Assessments | Assignments` filters the
  assignment list by `type` (local `useState`).
- **Toggles:** Hypothetical mode / Show category breakdown are local
  `useState` booleans, not yet wired to behavior.
- **Hover:** dashboard rows and marketing cards lift with
  `var(--shadow-soft-drop)`; no color shift. Buttons dim to
  `--color-primary-active`. Links underline on hover (no color change).
- **Motion:** 150ms ease transitions only. No looping/decorative animation.

## State & data (to build)
All content is currently hardcoded arrays inside the components
(`DASHBOARD_CLASSES` in Dashboard, `ASSIGNMENTS` + the chart `dates`/`values`
series in ClassDetail, `SIDEBAR_CLASSES` in Sidebar). Replace with data from
the StudentVUE sync layer:
- class list (name, period, room, teacher, current grade letter + %)
- per-class assignment list (title, type, scaled?, date, delta, score, %)
- per-class grade history (date → grade) for the chart
- auth/session (username, domain, agreement)

Grade → band color helper (green ≥ A, yellow = B, red ≤ C) lives in each file;
centralize it. Score-bar band: ≥90 green, ≥80 yellow, else red.

## Design tokens (all defined in `_ds/.../tokens/`)
- **Colors:** canvas `#111113`, surface-card `#18191b`, surface-dark-elevated
  `#202125`, hairline `rgba(255,255,255,.08)`, hairline-strong
  `rgba(255,255,255,.14)`, ink `#fff`, body `#a1a1aa`, muted `#71717a`,
  primary (CTA) `#fff` on `#000`, text-link `#4da8ff`. Grade bands:
  good `#00c950`, mid `#f0b100`, bad `#fb2c36`.
- **Type:** Inter only; display weight 600 with negative tracking; body 400.
- **Radius:** inputs 8px, cards 12px, mockup/cards 16px, pill 9999px.
- **Shadow:** one soft drop, used on hover only. **Never** invent new values.

## Assets
- Fonts: Inter (shipped in `_ds/.../assets/fonts/`, wired via
  `tokens/fonts.css`).
- **No icon set** — the reference has nav/chip icons; Grademax ships none, so
  nav and chips are text-only here. Add Lucide/Heroicons and wire icons back in
  (dashboard nav, row chips, sidebar) once you pick a set.
- **No logo** — plain "Grademax" wordmark everywhere.

## Files
- `src/pages/Landing.jsx`, `GetStarted.jsx`, `SignupGoogle.jsx`, `Login.jsx`,
  `Dashboard.jsx`, `ClassDetail.jsx`
- `src/components/Sidebar.jsx`
- HTML harnesses (one per page): `Grademax Landing.html`, `signup.html`,
  `signup/google.html`, `Grademax Sign In.html`, `Grademax Dashboard.html`,
  `Grademax Class Detail.html`
- `_ds/grademax-design-system-faa73b3c-8cbd-4d15-a90c-3c40aa25b10c/` — the
  design system (tokens, styles, bundle, fonts, readme)
- Backups (ignore): `* (backup).html`, `src/pages/Dashboard (backup).jsx`

## How to run the prototype
Serve the project root over HTTP (e.g. `npx serve .`) and open any
`*.html` — they load React + the design-system bundle and render the component.
