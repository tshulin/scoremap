# Grademax Color Style Guide

The single source of truth for Grademax's color system. Every color in the app
is a CSS custom property defined in `src/index.css` (app tokens, both themes)
layered over `_ds/…/tokens/colors.css` (design-system defaults). Components
never hardcode hex values — they reference tokens, so retheming is a
token-file edit.

Dark is the default theme; light is opt-in via `data-theme="light"` on
`<html>` (toggled from the sidebar account menu, persisted in
`localStorage.grademax-theme`).

---

## Dark mode

### Surfaces

| Color | Usage |
| --- | --- |
| `#101214` | Page / main content background, body background |
| `#17191c` | Sidebar, all boxes — course cards, assignment rows, pills, chart panel, privacy note, avatar circle, progress-bar tracks, nav hover/active, sidebar divider |
| `#10161c` | Demo-mode pill background (accent-tinted) |
| `#1d2024` | *(derived)* Elevated floating layers — account-menu popover, chart tooltips, active filter-tab fill |
| `#0d0f11` | *(derived)* Alternating soft band on marketing pages (`--color-canvas-soft`) |

### Borders

| Color | Usage |
| --- | --- |
| `rgba(255,255,255,0.18)` | Course cards, pills, assignment rows, tab strip, avatar circle |
| `rgba(255,255,255,0.12)` | Sidebar right edge, chart panel, privacy note, sidebar divider |
| `rgba(255,255,255,0.08)` | *(derived)* Softest hairline (chart gridlines fallback, DS internals) |

### Text

| Color | Usage |
| --- | --- |
| `#ffffff` | Logo, course names, grades, page headings, active nav, trend-line stroke |
| `#f2f3f5` | Base body text |
| `#e6e8ea` | Pill button labels |
| `#c7cbd1` | Sidebar nav items, checkbox label, Feedback link |
| `#b7bcc2` | "Last updated" text |
| `#9aa1a8` | Teacher / room meta, inactive tabs, legend labels |
| `#8b9096` | Assignment dates, delta values, privacy note, ⋮ icon |
| `#6b7178` | Footer disclaimer |

### Accent (tweakable)

| Color | Usage |
| --- | --- |
| `#7db4f5` | Links, Refresh, active tab underline, demo pill border + text |
| `#a7cdfa` | Link hover |

### Grade colors (neon)

| Color | Usage |
| --- | --- |
| `#39ff6a` | Green — passing / Homework legend |
| `#ffc400` | Amber — borderline |
| `#ff2d55` | Red — failing / Quizzes + Tests legend |
| `#54585d` | Ungraded / no score |

---

## Light mode (pastel)

### Surfaces

| Color | Usage |
| --- | --- |
| `#f7f6fb` | Page / main background, body, avatar circle, tag chips, privacy note |
| `#efeef8` | Sidebar, all boxes — course cards, assignment rows, pills, chart panel |
| `#e6e4f1` | Nav hover / active nav item, elevated floating layers *(derived: popover, tooltips, active filter-tab fill)* |
| `#eae8f4` | Course card hover |
| `#ddd9ea` | Progress-bar tracks |
| `#eef1fa` | Demo-mode pill background |

### Borders

| Color | Usage |
| --- | --- |
| `rgba(60,55,90,0.15)` | Course cards, pills, assignment rows, tab strip, avatar circle |
| `rgba(60,55,90,0.11)` | Sidebar right edge, chart panel, privacy note, divider |
| `rgba(60,55,90,0.08)` | *(derived)* Softest hairline |

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
| `#7d7ab3` | Links, Refresh, active tab underline, demo pill border + text |
| `#63609a` | Link hover |

### Grade colors (pastel)

| Color | Usage |
| --- | --- |
| `#6cc79a` | Green — passing / Homework legend |
| `#f0c46a` | Amber — borderline |
| `#ec8b8b` | Red — failing / Quizzes + Tests legend |
| `#cfcbdc` | Ungraded / no score |

---

## Tints (derived — never hand-picked)

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

App-level tokens live in `src/index.css`. The dark block overrides the
design-system defaults; the `[data-theme='light']` block restates every token.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--color-canvas` | `#101214` | `#f7f6fb` | Page background |
| `--color-canvas-soft` | `#0d0f11` | `#efeef8` | Alternating marketing band |
| `--color-surface-card` | `#17191c` | `#efeef8` | All boxes (cards, rows, pills, chart panel, privacy note) |
| `--color-surface-sidebar` | `#17191c` | `#efeef8` | Sidebar background |
| `--color-surface-strong` | `#17191c` | `#f7f6fb` | Tag chips, inline inputs |
| `--color-surface-dark` | `#17191c` | `#efeef8` | DS featured surfaces |
| `--color-surface-dark-elevated` | `#1d2024` | `#e6e4f1` | Popover, tooltips, active filter tab |
| `--color-surface-demo` | `#10161c` | `#eef1fa` | Demo-mode pill background |
| `--color-nav-active` | `#17191c` | `#e6e4f1` | Sidebar nav hover/active fill |
| `--color-card-hover` | `#17191c` | `#eae8f4` | Course-card hover fill |
| `--color-progress-track` | `#17191c` | `#ddd9ea` | Progress/score bar tracks |
| `--color-avatar-bg` | `#17191c` | `#f7f6fb` | Avatar / period circle |
| `--color-hairline-strong` | `rgba(255,255,255,0.18)` | `rgba(60,55,90,0.15)` | Box borders (cards, pills, rows, tab strip, avatar) |
| `--color-hairline` | `rgba(255,255,255,0.12)` | `rgba(60,55,90,0.11)` | Panel borders (sidebar edge, chart panel, privacy note, divider) |
| `--color-hairline-soft` | `rgba(255,255,255,0.08)` | `rgba(60,55,90,0.08)` | Softest lines |
| `--color-ink` | `#ffffff` | `#2e2b3a` | Headings, names, grades, active nav |
| `--color-body-strong` | `#f2f3f5` | `#35323f` | Base body text |
| `--color-body` | `#c7cbd1` | `#605c72` | Nav items, checkbox labels, Feedback |
| `--color-text-pill` | `#e6e8ea` | `#413e4f` | Pill button labels |
| `--color-text-updated` | `#b7bcc2` | `#605c72` | "Last updated" |
| `--color-text-meta` | `#9aa1a8` | `#7c788c` | Teacher/room meta, inactive tabs, legend labels |
| `--color-muted` | `#8b9096` | `#918da1` | Dates, deltas, ⋮ icon |
| `--color-text-privacy` | `#8b9096` | `#7c788c` | Privacy note |
| `--color-text-disclaimer` | `#6b7178` | `#918da1` | Footer disclaimer |
| `--color-muted-soft` | `#6b7178` | `#918da1` | Softest DS text |
| `--color-trend-stroke` | `#ffffff` | `#413e4f` | Grade-over-time line + dots |
| `--color-text-link` | `#7db4f5` | `#7d7ab3` | Accent: links, Refresh, tab underline, demo pill |
| `--color-text-link-hover` | `#a7cdfa` | `#63609a` | Link hover |
| `--color-grade-good` | `#39ff6a` | `#6cc79a` | Passing / homework-type |
| `--color-grade-mid` | `#ffc400` | `#f0c46a` | Borderline |
| `--color-grade-bad` | `#ff2d55` | `#ec8b8b` | Failing / assessment-type |
| `--color-grade-none` | `#54585d` | `#cfcbdc` | Ungraded / no score |

---

## Not yet specified — using placeholders

These colors exist in the product but aren't covered by the guide yet.
Current placeholder values are noted; specify them to replace.

1. **Primary CTA button** (landing "Get started", dialogs): dark keeps the
   DS white pill / black text (`#ffffff` / `#000000`); light uses ink
   (`#2e2b3a`) with white text.
2. **Overview chart categorical palette** — one line per category:
   `#3987e5 #d95926 #199e70 #9085e9 #d55181` (unchanged). The guide's
   green/red legend colors are used for category *chips*, but 3+ chart lines
   need distinguishable hues. Keep, or supply a new 5-color set?
3. **Semantic states**: warning `#f0a94e`, error `#eb8e90`, success
   `#16a34a`, preview/attachment purple `#a855f7` (Mail tag chips) — same in
   both themes.
4. **Elevated floating surfaces** (account-menu popover, chart tooltips):
   derived `#1d2024` dark / `#e6e4f1` light.
5. **Dark-mode course-card hover**: only light mode (`#eae8f4`) is specified;
   dark currently hovers with a shadow only.
6. **Dialog backdrop scrim**: `rgba(0,0,0,0.65)` both themes.
7. **Focus rings / selection**: browser defaults (accent-tinted via
   `accent-color` on checkboxes).
