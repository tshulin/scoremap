# Grade data (Gradebook) — implementation plan

Scouted live on 2026-08-14 against `ca-pleas-psv.edupoint.com` (Foothill HS) with a real
StudentVue session. This replaces the guesswork in the `parseGradebook` stub's comment
block with a verified portal contract, and lays out the work to ship real grades.

## Status — implemented 2026-08-14

Phases 1–4 are code-complete and tested (16 new tests; full suite green). What landed,
all under `src/portal/pages/gradebook/` unless noted:

- `loadControl.ts` — the LoadControl POST helper (§1b), incl. `INVALID_CONTEXT` →
  `SessionExpiredError` and portal errors → `ModuleUnavailableError`.
- `landing.ts` — landing/`Gradebook_SchoolClasses` parser: periods from `PXP.GBFocusData`,
  class rows (both data-focus quoting styles), and the per-class `mayHaveWork` signal.
- `classDetail.ts` + `cells.ts` — fragment parser: mark/percentage, category grid
  (candidate keys; any unreadable row drops the lot, counted), assignment rows.
- `assignment.ts` — `gbRowToRaw` adapter: GB\* columns → the legacy raw keys, so
  `rawAssignmentToDomain` stays the single owner of score edge cases. Handles fraction
  ("8.00 / 10.0000") and "N Points Possible" points, mines `assignmentID` from the
  cell's data-focus, object-shaped cells, and scaled-score detection (numeric, so equal
  pairs rendered differently are not flagged).
- `index.ts` — request-minimizing orchestration (see §5): landing GET, detail POSTs only
  for classes with signs of work, 2-at-a-time, per-course/row/category degradation into
  the new `unreadable*` counters; period switching via `Gradebook_SchoolClasses`.
- `src/domain/gradebook.ts` — period dates optional; `unreadableCourses` /
  `unreadableAssignments` / `unreadableCategories` (all `.default(0)`).
- `scripts/capture-gradebook.ts` — now also captures per-class fragments through
  LoadControl and prints assignment-row KEYS (never values).

**Still open (blocked on teachers posting grades, ~late Aug 2026):** run the capture
script, then verify the populated row/category shapes against the adapter and
`toCategory` candidate keys — those two mappings are educated guesses (§1d) — and do
the live verification pass in Phase 4.3.

### Corroboration from other scrapers (added 2026-08-15)

Hustler's University is app-fixture-only (no real portal — its login page 404s), so the
populated row shape was cross-checked against open-source scrapers built on real
districts instead:

- `TheMoonThatRises/StudentVue.swift` (`Scraper/Models/GradeBook/GradeData.swift`):
  decodes assignment rows with a strict JSONDecoder — every declared key was present in
  live rows: `gradeBookId`, `studentId`, `Teacher`, `Date`, `googleAssignmentLink`, and
  the `GB*` columns (plus district-specific `GBDropBox`). Rows are flat; their
  last-`dataSource`-in-fragment extraction matches our category-then-assignments split.
- `RRyankees08/schoolday` (StudentVue web provider + migration
  `0003_studentvue_link_cells.sql`): their **production cache** stored titles beginning
  with `{"href":…,"dataType":"LinkColumn"}` — live proof that some cells arrive as
  JSON-stringified link objects whose `value` is the display text and whose
  `hrefAttributes` hide the data-focus. Their fixtures also show a second points
  convention (`GBScore: '17'` earned / `GBPoints: '20'` possible; non-numeric scores
  like `Missing` / `Not Due` when ungraded), an id under `GBAssignmentID`, combined
  landing marks (`A- 91.8%`), and `data-focus` present only on the mark-period button.

The adapter and parsers now handle all of the above (tests cover each): LinkColumn
unwrapping in `cells.ts`, id preference plain-key → mined `assignmentID` (tolerating
entity-encoded and JSON-escaped quotes), both points conventions, the landing-mark
letter/percent split in the no-detail fallback, and the mark-period-button focus
fallback. Still true: our own district's populated rows remain unobserved — the capture
run stays the acceptance test.

## TL;DR

- The whole pipeline already exists (domain schema → calc engine → snapshot → UI → demo
  fixtures). The stub at `src/portal/pages/gradebook/index.ts:79` is the gap — **but the
  stub's assumption is wrong**: assignments are NOT embedded in `PXP2_Gradebook.aspx`.
  They come per class from a JSON POST endpoint (`LoadControl`), so `fetchGradebook`
  becomes a small multi-request orchestrator (1 GET + 1 POST per class), not one parser.
- The legacy SOAP API (`ProcessWebServiceRequest`/`Gradebook` XML) is deprecated by
  Edupoint (error D5518-00, per gradecompass). The PXP2 web contract below is the route.
- The school year started this week: all 6 classes show mark **N/A** with **0 assignments**,
  so every `dataSource` is `[]`. The endpoint contract and grid *columns* are verified;
  the populated *row* shape is the one unknown. Phase 0 captures it the day teachers
  post grades; parser work that depends on row internals waits for that capture.

## 1. Verified portal contract (2026-08-14)

### 1a. Landing page — class list + period map

`GET /PXP2_Gradebook.aspx?AGU=0` (existing `getPage` works; redirect ⇒ out of term ⇒
`NoActiveGradingPeriodError`, unchanged).

The page embeds, as inline scripts:

- `PXP.GBFocusData = {...}` — Schools → GradingPeriods. Live values: schoolID 16, one
  school, **8 grading periods** (P1, Q1, P2, S1, P3, Q3, P4, S2), each with `GU`,
  `GroupName: "Regular"`, one MarkPeriod `{Name, GU}`, and `OrgYearGU`. **No start/end
  dates** — see gap §3c. `defaultFocus: true` marks the current period (Progress 1 now).
- `PXP.GBCurrentFocus = {...}` — `FocusArgs` with `studentGU`, `schoolID`, default
  `markPeriodGU`/`gradePeriodGU`, `OrgYearGU`, `AGU`.
- Server-rendered class rows (6 classes). Per class two `div.row.gb-class-row` blocks
  keyed by `data-guid="<classID>"`:
  - header row: course title button `N: Course Name`, teacher name, `Room: X`, and a
    `data-focus` attribute (HTML-entity-encoded JSON) holding the **complete parameter
    set for the class-detail call** (classID, markPeriodGU, gradePeriodGU, studentGU,
    OrgYearGU, schoolID, …).
  - detail row: `<span class="mark">N/A</span>` (letter when graded), missing-assignment
    count (`N Missing Assignments`), score-history sparkline `<ul class="score-history">`
    (empty now), `Last Update:` timestamp.

### 1b. LoadControl — the JSON POST that returns every gradebook view

```
POST /service/PXP2Communication.asmx/LoadControl
Content-Type: application/json; charset=utf-8
AGU: 0                          ← header the portal always sends
X-Requested-With: XMLHttpRequest
Cookie: ASP.NET_SessionId=…; EESPSV=…   (same jar as every other page)

{"request":{"control":"<ControlName>","parameters":{ …FocusArgs… }}}
```

Response envelope: `{"d":{"__type":"PXP.PXPInfo.PXPWebResponse","Error":null,
"Data":{"html":"<fragment>"},"DataType":"LoadControlResponse"}}`.

- `d.Error.Message === 'INVALID_CONTEXT'` ⇒ session expired (the portal's own JS
  redirects to logout on this) — map to `SessionExpiredError` so `withSession` re-logs.
- Other non-null `d.Error` ⇒ surface as `ModuleUnavailableError`/`ParseError`.

Controls (first two live-verified with HTTP 200 + expected fragments):

| Control | Parameters | Returns |
|---|---|---|
| `Gradebook_ClassDetails` | the class row's `data-focus` FocusArgs verbatim | class fragment (below) |
| `Gradebook_SchoolClasses` | `{schoolID, OrgYearGU, gradePeriodGU, GradingPeriodGroup, AGU}` | class-list HTML for any grading period (~50 KB) — same row shape as the landing page |
| `Gradebook_AssignmentDetails` | FocusArgs + `assignmentID` | single-assignment fragment (not exercised — no assignments exist yet) |

### 1c. Class-detail fragment (`Gradebook_ClassDetails`)

- `#current-grade` → `<div class="mark">N/A</div>` + `<div class="score">0.0%</div>` —
  the class letter + percentage for the requested mark period.
- `#CategoryWeightingGrid` → `dxDataGrid(PXP.DevExpress.ExtendGridConfiguration({…}))` —
  category weights grid. Config was `{}` (class has no categories yet); populated shape
  needs the Phase 0 capture.
- `#AssignmentsGrid` → same pattern, with the full column contract (verified):
  `Date`, `googleAssignmentLink` (html), `GBAssignment` (html — assignment link whose
  `data-focus` carries `assignmentID`), `GBAssignmentType`, `GBSubject`, `GBResources`,
  `GBScore` (html), `GBScoreType`, `GBPoints`, `GBNotes` (html).
  Key facts: `"dataSource":[…]` is **inline in the fragment** and `remoteOperations:false`
  with client-side paging (pageSize 100) — **all assignment rows arrive in this one
  response**; no further requests. `encodeHtml:false` columns contain raw HTML that must
  be stripped/mined.
- `PXP.GBWI_Translation = {...}` — what-if calculator strings (UI-only; ignore).

### 1d. What is still unknown (needs a populated capture)

- The exact **keys inside a populated `dataSource` row**. Columns are `GB*`-prefixed, but
  DevExpress rows routinely carry extra non-column fields, and `calculateDisplayValue:
  PXP.DataGridTemplates.CalculateValue` hints cell values may be objects rather than bare
  strings. Do not write the row adapter until one real row is captured.
- The populated CategoryWeightingGrid config/columns.
- The `GBPoints` text format (expected `"x / y"` and `"N Points Possible"` — the existing
  `pointsPossibleFromText` already handles both).

## 2. What already exists (do not rebuild)

Per the repo (fresh pull, `main` @ c5790aa9):

- `src/portal/pages/gradebook/index.ts` — `fetchGradebook` + `parseGradebook` stub (:79).
- `src/portal/pages/gradebook/assignment.ts` — `rawAssignmentToDomain(row)` encodes every
  score edge case (`Point:''`→0 vs absent→ungraded, `PointPossible:''`→extra credit,
  `(Not For Grading)` notes, scaled vs unscaled). Keep it; feed it via an adapter (§4.2).
- `src/domain/gradebook.ts` — full Zod schema; `src/calc/*` — complete grade engine.
- `src/data/studentvue.js` — `mapGradebook` (:90), sync scope `'gradebook'`, merge (:423),
  friendly errors; `src/data/api.js` — `getGradebook` (:446) with placeholder fallback.
- UI: Dashboard, ClassDetail + tabs, Sidebar, GPA calc — all read the mapped snapshot.
- Fixtures: `SAMPLE_GRADEBOOK` / `TEST_GRADEBOOK` / `DISPLAY_GRADEBOOK` all validate
  against the schema at import — no new demo data needed.
- Extract helpers: `extractJsonAfter`, `findDataSourceWithKeys`, `decodeEntities`,
  `stripTags`, `toIsoDate`; error taxonomy incl. `NoActiveGradingPeriodError`.
- Transport: `createRelayFetch` (MAX_CONNECTIONS=2, pooled keep-alive), `CookieJar`,
  `fetchFollow`; `withSession` retry-once-on-expiry.

## 3. Gaps between the contract and the current code

a. **`fetchGradebook` is single-GET; the portal is GET + N×POST.** Needs a `loadControl()`
   helper in the portal layer and per-class orchestration.
b. **`rawAssignmentToDomain` reads SOAP-era keys** (`Point`, `PointPossible`, `Measure`,
   `GradebookID`, …); the live grid speaks `GB*` columns. Bridge with a small adapter
   (GB row → raw keys) written against the Phase 0 capture — do not fork the normalizer.
c. **`ReportPeriodSchema` requires `startDate`/`endDate`**, which the gradebook page does
   not expose. `mapGradebook` only uses `name` + `index` → make both dates `.optional()`
   (fixtures keep passing; nothing else reads them).
d. **Period selection is display-only** (`gradebookPath(_periodIndex)` ignores its arg;
   Dashboard quarter selector is cosmetic). Real switching = `Gradebook_SchoolClasses`
   with the period's `gradePeriodGU` + per-class `Gradebook_ClassDetails` with that
   period's `markPeriodGU`. Phase 3 — not needed to ship current grades.
e. **Session-expiry detection for JSON POSTs** — `assertSessionAlive` checks pages;
   LoadControl signals expiry via `INVALID_CONTEXT` (§1b). Handle in `loadControl()`.

## 4. Implementation plan

### Phase 0 — capture (blocked on teachers posting grades; check in ~1–2 weeks)

1. Extend `scripts/capture-gradebook.ts`: after dumping the landing page, parse the class
   rows' `data-focus` args and POST `Gradebook_ClassDetails` per class; save each raw
   envelope + fragment to `captures/` (gitignored). Also capture one
   `Gradebook_AssignmentDetails` and one non-default `Gradebook_SchoolClasses`.
2. Run it once real assignments exist (the six AP classes will fill within days once
   grading starts). Sanitize one class into a checked-in test fixture (fake names/GUs).
3. Record the populated row/category shapes back into this file (§1d).

### Phase 1 — portal layer (`src/portal/pages/gradebook/`)

1. `loadControl(session, control, parameters, options)` (new, in a `loadControl.ts` or
   inline): `fetchFollow` POST per §1b, parse the `d` envelope, map `INVALID_CONTEXT` →
   `SessionExpiredError`, other `d.Error` → `ModuleUnavailableError`; missing
   `d.Data.html` → `ParseError`.
2. `parseGradebookLanding(html)` (pure): extract `PXP.GBFocusData` /`PXP.GBCurrentFocus`
   via `extractJsonAfter(html, 'PXP.GBFocusData = ')` (needle is an assignment, not
   `"dataSource":` — the helper already scans balanced JSON so it works as-is); extract
   class rows (classID from `data-guid`, title/period from the course button text
   `"N: Name"`, teacher, room, mark span, missing count, and the `decodeEntities`'d
   `data-focus` JSON). Returns `{ focus, periods, classes[] }`.
3. `parseClassDetail(html)` (pure): current mark/score from `#current-grade`; categories
   from the CategoryWeightingGrid `dataSource` (via `extractJsonAfter` scoped to that
   block); assignment rows from the AssignmentsGrid `dataSource`
   (`findDataSourceWithKeys(html, ['GBAssignment', 'GBPoints'])`).
4. Row adapter `gbRowToRaw(row)`: strip/mine HTML cells (assignment name + `assignmentID`
   from `GBAssignment`; notes text from `GBNotes`; points from `GBPoints`), tolerate
   string-or-`{value}` cells, emit the raw keys `rawAssignmentToDomain` expects. Exact
   mapping finalized against the Phase 0 capture.
5. `fetchGradebook(session, periodIndex?, options)` orchestration:
   - GET landing → parse; classes with no detail needed? No — always fetch details
     **sequentially or 2-at-a-time** (transport pools onto MAX_CONNECTIONS=2 anyway).
   - Optimization: skip `Gradebook_ClassDetails` for classes whose row shows `N/A` mark
     AND `0 Missing Assignments` AND empty score history — early-term syncs then cost
     1 request instead of 7. (Keep a "fetched anyway" fallback behind a flag if this
     proves too clever; revisit after capture.)
   - Assemble `Gradebook`: `reportingPeriods` from `GBFocusData` (index = array order,
     name = `Name`, dates omitted), `currentPeriodIndex` = the `defaultFocus` period,
     one `Mark` per course (name/shortName from the MarkPeriod, e.g. "P1"; letter '' when
     the portal shows N/A so `mapGradebook`'s `graded` check stays false; percentage from
     `#current-grade` score), `categories` when present, assignments via adapter →
     `rawAssignmentToDomain` with per-row try/catch on `ParseError` (mirror
     `attendance.ts:79-86`; count, don't fail the course).
   - Validate with `GradebookSchema` before returning.
6. Schema tweak (§3c): `startDate`/`endDate` → `.optional()` in `ReportPeriodSchema`.

### Phase 2 — data layer

Nothing structural: `getGradebook` → `fetchGradebook` already wired; merge, placeholder
fallback, `harvestFromClasses`, SyncPill states all work as-is. Only check that
`friendlyGradebookMessage` reads well for the new failure modes.

### Phase 3 — real period switching (separate, later)

Thread `periodIndex` through `api.getGradebook()` → `FETCHERS.gradebook` → `sync` scope;
implement via `Gradebook_SchoolClasses` + per-class details with that period's GUs
(§1b). Budget: 1 + up to 6 requests per viewed period; fetch on demand, cache in the
snapshot keyed by period. Do NOT sync all 8 periods eagerly (49 requests — blows the
30-connections/min relay budget alongside mail).

### Phase 4 — tests & verification

1. `gradebook.test.ts` with the `fakeFetch` harness from `mail.test.ts`: landing HTML +
   per-class LoadControl JSON envelopes from the sanitized capture; assert the assembled
   `Gradebook`, the N/A path, the `INVALID_CONTEXT` → `SessionExpiredError` path, and
   per-row degradation.
2. Adapter unit tests per captured edge case (extra credit, ungraded, not-for-grading,
   scaled scores) — reuse the expectations already in `assignment.ts`.
3. Live verification (per the stub's own checklist + memory recipe): unset
   `VITE_PLACEHOLDER_DATA`, sync the real account, compare all 6 classes' letter+percentage
   against the portal, and confirm `src/calc`'s recomputed grade matches the portal's
   (weighted and unweighted). Run `npx vitest` from `github/` (never the workspace root).

## 5. Request budget (relay constraints)

Steady-state gradebook sync: **1 GET + 6 POSTs = 7 requests**, over ≤2 pooled TLS
connections (same order as mail's 1+8). Relay caps: 8 concurrent / 30 per min per IP —
a full all-resources sync stays within budget because the transport pools connections.
The early-term skip (§4 Phase 1.5) drops it to 1 request until grades appear.

## 6. Risks / open questions

- **Populated row shape is unconfirmed** (§1d) — the single real risk. Mitigation:
  Phase 0 capture gates the adapter; everything else can be built and tested against
  empty-state captures already in hand.
- `AGU: 0` header + `X-Requested-With` were sent in the verified calls; keep both (cheap,
  matches the browser) even if the server may not require them.
- Multi-school students: `GBFocusData.Schools` is an array; the plan handles index 0 and
  should throw `ParseError` (not silently drop) if more than one school appears.
- `GradingPeriodGroup` ("Regular") — pass through from `GBFocusData`; other districts may
  have multiple groups per school; same single-value guard.
- Mark-period vs grading-period: each grading period here has exactly one MarkPeriod;
  if a capture ever shows several, the class row's own `data-focus` still names the right
  `markPeriodGU`, so use the row's args verbatim rather than recomputing.

## 7. Non-goals (for this effort)

- Writing anything to the portal (what-if stays client-side in `src/calc`).
- Eager multi-period/history sync (§ Phase 3 does it lazily).
- `Gradebook_AssignmentDetails` deep-links, Google Classroom links, resources downloads —
  the schema has optional slots (`resources`, `description`) to add later.
