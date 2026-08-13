# Scoremap Color Style Guide

The single source of truth for Scoremap's color system. Every color in the app
is a CSS custom property defined in `src/index.css` (app tokens, both themes)
layered over `_ds/…/tokens/colors.css` (design-system defaults). Components
never hardcode hex values - they reference tokens, so retheming is a
token-file edit.

Dark is the default theme and uses the **original Scoremap dark palette**
(the design-system defaults). Light is the pastel palette and is opt-in via
`data-theme="light"` on `<html>` (toggled from the sidebar account menu,
persisted in `localStorage.grademax-theme`).

---

## Dark mode (original palette)

### Surfaces

| Color | Usage |
| --- | --- |
| `#111113` | Page / main content background, body, sidebar |
| `#18191b` | All boxes - course cards, assignment rows, pills, tag chips, nav active fill |
| `#1c1d20` | Featured/elevated DS card |
| `#202125` | Elevated floating layers - popover, chart tooltips, active filter-tab fill, progress-bar tracks, avatar circle |
| `#0d0e10` | Alternating soft band on marketing pages (`--color-canvas-soft`) |
| accent @ 14% | Demo-mode pill background (derived via `color-mix`) |

### Borders

| Color | Usage |
| --- | --- |
| `rgba(255,255,255,0.14)` | Course cards, pills, assignment rows, tab strip, avatar circle |
| `rgba(255,255,255,0.08)` | Sidebar right edge, privacy note, divider, chart gridlines |
| `rgba(255,255,255,0.06)` | Softest hairline |

### Text

| Color | Usage |
| --- | --- |
| `#ffffff` | Logo, course names, grades, page headings, active nav, pill button labels, trend-line stroke, base body text |
| `#a1a1aa` | Sidebar nav items, checkbox labels, "Last updated", teacher / room meta, inactive tabs, legend labels |
| `#71717a` | Assignment dates, delta values, privacy note, ⋮ icon, footer disclaimer |
| `#45454b` | Softest text, ungraded / no score |

### Accent (tweakable)

| Color | Usage |
| --- | --- |
| `#7db4f5` | Links, Refresh, demo pill text |
| `#a7cdfa` | Link hover |

### Grade colors (neon)

| Color | Usage |
| --- | --- |
| `#39ff6a` | Green - passing / Homework legend |
| `#ffc400` | Amber - borderline |
| `#ff2d55` | Red - failing / Quizzes + Tests legend |
| `#54585d` | Ungraded / no score |
| `#1cc5f0` | Cyan - grade over 100% / extra-credit assignments |

---

## Light mode (pastel)

### Surfaces

| Color | Usage |
| --- | --- |
| `#f7f6fb` | Page / main background, body, avatar circle, tag chips, privacy note |
| `#efeef8` | Sidebar, all boxes - course cards, assignment rows, pills, chart panel |
| `#e6e4f1` | Nav hover / active nav item, elevated floating layers (popover, tooltips, active filter-tab fill) |
| `#eae8f4` | Course card hover |
| `#ddd9ea` | Progress-bar tracks |
| `#eef1fa` | Demo-mode pill background |

### Borders

| Color | Usage |
| --- | --- |
| `rgba(60,55,90,0.15)` | Course cards, pills, assignment rows, tab strip, avatar circle |
| `rgba(60,55,90,0.11)` | Sidebar right edge, chart panel, privacy note, divider |
| `rgba(60,55,90,0.08)` | Softest hairline |

### Text

| Color | Usage |
| --- | --- |
| `#2e2b3a` | Logo, course names, grades, page headings, active nav |
| `#35323f` | Base body text |
| `#413e4f` | Pill button labels, trend-line stroke |
| `#605c72` | Sidebar nav items, "Last updated", checkbox label, Feedback link |
| `#7c788c` | Teacher / room meta, inactive tabs, privacy note |
| `#918da1` | Assignment dates, delta values, ⋮ icon, footer disclaimer |

### Accent (tweakable)

| Color | Usage |
| --- | --- |
| `#7d7ab3` | Links, Refresh, demo pill text |
| `#63609a` | Link hover |

### Grade colors (pastel)

| Color | Usage |
| --- | --- |
| `#6cc79a` | Green - passing / Homework legend |
| `#f0c46a` | Amber - borderline |
| `#ec8b8b` | Red - failing / Quizzes + Tests legend |
| `#cfcbdc` | Ungraded / no score |
| `#149fc4` | Cyan - grade over 100% / extra-credit assignments (deeper than dark's neon) |

---

## Tints (derived - never hand-picked)

Colored chip/badge backgrounds are 14% tints of their foreground color,
computed with `color-mix` so they track both themes automatically:

```css
--color-tint-good:   color-mix(in srgb, var(--color-grade-good) 14%, transparent);
--color-tint-mid:    color-mix(in srgb, var(--color-grade-mid) 14%, transparent);
--color-tint-bad:    color-mix(in srgb, var(--color-grade-bad) 14%, transparent);
--color-tint-accent: color-mix(in srgb, var(--color-text-link) 14%, transparent);
```

Mail tag chips use a stronger 22% mix of the same formula.

---

## Token map

App-level tokens live in `src/index.css`. The dark block restates the
design-system defaults and adds the purpose tokens; the
`[data-theme='light']` block restates every token for the pastel theme.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--color-canvas` | `#111113` | `#f7f6fb` | Page background |
| `--color-canvas-soft` | `#0d0e10` | `#efeef8` | Alternating marketing band |
| `--color-surface-card` | `#18191b` | `#efeef8` | All boxes (cards, rows, pills, privacy note) |
| `--color-surface-sidebar` | `#111113` | `#efeef8` | Sidebar background |
| `--color-surface-strong` | `#18191b` | `#f7f6fb` | Tag chips, inline inputs |
| `--color-surface-dark` | `#1c1d20` | `#efeef8` | DS featured surfaces |
| `--color-surface-dark-elevated` | `#202125` | `#e6e4f1` | Popover, tooltips, active filter tab |
| `--color-surface-demo` | accent @ 14% | `#eef1fa` | Demo-mode pill background |
| `--color-nav-active` | `#18191b` | `#e6e4f1` | Sidebar nav active fill |
| `--color-card-hover` | `#18191b` | `#eae8f4` | Course-card hover fill (unused - shadow only) |
| `--color-progress-track` | `#202125` | `#ddd9ea` | Progress/score bar tracks |
| `--color-avatar-bg` | `#202125` | `#f7f6fb` | Avatar / period circle |
| `--color-hairline-strong` | `rgba(255,255,255,0.14)` | `rgba(60,55,90,0.15)` | Box borders (cards, pills, rows, tab strip, avatar) |
| `--color-hairline` | `rgba(255,255,255,0.08)` | `rgba(60,55,90,0.11)` | Panel borders (sidebar edge, privacy note, divider) |
| `--color-hairline-soft` | `rgba(255,255,255,0.06)` | `rgba(60,55,90,0.08)` | Softest lines |
| `--color-ink` | `#ffffff` | `#2e2b3a` | Headings, names, grades, active nav |
| `--color-body-strong` | `#ffffff` | `#35323f` | Base body text |
| `--color-body` | `#a1a1aa` | `#605c72` | Nav items, checkbox labels, Feedback |
| `--color-text-pill` | `#ffffff` | `#413e4f` | Pill button labels |
| `--color-text-updated` | `#a1a1aa` | `#605c72` | "Last updated" |
| `--color-text-meta` | `#a1a1aa` | `#7c788c` | Teacher/room meta, inactive tabs, legend labels |
| `--color-muted` | `#71717a` | `#918da1` | Dates, deltas, ⋮ icon |
| `--color-text-privacy` | `#71717a` | `#7c788c` | Privacy note |
| `--color-text-disclaimer` | `#71717a` | `#918da1` | Footer disclaimer |
| `--color-muted-soft` | `#45454b` | `#918da1` | Softest DS text |
| `--color-trend-stroke` | `#ffffff` | `#413e4f` | Grade-over-time line + dots |
| `--color-text-link` | `#7db4f5` | `#7d7ab3` | Accent: links, Refresh, demo pill |
| `--color-text-link-hover` | `#a7cdfa` | `#63609a` | Link hover |
| `--color-grade-good` | `#39ff6a` | `#6cc79a` | Passing / homework-type |
| `--color-grade-mid` | `#ffc400` | `#f0c46a` | Borderline |
| `--color-grade-bad` | `#ff2d55` | `#ec8b8b` | Failing / assessment-type |
| `--color-grade-none` | `#54585d` | `#cfcbdc` | Ungraded / no score |
| `--color-grade-over` | `#1cc5f0` | `#149fc4` | Grade over 100% / extra-credit assignments (`--color-tint-over` derives its chip) |

---

## Colors defined, element unchanged

The theming changes color values only - no layout or structure. A few tokens
name elements/states the current design doesn't render; they exist and take
effect automatically if those elements are ever added:

- **Course card hover** (`--color-card-hover`) - cards hover with a shadow
  only; the fill is unused.
- **Nav hover fill** - only the *active* nav item gets `--color-nav-active`;
  hover changes text color only.

---

## Not yet specified - using placeholders

1. **Primary CTA button** (landing "Get started", dialogs): dark keeps the
   DS white pill / black text (`#ffffff` / `#000000`); light uses ink
   (`#2e2b3a`) with white text.
2. **Overview chart categorical palette** - one line per category:
   `#3987e5 #d95926 #199e70 #9085e9 #d55181` (both themes). The grade
   green/red pair colors category *chips*; 3+ chart lines need
   distinguishable hues.
3. **Semantic states**: warning `#f0a94e`, error `#eb8e90`, success
   `#16a34a`, preview/attachment purple `#a855f7` (Mail tag chips) - same in
   both themes.
4. **Dialog backdrop scrim**: `rgba(0,0,0,0.65)` both themes.
5. **Focus rings / selection**: browser defaults (accent-tinted via
   `accent-color` on checkboxes).
