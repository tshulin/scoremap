# Individual grade page — build plan

The per-class grade tab (`/grades/:classId` in `github/`), built now against fake data,
designed so real data drops in with zero feature work. This plan supersedes the current
`ClassDetail.jsx` checkbox-based layout.

> **Decisions already made** (2026-07-19): build directly in `github/` (not full-first —
> `full/web` has drifted behind and this is site-only work); target calculator
> redistributes as a uniform percentage across unlocked assignments; a dev-only demo mode
> is added so no StudentVUE login is needed during development; the grade index is
> inferred from portal letters where possible (see §9 — GradeCompass never computed
> cutoffs itself, it displayed Synergy's letters, which is why it "knew" AP Bio's A
> started at 82.5).

---

## 1. Current state (verified 2026-07-19)

| Piece | Status |
|---|---|
| Grade engine `src/calc/` (grade, points, impact, target) | Done, pure TS. 59/59 tests pass (suite lives in `full/`, code identical). |
| Sample gradebook `src/data/placeholders.js` | Done, schema-validated, behind `VITE_PLACEHOLDER_DATA`. Covers weighted + unweighted + empty classes, extra credit, earned zero, not-for-grade, ungraded, scaled. |
| Hypothetical **edits** to existing assignments | Working in `ClassDetail.jsx`. |
| Per-assignment impact chips | Working (`assignmentImpacts`). |
| Grade-over-time chart | Dead: reads `historyByClass` which nothing ever populates, and its y-axis is hardcoded to 98.2–100. |
| Adding **new** hypothetical assignments | Missing. |
| Category overview, multi-assignment target calc, max/min calc, grade index | Missing. |
| Tests in `github/` | No vitest setup yet. |
| Seeing any of this without a real portal login | Impossible (placeholder only serves inside an authenticated session). |

## 2. Design principles

1. **One data path.** Fake data enters exactly where real data will: a `Gradebook`
   validated by `GradebookSchema`, mapped by `studentvue.js`. Features read domain
   `Assignment`s and `Category`s and never know the source. When `parseGradebook` lands,
   nothing in this plan changes.
2. **All math in `src/calc/`** — pure TypeScript functions over domain types, no React,
   each with a vitest suite. UI components only format and wire state.
3. **One scenario state.** Every feature (chart, impacts, overview, target, max/min)
   reads a single "effective assignments" list = real assignments + score edits + added
   hypotheticals. No feature keeps its own copy of the data.
4. **Plain UI.** Reuse the existing inline-style idiom; no chart/UI libraries. Custom
   design comes later.
5. **Grade history is derived, not stored.** Like GradeCompass: replay assignments in
   date order and compute the grade after each date. No backend endpoint needed, ever.
   `historyByClass` and `useGradeHistory` are deleted.

## 3. Phase 0 — tooling

**0a. Vitest in `github/`.** Add `vitest` devDependency + `"test": "vitest run"`. Move
the four `src/calc/*.test.ts` suites over from `full/src/calc/` (drop the `.js` import
extensions, matching the code already in `github/`). From here on, `full/` is not
touched.

**0b. Demo mode.** `VITE_DEMO=true` makes the app run signed-in on sample data:

- `src/data/demo.js` (new): builds a full snapshot from `SAMPLE_GRADEBOOK` /
  `SAMPLE_ATTENDANCE` through the **same** `mapGradebook`/`mapAbsence` mapping in
  `studentvue.js`; session name "Demo Student"; `meta.*.placeholder = true` so the
  existing sample banner shows.
- `studentvue.js#sync()`: first line — if demo, return the demo snapshot.
- `api.js#hasToken()`: returns true in demo mode (so `RequireAuth` and the provider
  behave as signed-in). `login`/`logout` become no-ops in demo.
- Guard: the deploy workflow never sets `VITE_DEMO`; additionally `demo.js` throws at
  import if `import.meta.env.PROD` is true. The SyncPill banner always announces demo
  mode.

Verify: `VITE_DEMO=true npm run dev` → dashboard and class pages render sample classes
with no relay running.

**0c. Richer sample data** (`placeholders.js`): spread ALGEBRA/BIOLOGY assignment dates
across ~10 distinct dates (chart needs a series worth looking at) and add one course
with non-standard letters (e.g. "AP Biology", A at 84%) to exercise grade-index
inference. Keep every course's stated `percentage` consistent with what `src/calc`
computes — that consistency check becomes a test in 0a.

## 4. Scenario state (foundation for features 2–6)

`src/pages/class/useScenario.js` (new hook), owning:

```js
{
  edits:      { [assignmentId]: { earned, possible } },   // existing behavior, moved here
  added:      DomainAssignment[],  // new hypotheticals, ids "hypo-1", "hypo-2", …
  hypothetical: boolean,           // master toggle (off => edits/added ignored)
}
```

Exposed values:

- `effective: Assignment[]` — real assignments with edits applied, plus `added` (only
  while `hypothetical` is on). This is the single input to every calc call.
- `addAssignment({name, category, pointsEarned, pointsPossible, extraCredit, date})`,
  `removeAssignment(id)` (added ones only), `setEdit(id, field, value)`,
  `toggleHypothetical(on)` (off clears edits + added — current behavior kept).

Added hypotheticals are full domain `Assignment`s (validated shape), `date` defaulting
to today, so the chart/impacts/overview treat them identically to real rows.
State is session-only (resets on reload), deliberately: stale fake assignments
mixed into freshly synced real data is the worst failure mode here.

Tests: none (thin state); everything it feeds is tested at the calc layer.

## 5. Feature 1 — grade-over-time chart

**Calc** — `src/calc/series.ts` (new):

```ts
gradeSeries(assignments: Assignment[], categories?: Category[]):
  { date: string; grade: number; assignments: Assignment[] }[]
```

Group calculable assignments by `date`, sort ascending, and for each date compute
`courseGrade(everything up to and including that date, categories)`. The last point
always equals the current computed grade (test asserts this invariant). Weighted-class
renormalization is inherited from `courseGrade` — early points reflect only the
categories graded so far, which is correct and matches GradeCompass.

**UI** — `src/pages/class/GradeChart.jsx`: keep the existing dependency-free SVG
approach but fix the geometry:

- y-domain from the data: `[floor(min) − 1, min(ceil(max) + 1, upper)]` where upper
  allows >100 (extra credit); ~5 ticks at sensible steps. The 98.2/100 constants and
  fixed tick list are deleted.
- x labels thinned to ≤8 (first, last, evenly between).
- Hover: nearest point highlights and a plain tooltip box lists that date's assignment
  names + the grade (GradeCompass parity).
- Renders only with ≥2 points (guard kept).
- In hypothetical mode the series is computed from `effective`, so edits and added
  assignments visibly reshape the line (added ones land on their chosen date).

Caveat to document in the component: derived history is a reconstruction from current
data — a retroactively-edited score changes the "past". That's inherent (and how
GradeCompass works).

Tests (`series.test.ts`): unweighted and weighted series values against hand-computed
numbers; same-date grouping; not-for-grade/ungraded exclusion; extra-credit dates;
last-point invariant; empty/1-point cases.

## 6. Feature 2 — hypothetical assignments (add / edit / remove)

Mostly delivered by §4. UI in the assignment list:

- "Add hypothetical assignment" button (visible in hypothetical mode): inserts a row at
  the top with inputs for name, category (select from the class's categories; free text
  when unweighted), earned, possible, extra-credit checkbox, date (default today).
- Added rows get a "Hypothetical" chip and a remove ✕. Existing rows keep the current
  inline earned/possible editing (moved to read scenario state).
- Weighted classes: category is required for an added row to count (the calc layer
  ignores uncategorized rows in weighted mode — surface that in the row: "pick a
  category to include this").

Edge cases already handled by the engine: extra-credit rows need no `pointsPossible`;
an added row in a previously-empty category (e.g. Finals) pulls that category's weight
into the renormalized grade — the header grade will move a lot, correctly.

## 7. Feature 3 — per-assignment grade impact

Already implemented via `assignmentImpacts` (chronological "grade after minus grade
before", results in input order — exactly GradeCompass's `gradePercentageChange`).
Work here:

- Compute over `effective` so added hypotheticals get impact chips too (they do
  automatically — `impactById` just needs the added ids present).
- Show the chip on every calculable row, colored by sign (current code hides small
  positives in muted gray — keep that).
- Add the **hidden points** row: when a weighted class's category totals exceed the sum
  of visible assignments (portal hides some assignments), `hiddenPoints()` (already in
  `impact.ts`) yields per-category discrepancies. Render them as pseudo-rows
  ("Point discrepancy in Tests, +x.xx%") like GradeCompass, flagged clearly, not
  editable. Also fold the discrepancy into the Overview tab (§8).

Tests: already covered in `impact.test.ts`; add one asserting ids of added
hypotheticals appear in the impact map.

## 8. Feature 4 — grade overview (category chart)

**Calc** — `src/calc/overview.ts` (new):

```ts
categoryOverview(assignments: Assignment[], categories?: Category[]): {
  name: string;
  pointsEarned: number; pointsPossible: number;   // from visible assignments
  currentPct: number | null;                      // earned/possible, null if no points
  nominalWeightPct: number | null;                // declared weight; null when unweighted
  effectiveWeightPct: number;                     // share of the final grade *right now*
  contributionPct: number;                        // effectiveWeight × currentPct: points this category adds to the course %
  hidden?: { pointsEarned: number; pointsPossible: number };  // discrepancy vs. declared category totals
}[]
```

- Weighted: `effectiveWeightPct = weight / Σ(weights of categories with points)` — the
  renormalized truth ("Finals is 20% on paper but 0% of your grade today; Homework's 30%
  is really 37.5%"). This is the number the user asked for ("relative percentage to the
  final grade").
- Unweighted: one row per category label (or "All" when uncategorized),
  `effectiveWeightPct = category possible / total possible`, `nominalWeightPct = null`.
- Invariant (tested): Σ contributionPct = courseGrade.

**UI** — `src/pages/class/OverviewTab.jsx`: a table with two plain CSS bars per row —
current % in category, and effective weight share — plus the numbers (earned/possible,
current %, nominal vs. effective weight, contribution). Hidden-points rows flagged.
Respects hypothetical mode (reads `effective`), so it live-updates with edits.

Tests (`overview.test.ts`): weighted mid-term renormalization (sample ALGEBRA numbers),
unweighted shares, contribution-sum invariant, hidden-points surfacing, empty class.

## 9. Feature 5 — multi-assignment target calculator (popup)

Improvement over GradeCompass (theirs: one assignment at a time, no interaction).

**Behavior**

1. Popup lists selectable assignments: real ungraded ones (has `pointsPossible`, no
   `pointsEarned`) and any added hypotheticals; the student checks several.
2. Student enters a target % (with quick-pick letter buttons from the grade index, §11).
3. Calculator solves for **one uniform percentage** `p` applied to every selected
   assignment such that the course grade equals the target, and shows each assignment's
   needed points (`p × possible`) and the shared `p`.
4. When the student edits one assignment's score in the popup, that row becomes
   **locked** at the entered value; the solver re-runs over the remaining unlocked rows
   so the target still holds and the other rows visibly fluctuate. Rows can be
   unlocked (↺) to rejoin the average. All locked ⇒ just report the resulting grade
   vs. the target.

**Calc** — `src/calc/multiTarget.ts` (new):

```ts
solveUniformTarget(options: {
  targetPercentage: number;
  selections: { assignment: Assignment; lockedEarned?: number }[]; // all must have pointsPossible
  otherAssignments: Assignment[];   // the rest of `effective`, minus selections
  categories?: Category[];
}): { uniformPct: number; perAssignment: { id: string; pointsNeeded: number }[] }
 | { allLocked: true; resultingGrade: number }
 | { infeasible: true; reason: string }   // e.g. selection has zero unlocked points possible
```

Math (documented in the module):
locked selections and `otherAssignments` contribute fixed points; unlocked selections
contribute `p × possible_i`. The course grade is **linear in `p`** in both modes, so
there is a closed form:

- Unweighted: `p = (t·(P + S) − E) / S`, where `E`,`P` = fixed earned/possible
  (others + locked), `S` = Σ possible of unlocked selections, `t` = target/100.
- Weighted: course(p) `= A + B·p` with
  `A = Σ_c w_c·E_c/(P_c+S_c) / W`, `B = Σ_c w_c·S_c/(P_c+S_c) / W`,
  summing over **counted** categories (those with `P_c + S_c > 0` — note a selection in
  an empty category makes it counted, changing the renormalization, on purpose), `W` =
  their total weight. Then `p = (t − A) / B`; `B = 0` ⇒ infeasible.

Results outside 0–100% are shown, not clamped, with a note ("needs 108% — not possible
without extra credit"). Extra-credit selections have no denominator, so they can only be
locked (manual value), never part of the uniform average — the UI enforces this.

Tests (`multiTarget.test.ts`): every solution is verified by substituting back into
`courseGrade` (the pattern `full/` used for `target.ts`); lock/unlock re-solve cases;
weighted with an empty category joining; all-locked; infeasible; >100% flagged;
extra-credit locking. Property-style spot check: solving then locking one row at the
solved value must return the same `p` for the rest.

`target.ts` (single-assignment solver) stays — it's the degenerate case and already
tested — but the popup uses `multiTarget` exclusively.

## 10. Feature 6 — max/min grade calculator (popup)

**Behavior**: for each category the student enters points still to come (`remaining`)
and their expected worst/best average % on that remaining work. Unweighted classes get
a single "remaining points" row. Output: lowest and highest possible final grade (with
letters from the grade index), plus per-category detail.

**Calc** — `src/calc/bounds.ts` (new):

```ts
gradeBounds(options: {
  assignments: Assignment[];
  categories?: Category[];
  remaining: { category?: string; pointsRemaining: number; minPct: number; maxPct: number }[];
}): { min: number; max: number;
     perCategory: { name: string; min: number; max: number }[] }
```

Category grade with expectation `x`: `(E_c + x·R_c) / (P_c + R_c)`. The course grade is
monotone increasing in each `x`, so global min = all categories at `minPct`, max = all
at `maxPct` (no search needed; documented). Counted categories = those with
`P_c + R_c > 0` — entering remaining points for a currently-empty category (Finals)
pulls its weight in, which is exactly the "how much can finals hurt me" question.
Validation: `minPct ≤ maxPct`, `pointsRemaining ≥ 0`.

Defaults pre-filled per category: `remaining = 0`, min/max = the category's current %
(so the initial output brackets today's grade). Runs off **real** assignments by
default with a toggle to include the current hypothetical scenario.

Tests (`bounds.test.ts`): hand-computed weighted + unweighted cases; empty-category
pull-in; remaining=0 across the board reproduces current grade exactly (invariant);
min=max collapses the interval; monotonicity spot checks.

## 11. Grade index (per-class letter cutoffs)

**Key insight from GradeCompass**: it never computed cutoffs — it showed Synergy's own
letters (mark `_CalculatedScoreString`, per-category `_CalculatedMark`). The portal
applies each teacher's scale server-side. So the honest design is: **observe** the
(percentage, letter) pairs the portal exposes, **infer** what we can, **default** the
rest, and let the student **override**.

**Calc** — `src/calc/letters.ts` (new):

```ts
DEFAULT_SCALE  // A+ 97, A 93, A- 90, B+ 87 … D- 60, F 0 (lower bounds)
type Observation = { pct: number; letter: string };
inferScale(observations: Observation[], overrides: Partial<Record<Letter, number>>):
  { letter: string; lowerBound: number; source: 'observed' | 'default' | 'custom' }[]
resolveLetter(pct: number, scale): string
```

Inference: for each letter, the lowest observed pct is an upper estimate of its lower
bound; start from `DEFAULT_SCALE`, pull each letter's bound down to `min(observed pct)`
when observations sit below the default bound, then enforce monotonicity (a letter's
bound may not exceed the next-better letter's). Overrides win over everything.
Observed portal percentages are rounded by the portal — accepted as-is, noted in the
tab ("based on grades seen so far; refine manually if you know the exact cutoffs").

**Data** — `src/data/gradeIndexStore.js` (new): localStorage, keyed by class id.
On every successful sync, harvest observations — course mark (`percentage`, `letter`)
and each category's (`earned/possible %`, `letter`) — and merge them in (dedup, keep
extremes). This accumulates across the term: each new synced grade tightens the
inferred scale automatically, which is the "figures it out without manual input"
behavior, done honestly. Overrides live in the same store.

**UI** — `src/pages/class/GradeIndexTab.jsx`: table of letter → cutoff with a source
badge (observed / default / custom) and an editable cutoff field per row + reset.

**Used app-wide for computed grades**: the hypothetical header grade, target quick-pick
buttons ("A− needs 89.5%"), and max/min results all show `resolveLetter(...)`. The
portal's official letter is always displayed verbatim where official grades appear.
Demo verification: the "AP Biology" sample course (0c) must infer A ≈ 84 while Algebra
stays on the default scale.

Tests (`letters.test.ts`): default resolution; single low observation drags a bound
down; monotonicity enforcement; override precedence; harvest/merge dedup.

## 12. Page structure

`ClassDetail.jsx` becomes a thin shell: header (name, official grade, hypothetical
grade + letter when active) + sub-tab bar + `SyncPill`. New folder
`src/pages/class/`:

```
ClassDetail.jsx      shell + tabs (Assignments | Overview | Grade index)
useScenario.js       §4
GradeChart.jsx       §5   (Assignments tab, top)
AssignmentList.jsx   §6–7 (Assignments tab; current list + filters, moved)
OverviewTab.jsx      §8
GradeIndexTab.jsx    §11
TargetDialog.jsx     §9   (button in Assignments tab)
BoundsDialog.jsx     §10  (button in Assignments tab)
```

Dialogs are plain fixed-position overlays (no portal/library). The existing category
filter tabs and score-band bars carry over unchanged. Tab state is local; no routing
changes.

## 13. Build order & verification

Each phase ends with `npm test` green and a manual pass in demo mode
(`VITE_DEMO=true npm run dev`).

| Phase | Contents | Manual check |
|---|---|---|
| 0 | vitest + migrated calc tests; demo mode; richer sample data | app runs signed-in with no relay; 59 old tests pass in `github/` |
| 1 | `series.ts`, `overview.ts`, `multiTarget.ts`, `bounds.ts`, `letters.ts` + suites | tests only |
| 2 | `useScenario` + ClassDetail split into `pages/class/`; behavior parity with today | edits still recompute grade; toggle clears |
| 3 | GradeChart | line renders for sample classes; hypothetical edits reshape it |
| 4 | Add-hypothetical UI + impacts on added rows + hidden-points rows | add a Finals test → grade & chart & impact react |
| 5 | OverviewTab | ALGEBRA shows Finals 0% effective weight, Homework 37.5% |
| 6 | TargetDialog | pick 2 assignments, set 90%, lock one low → other rises; substitute-back matches |
| 7 | BoundsDialog | all-zero remaining reproduces current grade; Finals scenario |
| 8 | GradeIndexTab + store + app-wide letters | AP Bio sample infers A ≈ 84; override works |
| 9 | Cleanup: delete `historyByClass`/`useGradeHistory`, update `ADDING_REAL_DATA.md` + `README.md` | grep confirms no references |

## 14. Seamless real-data path (why nothing here is throwaway)

- Everything consumes domain `Assignment`/`Category` produced by `mapGradebook`. When
  `parseGradebook` is implemented (the one open backend task), real data flows into all
  eight features with **zero changes** — the placeholder auto-retires (existing
  fallback logic), demo mode stays a dev flag.
- The chart needs no history endpoint ever (derived series). If a real history source
  appears someday, it can replace `gradeSeries` behind the same component prop.
- The grade index is *designed* for real data: sample letters exercise the machinery
  now; real synced letters make it accurate automatically over the term.
- Risks to re-verify on first real data: real category names/letters may be messier
  than samples (harvest defensively — skip rows with empty letters); real gradebooks may
  hide assignments (hidden-points path §7 covers it); per-period marks are currently
  collapsed to the latest mark in `studentvue.js` — a period switcher is future work
  and orthogonal to this plan.

## 15. Out of scope (explicitly)

Custom visual design (stated); persistence of hypothetical scenarios across reloads;
report-period switching; mirroring back into `full/web` (deferred until the repos'
mirror strategy is revisited); GPA/multi-class aggregation.
