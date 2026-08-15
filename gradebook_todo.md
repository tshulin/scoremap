# Gradebook: what's left before it is fully functional and not a guess

Companion to `gradedata.md` (the portal contract + implementation log). This file is
the honest ledger of what is proven, what is corroborated-but-unconfirmed, and what is
still missing entirely — and how each item gets closed.

## Where things stand

Three tiers of confidence:

**Verified live against our portal (2026-08-14):** the endpoints and envelope
(`LoadControl` POST, `{d:{Error,Data:{html}}}`), the landing-page markup (class rows,
marks, missing counts, `PXP.GBFocusData` period map), the class-detail fragment layout
(`#current-grade`, category grid before assignments grid, inline `dataSource`), the
assignment grid's column names (`GB*`), the empty states, and the session-expiry signal
(`INVALID_CONTEXT`).

**Corroborated by other districts' scrapers (2026-08-15, see gradedata.md
§Corroboration):** populated rows are flat JSON objects with string cells; id keys
`gradeBookId` / `GBAssignmentID`; cells can arrive as JSON-stringified LinkColumn
objects; two points conventions ("8.00 / 10.0000" fraction vs GBScore=earned +
GBPoints=possible with `Missing`/`Not Due` states); combined landing marks
("A- 91.8%"). All handled and unit-tested — but against *reconstructed* rows, not ours.

**Still a guess until our own capture:** everything in the next section.

## The acceptance test: one capture run

Everything "guessed" is closed by a single run of `scripts/capture-gradebook.ts` once
teachers post grades (Pleasanton started 2026-08-11; expect real rows from ~late Aug):

```
RELAY_URL=ws://localhost:8080 SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com \
SYNERGY_USERNAME=... SYNERGY_PASSWORD=... npx tsx scripts/capture-gradebook.ts
```

It saves every class's detail fragment to `captures/` (gitignored — real data, never
commit) and prints the assignment-row KEYS (column names only, no values). Diff those
keys against `gbRowToRaw` in `src/portal/pages/gradebook/assignment.ts`, then sanitize
one class into a committed test fixture.

## Guesses that must be verified against our capture

1. **Assignment row internals** — the exact key set and value formats of our district's
   populated rows. The adapter covers every shape seen elsewhere, but Synergy versions
   differ per district. *Risk if wrong:* rows land in `unreadableAssignments` instead
   of the list (grades still display; assignment lists come up empty).

2. **The category-weights grid** (`toCategory` in `classDetail.ts`) — the weakest guess
   in the codebase. Our live grid config was literally `{}`, so the candidate keys
   (`CategoryName`/`Weight`/`Points`/`PointsPossible`/`WeightedPct`/`CalculatedMark`)
   come from the legacy XML, and no other scraper reads this grid the way our fragment
   renders it (one reads a plain HTML table from the landing page's expandable
   class-info panel instead — check both places in the capture). *Risk if wrong:*
   weighted classes silently fall back to straight-points what-if math; the displayed
   grade stays correct because it comes from `#current-grade`.

3. **Extra credit in the GB shape** — the legacy signal is `PointPossible: ''`; how the
   GB text renders it ("3.00 / 0.00"? blank possible? a flag?) is unobserved. A "x / 0"
   form happens to compute correctly through the point totals, but `extraCredit` would
   be `false`, so the calc engine's extra-credit handling (and the cyan UI band) would
   not engage. Needs one real extra-credit row.

4. **Scaled scores** — `unscaledPoints` is only inferred when a "N out of M" raw-score
   text differs numerically from the points fraction. Whether our district renders
   scaled rows that way is unobserved. Needs one real scaled row (teacher entered
   8/10, counted as 4/5).

5. **Not-for-grading marker** — assumed to be the same `(Not For Grading)` prefix in
   `GBNotes` text that the legacy shape used in `Notes`. Needs one real such row.

6. **`Date`/`DueDate` presence and format** — the domain schema requires a date per
   assignment and `toIsoDate` accepts ISO or `MM/DD/YYYY`. One scraper's model proves
   `Date` exists on its district; if ours ever omits it, those rows become unreadable
   and the schema decision (make date optional?) has to be revisited.

7. **The live verification pass** (gradedata.md Phase 4.3) — with
   `VITE_PLACEHOLDER_DATA` unset, sync the real account and check every class's letter
   and percentage against the portal itself, and check that `src/calc`'s recomputed
   grade matches the portal's for at least one weighted and one unweighted class. This
   is the only step that proves the whole chain end-to-end.

## Features not yet implemented (no guesswork — just not built)

1. **Period switching in the UI.** The backend takes `periodIndex` (one extra request
   per non-default period), but nothing passes it: the Dashboard quarter selector is
   display-only. Needs threading through `api.getGradebook(periodIndex)` →
   `FETCHERS.gradebook` → `sync()`, plus a decision on caching non-current periods in
   the snapshot (they are historical — cache them keyed by period and never re-fetch).

2. **Surfacing the `unreadable*` counters.** `unreadableCourses` /
   `unreadableAssignments` / `unreadableCategories` flow into the synced gradebook but
   no UI reads them. Follow the attendance pattern: a SyncPill/meta warning when any is
   nonzero. This matters beyond UX — a nonzero counter in production is **how we find
   out the portal changed shape** (it is how the attendance reconstruction was designed
   to be falsified, per scripts/CLAUDE.md).

3. **Assignment resources and description.** The `GBResources` column is ignored and
   the `Gradebook_AssignmentDetails` control (per-assignment fragment, verified to
   exist) is never called. The domain already has optional `resources`/`description`
   slots. If added, lazy-load on open exactly like mail bodies — one request per opened
   assignment, never prefetched.

4. **Google Classroom links** — `googleAssignmentLink` is parsed past, not shown.

5. **Portal score history.** Each landing class row carries the portal's own
   grade-over-time sparkline data (`<ul class="score-history">`). The app derives its
   series from assignments, which is empty before the first assignments sync — the
   portal history could backfill earlier movement. Optional nicety.

6. **Missing-assignments count.** Parsed (it feeds the skip signal) but not displayed.
   Could power a dashboard badge for free.

## Definition of done

- Capture keys match the adapter; a sanitized fixture from OUR district is committed
  and drives the tests (replacing the reconstructed rows as the primary fixtures).
- A real sync shows all `unreadable*` counters at 0 — and the UI would tell us if they
  weren't.
- Portal letter + percentage == app display == `src/calc` recomputation, for every
  class, weighted and unweighted.
- An extra-credit, a not-for-grading, and (if one exists) a scaled row each round-trip
  correctly.
- Period switching verified against the portal's own quarter view.
