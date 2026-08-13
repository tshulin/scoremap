# Grademax backend — execution plan

From the current state (working portal login + capture/smoke scripts in plain `.mjs`) to a
complete, tested TypeScript backend that a React frontend can connect to.

---

## Guiding decisions (locked in unless revisited)

| Decision | Choice | Why |
|---|---|---|
| Language | TypeScript, `strict: true` | project goal |
| Runtime | **Node.js 22 LTS** (`engines` field + `.nvmrc`) | most mature; solid on Windows; widest deploy targets |
| Package manager | npm (bundled with Node; pnpm works too) | zero extra installs |
| TS execution | `tsx` for dev & tools — no build step; `tsc --noEmit` for typechecking | run TS directly, same feel as Bun |
| HTTP framework | Hono + `@hono/node-server` adapter | tiny, TS-first, easy to test via `app.request()` |
| Validation | Zod | schemas double as parse-time validation and API contract |
| Tests | Vitest | TS out of the box; watch mode; `vi` fakes for timers/fetch |

### Bun → Node: the concrete changes

The original GradeCompass (and the first draft of this plan) used Bun. We build on Node
instead. Only tooling moves — no application code in this plan is affected:

1. **Toolchain** — install Node 22 LTS; commit `.nvmrc` (`22`) and set
   `"engines": { "node": ">=22" }` in `package.json`. `npm install` replaces
   `bun install` (lockfile: `package-lock.json`).
2. **Running TS** — `bun file.ts` becomes `npx tsx file.ts`; all package scripts and
   `tools/*` invocations go through `tsx`. Still no build step (`tsc --noEmit` is
   typecheck-only).
3. **Tests** — `bun:test` becomes Vitest: `vitest.config.ts`, imports from `'vitest'`
   (`describe/it/expect/vi`); the session-TTL tests use `vi.useFakeTimers()`.
4. **Server entry** — instead of exporting the app for `Bun.serve`, `src/index.ts` calls
   `serve({ fetch: app.fetch, port })` from `@hono/node-server`. This is the only
   Hono-related difference; all route/middleware code is identical.
5. **Dependencies** — runtime: `hono`, `@hono/node-server`, `zod`; dev: `typescript`,
   `tsx`, `vitest`, `@types/node`, ESLint + Prettier.
6. **Keep-out rule** — nothing may import `bun:*` or touch the `Bun` global; enforced via
   ESLint (`no-restricted-imports` / `no-restricted-globals`) so the codebase never
   silently re-couples to Bun.
7. **Platform floor** — everything the plan relies on ships in Node 22: global `fetch`,
   `Headers.getSetCookie()` (≥ 18.15), `AbortSignal.timeout`, `crypto.randomUUID`.
8. **Unchanged** — Hono routes, Zod schemas, all `portal`/`extract`/`domain`/`calc` code
   (pure ESM over global fetch), the mock portal, fixtures, and today's `.mjs` scripts
   (already Node-compatible: `node pull-real-data.mjs all`). The `gradecompass/` reference
   clone keeps using Bun for its own dev server — irrelevant to this backend.
| **No legacy XML layer** | Parse portal HTML → clean domain objects → JSON | The old app translated scrapes back into legacy SOAP XML so its old client kept working. We have no old client. Deleting that entire layer (SOAP envelopes, `RT_ERROR`, `fast-xml-parser`, `_`-prefixed attribute types) is the single biggest cleanup of this rebuild. |
| API auth | Backend-issued opaque bearer token → in-memory session (portal cookie jar + credentials for silent re-login). Nothing persisted to disk. | Cleaner than the original's "browser stores plaintext credentials in localStorage and sends them with every request" |
| Grade-calc engine | Pure-TS module in this repo, zero framework deps | testable now; importable by the React frontend later (calcs are interactive, so they will run client-side too) |

Out of scope for this plan: mail/messages module (the original never finished it either),
multi-student (AGU switching — we hardcode `AGU=0` like the reference), deployment.

## Target layout (this repo)

```
src/
  portal/            # talks to the real StudentVUE PXP2 portal
    http.ts          #   cookie-jar fetch, manual redirects        (Part 1)
    login.ts         #   WebForms login                            (Part 2)
    session.ts       #   session objects + store + re-login       (Part 2)
    pages/           #   one module per portal page                (Parts 5, 7)
      studentInfo.ts   documents.ts   attendance.ts   gradebook.ts
  extract/           # HTML/JSON scraping toolkit                  (Part 3)
  domain/            # clean types + Zod schemas = the API shape   (Part 4)
  calc/              # grade-calculation engine (shared w/ FE)     (Part 8)
  api/               # Hono app: routes, auth middleware, errors   (Part 9)
  mock/              # fake portal server for offline dev/tests    (Part 6)
tools/               # capture/sanitize/smoke scripts (TS versions of today's .mjs)
test/fixtures/       # sanitized portal HTML + synthetic gradebook cases
```

Dependency order: 0 → 1 → 2 → 3 → (4, 5, 6) → 7 → 9 → 10 → [frontend] → 11 → 12.
Part 8 (calc) only needs Part 4 and can be built any time after it. Part 7b is **blocked
on an active grading period** — everything else proceeds without it. Parts 11–12 run after
the frontend is connected (see their sections).

---

## Part 0 — Scaffold & tooling

**Goal:** a TS project where `npm run check` (typecheck + lint + test) passes on every part
that follows.

**Code:**
- `package.json` — `"type": "module"`, `"engines": { "node": ">=22" }`; scripts:
  `dev` (`tsx watch src/index.ts`), `dev:mock`, `test` (`vitest run`), `lint`, `format`,
  `check` (typecheck + lint + test). `.nvmrc` with `22`.
- `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `module`/`moduleResolution`
  `nodenext`), `vitest.config.ts`, ESLint flat config + Prettier (tabs, match existing
  style) including the no-`bun:*` restriction from the migration notes above.
- Deps: `hono`, `@hono/node-server`, `zod`; dev: `typescript`, `tsx`, `vitest`,
  `@types/node`.
- Directory skeleton above. Existing `.mjs` scripts stay untouched until each is superseded.

**Done when:** empty `src/` typechecks; one placeholder Vitest test runs; `npm run check`
is green on Node 22.

---

## Part 1 — Portal HTTP core (`src/portal/http.ts`)

**Goal:** TS port of `lib/http.mjs` — the one piece of code every other part sits on.

**Code & details:**
- `CookieJar` class (Map wrapper) with `CookieJar.fromCookieString()`, `.header()`,
  `.absorb(response)` (as built — replaces the free functions
  `jarFromCookieString`/`cookieHeader` first drafted here). Rejects empty cookie names.
- `fetchFollow(url, init, jar)` → `{ body, finalUrl, redirected, status }` and
  `fetchFollowRaw(...)` → `{ response, finalUrl, redirected }` (raw variant is required
  later for binary bodies: document PDFs, student photo).
- Behaviors to preserve exactly (they were learned from the live portal):
  - `redirect: 'manual'` with hop loop (max 10) — **the portal sets cookies on 302 hops**;
    automatic redirect following loses them.
  - Absorb `Set-Cookie` via `headers.getSetCookie()` with single-header fallback.
  - Redirected hops downgrade to `GET` (mirrors browser behavior after POST login).
  - Browser-like `User-Agent` (portal serves different markup to unknown agents).
  - `redirected` flag preserved — it is the *signal* for "module bounced to Home".
- New over the `.mjs` version: per-request timeout via `AbortSignal.timeout(…)` (default
  ~15 s), `PortalHttpError` with url/status context. **Inject `fetch`** (constructor or
  param) so tests never touch the network.

**Tests:** fake fetch returning scripted hop sequences — cookie accumulation across two
302s; redirect-loop guard throws; cookie header round-trip; `getSetCookie` fallback path;
timeout surfaces as `PortalHttpError`.

**Done when:** `tools/pull-real-data.ts` (trivial port of the current smoke script, run
via `npx tsx`) runs green against the real portal using this module.

---

## Part 2 — Login & sessions (`src/portal/login.ts`, `src/portal/session.ts`)

**Goal:** credentials → authenticated session; sessions survive reuse and silently
re-login when the portal expires them (~20 min idle).

**Code & details — login (port of `lib/login.mjs`):**
- GET `PXP2_Login_Student.aspx?regenerateSessionId=True` (seeds `ASP.NET_SessionId` +
  `EESPSV` cookies via redirect), scrape all `<input>` fields (keeps `__VIEWSTATE`,
  `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`; skip unchecked checkboxes/radios; decode
  HTML entities in names/values), find user/pass fields by `/user/i`, `/pass|pwd/i` name
  match, POST as `application/x-www-form-urlencoded` to the *final* login URL.
- Failure detection: response body still contains `type="password"` → bad credentials.
- Error taxonomy (all extend `PortalError`): `AuthError` (bad creds), `PortalShapeError`
  (no `__VIEWSTATE` → wrong domain / unrecognized page), `PortalHttpError`, and (as built)
  `InvalidDomainError` for domain-validation failures.
- Input hardening: `domain` must be a bare hostname (no scheme/path/port) — reject
  anything else before building URLs (prevents SSRF through the login endpoint later).

**Code & details — sessions:**
- `PortalSession { domain, jar, createdAt, lastUsedAt }`.
- `SessionStore` (in-memory `Map<token, { session, creds }>`): token = 128-bit random
  (`crypto.randomUUID` is fine), sliding TTL 20 min, periodic sweep. Credentials stay in
  memory only — never logged, never persisted.
- **Single-flight login:** concurrent logins for the same `(domain, username)` share one
  in-flight promise (the old app keyed a cache on `sha256(domain+user+pass)` for the same
  reason).
- **Expiry recovery** (as built): page clients call `assertSessionAlive(page)` after each
  fetch — it throws `SessionExpiredError` when the redirect chain landed on
  `PXP2_Login_Student.aspx`. `store.withSession(token, fn)` catches that, re-logins once
  with stored creds (single-flight), swaps the jar, and retries `fn` once; sessions
  adopted from a bare cookie (`store.adopt(session)`) have no creds and surface the error.

**Tests:** login POST body contains hidden fields + injected creds (fixture login page);
bad-creds path; no-`__VIEWSTATE` path; hostname validation; single-flight (two concurrent
calls → one login fetch sequence); expiry recovery (first fetch redirects to login page,
re-login, retry succeeds); TTL eviction with fake clock.

**Done when:** `tools/pull-real-data.ts all` works with either `SYNERGY_COOKIE` or
username/password env vars (same UX as today), via the new TS modules.

---

## Part 3 — Extraction toolkit (`src/extract/`)

**Goal:** every scraping trick the portal requires, in one tested module — page parsers
(Part 5/7) then become short and boring.

**Code & details** (ported from reference `translate.ts` / `client.ts`, our `.mjs` libs):
- `extractJsonAfter(source, needle)` — balanced-literal scanner (depth counting,
  string/escape aware) that pulls the JSON array/object right after a needle. This is how
  **all grid data** is read: DevExpress grids embed rows as `"dataSource":[…]` in page HTML.
- `findDataSourceWithKeys(html, keys[])` — iterate *every* `"dataSource":` occurrence and
  return the first whose first row has one of `keys` (pages contain several dataSources:
  column filters, lookups, plus the real grid). As built it also skips string-array
  dataSources and non-object rows.
- `countDataSources(html)` (diagnostics), `stripTags`, `decodeEntities` (named + numeric).
- `parseLabeledFields(html)` — the `<span class="tbl_label">Label</span><br>value` table
  scraper used by student info; tolerant of extra span attributes/classes and `<br>` vs
  `<br />` (verified against the live student page).
- `bootstrapValue(html, key)` — reads the per-page nav JSON (`"photo":"…"`, `"school":"…"`),
  JSON-parsing the quoted token so escapes decode and key-suffix collisions are avoided.
  (Note: `studentGU` was **not** present on the live ca-pleas documents page — the domain
  model does not depend on it.)
- Module-redirect helper: `assertNotBounced(page, moduleName)` → typed
  `ModuleUnavailableError` when `redirected` is true (lives in `src/extract/module.ts`).

**Tests (pure, no fixtures needed beyond small strings):** nested JSON, braces inside
strings, escaped quotes, needle-not-found, malformed JSON → `undefined`; multiple
dataSources with the key-matching selection; entity decoding; labeled-fields scrape.

---

## Part 4 — Domain model (`src/domain/`)

**Goal:** the types the whole system (and the frontend) speaks. This *is* the API
contract, so it gets designed once, carefully: camelCase, real `number`s, ISO-8601 date
strings — none of the legacy `_Attribute` string-typed shapes.

**Code & details** — Zod schemas with inferred TS types:
- `StudentInfo`: `{ name, permId, gender, grade, photoBase64? }`.
- `DocumentMeta`: `{ docToken, title, category, uploadDate }` (docToken is the download
  key, scraped from the row's anchor `docToken=` param).
- `Attendance`: `{ schoolName, absences: [{ date, reason, note, periods?[] }], totals? }`
  (structure best-effort until a populated capture exists — flagged in Part 5).
- `Gradebook`: `{ reportingPeriods: [{ index, name, startDate, endDate }],
  currentPeriodIndex, courses: Course[] }`.
- `Course`: `{ courseId, name, title, period, room, staff: { name, email?, gu? },
  imageType?, marks: Mark[] }` (array — the original hit real courses with multiple marks,
  PR #196).
- `Mark`: `{ name, shortName, letter, percentage, categories?: Category[],
  assignments: Assignment[] }`; `Category`: `{ name, weightPercentage, pointsEarned,
  pointsPossible, weightedPercentage, letter }` (percent strings like `"40%"` parsed to
  numbers at the boundary).
- `Assignment` — the load-bearing type. Normalized once, here, so neither parser nor calc
  engine ever re-reads raw portal fields:
  - `pointsEarned?: number` (raw `Point === ''` ⇒ `0`; absent ⇒ `undefined` = not graded)
  - `pointsPossible?: number` (fallback chain: `PointPossible` → `ScoreMaxValue` → parse
    from `Points` text)
  - `extraCredit: boolean` (**raw `PointPossible === ''`** — empty string, not 0)
  - `notForGrade: boolean` (`Notes` starts with `"(Not For Grading)"`)
  - `unscaledPoints?: { pointsEarned, pointsPossible }` (present only when
    `Point/PointPossible` ≠ `ScoreCalValue/ScoreMaxValue` — i.e. teacher scaled the score)
  - `category?`, `date`, `dueDate?`, `name`, `id`, `description?`, `comments?` (notes with
    the not-for-grading prefix stripped), `resources?[]`
- `PortalErrorCode` union used by the API: `AUTH_FAILED | SESSION_EXPIRED |
  NO_ACTIVE_GRADING_PERIOD | MODULE_UNAVAILABLE | PORTAL_UNAVAILABLE | PARSE_FAILED |
  VALIDATION`.

**Reference:** `gradecompass/docs/assignment_edge_cases.md` — every row of that table must
map to a documented rule here. Get one wrong ⇒ wrong grades.

**Tests:** schema round-trips; the normalization rules unit-tested in Part 5/7 where the
mapping code lives.

---

## Part 5 — Page clients: student info, documents, attendance (`src/portal/pages/`)

**Goal:** the three resources already proven live in the reference implementation, now
emitting domain objects directly.

**Code & details:**
- `studentInfo.ts` — GET `PXP2_Student.aspx?AGU=0`; `parseLabeledFields`; label variants
  (`Student Name`|`Name`, `Perm ID`|`Student ID`); redirected-or-empty ⇒ `PARSE_FAILED`.
  Photo: `bootstrapValue(html,'photo')` → binary fetch via `fetchFollowRaw` → base64;
  photo failure degrades to `undefined`, never fails the request. Doubles as the
  login-validation call (`checkLogin`).
- `documents.ts` — GET `PXP2_Documents.aspx?AGU=0`;
  `findDataSourceWithKeys(html, ['DocumentUploadDate','DocumentTitle'])`; per row: title
  cell is HTML — `docToken` from the anchor href, display title via `stripTags`; category,
  upload date. `downloadDocument(session, docToken)` — GET
  `PXP_ShowDocument.aspx?AGU=&docToken=…` via raw fetch; **a `text/html` response means
  expired token/error page, not a document** → `MODULE_UNAVAILABLE`; return
  `{ bytes, mimeType, fileName }` (content-type/disposition headers, default
  `application/pdf`).
- `attendance.ts` — GET `PXP2_Attendance.aspx?AGU=0`; school from
  `bootstrapValue(html,'school')`; rows from the dataSource. **Live findings (2026-07-15):**
  the test account has zero absences — the grid renders literally `"dataSource":[]`, which
  is a valid empty result, not an error. The row field names come from the grid's own
  column config (`"dataField"`): **`Date`, `AttAllDayReason`, `AttPeriods`** — *not* the
  reference's `AbsenceDate`/`Reason`/`Note`. The row *mapping* therefore remains
  best-effort (fixture `attendance-absences.html` is a reconstruction, flagged as such);
  re-verify against a populated capture. Note the sibling `"columns"` blob is **not valid
  JSON** (it embeds JS function refs), which is why only `dataSource` is ever parsed.

  **Row-level degradation — added 2026-07-16.** Because that row mapping is a guess, an
  unexpected shape is likely, and `rows.map(toAbsence)` inside a single `validate()` meant
  one bad date threw from `toIsoDate` and failed the entire attendance page. Rows are now
  validated individually: a `ParseError` row is skipped and counted in the new
  `Attendance.unreadableAbsences` (`.default(0)`, so clients never distinguish absent from
  zero). Only `ParseError` is caught — our own bugs must still fail loudly.

  The count is **reported rather than swallowed**, which is the whole point: silently
  returning a short list would leave a student believing they have no unexcused absences when
  they do. The frontend must render `unreadableAbsences > 0`. `/api/attendance` also logs
  `{event: 'unreadable_rows', count}` — **the signal that tells us this reconstruction is
  wrong** once a real absence finally appears.

- **Date normalization** (added in build): portal dates are US month-first
  (`06/12/2026`, `5/18/2026`); the domain contract is ISO. `extract/dates.ts toIsoDate()`
  converts them and **throws `ParseError` on an unknown format rather than guessing** — a
  wrong date is worse than a loud failure. Every page client runs its scraped object
  through its domain schema (`pages/shared.ts validate()`) before returning, so
  normalization bugs surface as `ParseError` at the boundary instead of as bad data later.

**Tests:** committed synthetic fixtures in `test/fixtures/portal/` (structurally faithful
to the live pages, no personal data) → assert exact domain output; token extraction from
realistic anchor markup; html-response-on-download path; bounced-module path;
session-bounce path. **`test/fixtures/` is in `.prettierignore`** — formatting rewrites
the embedded JSON/markup the parsers are tested against (this broke the suite once).

**Done when:** parsers pass on fixtures AND a live env-gated smoke run
(`tools/pull-real-data.ts`) shows parsed counts (not raw dumps) for a real account.
**Done 2026-07-15** — live against ca-pleas: student-info all fields + portrait,
documents=50 (all with docTokens, all dates ISO) plus a real PDF download
(`application/pdf`, 53 KB) proving the docToken `+`/`/`/`=` re-encoding, attendance
school + 0 absences.

---

## Part 6 — Fixture pipeline & mock portal (`tools/sanitize-capture.ts`, `src/mock/`)

**Goal:** committable test data and a fake portal, so development/tests/frontend work never
require a real student account. Replaces the original's MSW-in-browser mocking with a
server-side equivalent (our backend is the thing to mock around now, not the browser).

**Code & details:**
- `tools/sanitize-capture.ts` — transforms `captures/*.html` (gitignored, personal) into
  `test/fixtures/portal/*.html` (committable): deterministically replaces student
  name/PermID/GUIDs/teacher names/emails/photo path with synthetic values, preserving
  structure byte-for-byte otherwise. Prints a checklist of replaced values; **manual
  review before first commit of each fixture is mandatory** (grep the output for the real
  name/ID before staging).
- `src/mock/server.ts` — a small Hono app imitating the portal itself:
  - serves the fixture pages at the real paths (`PXP2_Student.aspx`, …);
  - real-ish login flow: renders the login form fixture, accepts the POST, sets a fake
    `ASP.NET_SessionId`, wrong password re-renders the form (exercises our detection);
  - unauthenticated page requests redirect to the login page (exercises expiry recovery);
  - a flag to make `PXP2_Gradebook.aspx` redirect to Home (exercises
    `NO_ACTIVE_GRADING_PERIOD`).
- Backend integration tests then run the **entire** stack (API → session → parsers)
  against this mock portal in-process.

**As built (2026-07-15):**
- `src/portal/base.ts` `portalBase(domain)` — the whole stack (login, pages, downloads)
  honours `PORTAL_BASE_OVERRIDE`, read at call time so tests can set it per-case. This is
  what lets the mock portal stand in for a district.
- `src/mock/portal.ts` `createMockPortal(options)` + `mockPortalFetch(app)` — the bridge
  runs the mock **in-process** via `app.fetch`, so integration tests need no port and no
  network. Options: `gradebookAvailable` (default false = out-of-term bounce),
  `withAbsences`, `sessionExpired`. `src/mock/dev.ts` boots mock + backend in one process
  for `npm run dev:mock`.
- The mock serves the **same committed fixtures** the parser tests assert against — one
  source of truth, so a drifting fixture fails both at once. Its `home.html` deliberately
  contains a password input, reproducing the real ca-pleas trap that once made
  login-success detection false-positive.
- `tools/capture-portal-page.ts` (TS port) + `tools/sanitize-capture.ts` with the pure
  logic in `tools/lib/sanitize.ts`: it discovers identifying values *using our own
  parsers*, replaces them deterministically, then **re-scans the output and refuses to
  write** if any known-real value survived. It never prints real values. It deliberately
  won't blanket-replace names shorter than 4 chars (too corrupting), which is exactly why
  manual review stays mandatory.

**Done when:** `npm run dev:mock` boots the backend wired to the mock portal and every
resource endpoint returns synthetic data end-to-end. **Partially done 2026-07-15**:
`dev:mock` boots both servers (backend `/api/health` OK; mock portal serves the login form
and 302s unauthenticated requests), and 14 integration tests drive the real
login/session/page-client stack against the mock — including silent re-login recovery.
The *API* resource endpoints don't exist until Part 9, so re-confirm this line then.
**Confirmed done 2026-07-15 (Part 9)**: mock portal + backend booted on real sockets and
every endpoint answered from synthetic data — health, login, student, documents, document
download (`application/pdf`), attendance, gradebook (409 out-of-term), logout. Part 9 also
tightened the mock: it now only serves a file for docTokens that appear in
`documents.html`, because serving a PDF for *any* token hid the bad-token path.
Sanitizer verified against a real capture: name, perm ID, school, email, GUIDs and photo
path all scrubbed, residual scan clean.

---

## Part 7 — Gradebook (`src/portal/pages/gradebook.ts`)

The centerpiece and the one **externally blocked** item: an active grading period is
required to see real payloads (during breaks the portal redirects the gradebook module to
Home — there is nothing to scrape). Split so the block only affects the final mapping.

### 7a — now (no live data needed) — **done 2026-07-15**

Built: `src/portal/pages/gradebook/` — `index.ts` (`fetchGradebook(session, periodIndex?)`;
redirect ⇒ the new `NoActiveGradingPeriodError`, which is deliberately *distinct* from
`ModuleUnavailableError` because it's expected, not a fault; throws `ParseError` until 7b)
and `assignment.ts` (`rawAssignmentToDomain`). Raw edge-case rows live in
`test/fixtures/assignments.ts`, one per case in the doc; 20 tests. Live-verified: the
smoke tool reports `NoActiveGradingPeriodError` for the real portal, and it now tells you
to capture the moment the module renders.

Two deliberate deviations from the reference, both recorded in code comments:
- **Points-text fallback:** the original did
  `parseFloat(Points.split(' Points Possible')[0])`, which parses `"3 / 4"` as **3** — the
  *earned* points masquerading as the total. Ours only accepts text that actually looks
  like a total (`"4 Points Possible"`, or the denominator of `"3 / 4"`), else `undefined`.
- **NaN:** unparseable numbers become `undefined` (= not graded) instead of `NaN`.

Also note: absent values are **omitted keys**, not `key: undefined`, so the JSON contract
never ships `"pointsEarned": undefined`. (Costs us `toMatchObject` in tests — assert
fields explicitly.)
- Page client skeleton: GET `PXP2_Gradebook.aspx?AGU=0`; redirected ⇒
  `NO_ACTIVE_GRADING_PERIOD`. Also fetch `PXP2_ClassGrades.aspx?AGU=0` in captures — some
  districts render per-class assignment detail there instead.
- Build the **assignment normalizer** (`rawAssignmentToDomain`) against the *known* raw
  field vocabulary (`Score, DisplayScore, ScoreCalValue, ScoreMaxValue, Points, Point,
  PointPossible, Notes, Type, Measure, MeasureDescription, Date, GradebookID`) with a
  synthetic fixture per edge case from `assignment_edge_cases.md`: normal, scaled,
  not-graded (± `ScoreMaxValue`), zero-with-empty-`Point`, extra credit, not-for-grading.
  This code is fully testable today; only the *container* shape (how grids nest
  courses/marks/assignments in the HTML) awaits capture.
- Reporting-period model + parser interface: `fetchGradebook(session, periodIndex?)`.

### 7b — when a grading period is active (first school day it's back)
1. Capture: `tools/capture-portal-page.ts gradebook gradebook-classdetail home` against a
   real account; sanitize into fixtures.
2. Investigate on the capture: where courses/marks/assignments/category-weights actually
   live (`"dataSource"` grids on the gradebook page vs. class-detail page vs. an AJAX
   call), and how **period switching** works (query param vs. postback) — record findings
   in this file.
3. Implement the mapping to `domain.Gradebook` via the Part 3 toolkit; wire period
   switching.
4. **Verification (non-negotiable):** for several real courses — weighted and unweighted —
   the calc engine's computed course grade must match the portal's displayed mark
   (round-or-floor tolerance, see `gradesMatch` in Part 8). Any mismatch = a normalization
   bug, fix before proceeding.

**Tests:** every edge-case fixture through the normalizer; full sanitized-capture →
`Gradebook` snapshot; no-active-period path; period switching against mock portal.

---

## Part 8 — Grade-calc engine (`src/calc/`) — **done 2026-07-15**

Built: `points.ts` (calculable/categorized predicates, `pointTotals`, `pointsByCategory`),
`grade.ts` (`gradePercentage`, `courseGradeFromTotals`, `courseGradeFromCategories`,
`courseGrade`, `markGrade`, `gradesMatch`), `impact.ts` (`assignmentImpacts`,
`hiddenPoints`), `target.ts` (`pointsNeededForTargetGrade`), barrel `index.ts`. 48 tests.
Every target-solver answer is verified by substituting it back into `courseGrade`.

**Bug fixed 2026-07-16 — `isCalculable` silently dropped extra credit.** It required both
`pointsEarned` and `pointsPossible`. But the portal marks extra credit with
`PointPossible: ''`, and `rawAssignmentToDomain` can only recover a possible from
`ScoreMaxValue` (or a total in the `Points` text) — both of which a row may lack. Such a row
produced `pointsPossible: undefined`, failed the predicate, and was excluded from the grade
entirely: **the student's earned bonus points disappeared and their grade came out lower
than the portal's.**

This was an internal contradiction rather than a question about unseen data, which is why it
was fixable before Part 7b. Every read of `assignment.pointsPossible` in the engine
(`points.ts`, `impact.ts`, `target.ts`) is already guarded by `!extraCredit`, so the field is
provably never used for extra credit — `pointTotals` deliberately keeps it out of the
denominator. `pointTotals` said "extra credit needs no denominator" while `isCalculable` said
"it must have one"; the latter was wrong, and dropping the points is not the right answer for
*any* data shape.

Now `extraCredit || pointsPossible !== undefined`, with `CalculableAssignment` a discriminated
union requiring `pointsPossible` only when `extraCredit` is false — so the existing guarded
reads still typecheck, which is the compiler confirming the analysis. Regression:
`src/calc/points.test.ts` (new; Part 8 had none), including `EXTRA_CREDIT_NO_MAX` driven from
a raw portal row through the normalizer into `courseGrade`. Verified failing against the old
predicate before landing.

Deliberate deviations from the reference, all commented in code:
- **No `NaN`/`Infinity` escape.** The reference guarded only `isNaN`, so a category with
  earned-but-no-possible points (extra credit only) yielded `Infinity` as the course
  grade. Ours guards `Number.isFinite` and skips zero-possible categories.
- **Chronological order is computed, not assumed.** The reference relied on the input
  being newest-first (`.toReversed()` twice). `assignmentImpacts` sorts by date itself and
  returns results in the caller's original order, so display order is preserved and no
  hidden ordering contract exists.
- **Point discrepancies are their own type**, not synthetic `Assignment`s with a
  `Math.random()` id and `new Date()`. That kept the engine pure and stopped us inventing
  portal data; the frontend renders `PointDiscrepancy` as its own row.
- **Computed values stay out of the domain type**: `gradeImpact` rides on the returned
  `AssignmentImpact`, not on `Assignment` (which is portal data only).

Note on `gradesMatch`: it compares at the *coarser* of the two precisions, so a portal
showing a bare `90` matches anything rounding **or** truncating to 90. Deliberately
lenient — we can only hold the computation to the precision the portal shows us.

**Goal:** clean-room port of the original engine (reference:
`gradecompass/src/lib/grades/assignments.ts`, `course.ts`) onto our domain types. Pure
functions, zero framework deps — the React frontend imports this same module for
interactive hypotheticals.

**Code & details (behaviors to preserve):**
- `gradePercentage(earned, possible)` — NaN-guarded (0/0 ⇒ 0).
- Weighted course grade from categories: sum `earned/possible × weight` over categories
  **that have points**, divide by the *included* categories' total weight (empty categories
  don't drag the grade — this renormalization is subtle and must be kept).
- Fallback: no categories ⇒ plain point totals (extra-credit possible-points excluded from
  the denominator: `possible += extraCredit ? 0 : pointsPossible`).
- Per-assignment grade impact ("GPC"): walk assignments **oldest → newest** accumulating
  totals (or per-category totals), recording the course-grade delta each assignment caused.
  Skips non-calculable assignments (not graded / not-for-grade / no category in weighted
  mode) without breaking the accumulation.
- Hidden-assignment detection: portal category totals (`Category.pointsEarned/Possible`)
  vs. the sum of visible assignments — a discrepancy becomes a synthetic "Point
  Discrepancy in <category>" assignment with its own grade impact (ignore deltas
  < 0.0001).
- Hypotheticals: new hypothetical assignments + editing existing ones are *frontend state*;
  the engine just recomputes from an assignment list — keep it that way.
- `pointsNeededForTargetGrade(...)` — both modes: unweighted (solve over point totals) and
  weighted (solve within the target category, renormalizing over countable categories —
  port the reference algorithm, it handles empty-category weight redistribution).
- `gradesMatch(raw, expected)` — equality at the coarser of the two operands' decimal
  precisions, accepting round *or* floor (districts differ) — used by Part 7b verification.

**Tests:** the most heavily tested module. Unit tests per function; scenario tests: known
gradebook → known course grades; extra credit raises grade without raising denominator;
not-for-grade excluded; scaled assignment uses scaled points for calc; GPC deltas sum ≈
final grade for all-calculable courses; target-grade solutions verified by substituting
back into the grade function.

---

## Part 9 — HTTP API (`src/api/`)

**Goal:** the surface the React frontend talks to. Hono app, JSON everywhere, one error
envelope.

**Endpoints:**

| Method & path | Body / params | Returns | Notes |
|---|---|---|---|
| `POST /api/auth/login` | `{ domain, username, password }` | `{ token, student: StudentInfo }` | validates by fetching student info; 401 `AUTH_FAILED` on bad creds |
| `DELETE /api/auth/session` | bearer | `204` | drops session from store |
| `GET /api/student` | bearer | `StudentInfo` | |
| `GET /api/documents` | bearer | `DocumentMeta[]` | |
| `GET /api/documents/:docToken` | bearer | binary (`application/pdf` etc.) | streamed, correct `Content-Type`/`Content-Disposition`; HTML-from-portal ⇒ 502 |
| `GET /api/attendance` | bearer | `Attendance` | |
| `GET /api/gradebook?period=N` | bearer, optional period index | `Gradebook` | no active period ⇒ 409 `NO_ACTIVE_GRADING_PERIOD` |
| `GET /api/health` | — | `{ ok: true }` | no auth |

**Cross-cutting details:**
- Auth middleware: `Authorization: Bearer <token>` → session lookup → 401
  `SESSION_EXPIRED` when missing/expired (after Part 2's silent re-login has already been
  attempted).
- Error envelope: `{ error: { code: PortalErrorCode, message } }`; every `PortalError`
  subclass maps to exactly one code + HTTP status; unexpected errors ⇒ 500 with generic
  message (**never leak portal HTML or credentials into error bodies**).
- Zod-validated request bodies/queries (400 `VALIDATION`).
- CORS: configurable allowed origin (React dev server), credentials off (bearer, not
  cookies) — revisit if the frontend prefers httpOnly cookies; the store design doesn't
  care.
- Login rate limit (per IP, in-memory) — it proxies to a school portal; don't be a
  credential-stuffing amplifier.
- Structured logging with an explicit **no-PII rule**: log domains, routes, statuses,
  durations — never usernames, tokens, cookies, or response bodies.
- Config via env: `PORT`, `ALLOWED_ORIGIN`, `PORTAL_BASE_OVERRIDE` (points at mock portal
  in dev/tests), `SESSION_TTL_MINUTES`.

**Tests:** route tests via `app.request()` against the mock portal: full login→fetch
flows, every error mapping (bad creds, expired token, no-active-period, portal 5xx),
document streaming content-type, CORS headers, rate limiting.

**As built (2026-07-15) — done.** Files: `config.ts`, `logging.ts`, `errors.ts`, `auth.ts`,
`rateLimit.ts`, `deps.ts`, `schemas.ts`, `routes/auth.ts`, `routes/resources.ts`, `app.ts`.
All eight planned endpoints exist and behave as specified. 74 new tests (291 total), plus a
real-socket boot of every endpoint against the mock portal.

Deviations and decisions, all commented in code:
- **Two new error codes**, `INTERNAL` and `RATE_LIMITED`. The envelope requires a
  `PortalErrorCode`, but the plan also mandates a 500 and a 429 — neither had a code to
  carry. The frontend needs to tell "we broke" and "slow down" apart from a portal fault.
- **`fetchFollow` now throws `PortalHttpError` on a 5xx** (a Part 1 change this part
  forced). Previously a portal 500 flowed into the parsers, failed to find `__VIEWSTATE`,
  and surfaced as `PARSE_FAILED` — blaming our parser for the portal being down. It now maps
  to `PORTAL_UNAVAILABLE`, which is what the plan's "portal 5xx" test asked for.
  `fetchFollowRaw` stays permissive because `downloadDocument` inspects status itself.
- **Downloads are buffered, not streamed.** `downloadDocument` (Part 5) already
  materialises bytes, and report cards are tens of KB. Revisit only if a district serves
  something large.
- **Sessions are swept on login**, not on a timer: login is the only path that grows the
  store, and a `setInterval` would hold the process open and complicate tests.
- **`trustProxy` (env `TRUST_PROXY`, default off)** decides whether `X-Forwarded-For` is
  believed for rate-limit identity. Unproxied, a spoofed header would hand every request a
  fresh bucket; the default fails toward throttling too much rather than too little. Part 12
  must set it when the VPS puts a reverse proxy in front.
- **Config throws on malformed values** rather than defaulting, so `PORT=eighty` stops the
  server instead of silently listening on 3000.
- Rate limiting counts *successful* logins too — a valid account is not a free pass for
  enumerating others.

**Not leaking data** is enforced structurally rather than by care: only `PortalError`
messages (which we hand-write) reach the client; anything else becomes a generic 500. The
request log records `c.req.routePath` — the *pattern*, `/api/documents/:docToken` — so
tokens and query strings cannot reach a log line. Tests assert both.

**Placeholder data (added 2026-07-16)** so the frontend is not blocked on the school
calendar. `PLACEHOLDER_DATA=true` makes `/api/gradebook` fall back to `SAMPLE_GRADEBOOK`
(`src/mock/placeholders.ts`) — but only on `NoActiveGradingPeriodError` or `ParseError`,
the two states Part 7b is stuck in. Attendance gets no sample: `MOCK_WITH_ABSENCES=true`
drives the **real parser** over `attendance-absences.html`, which is strictly better because
it exercises real code. `npm run dev:mock` enables both and prints which data is real.

- **Domain-level, not invented portal HTML.** A parser written against markup we made up
  would only learn to read our own fiction, pass its own tests, and be discarded the day
  real data lands. The schema is the part we actually know, so the sample satisfies
  `GradebookSchema` at import and fails loudly if the schema moves.
- **Safety**, since invented grades reaching a student who believes them is the worst
  outcome available: off by default; `loadConfig` throws if on with `NODE_ENV=production`;
  responses carry `X-Grademax-Placeholder: true`; every fallback logs `placeholder_served`;
  genuine faults (portal 5xx, auth) still surface as errors.
- It is a **fallback, not a replacement**, so real grades win automatically once 7b lands
  and the term starts — no config change and no frontend change.
- A test asserts each sample course's stated `percentage` equals what `src/calc/` computes
  from its assignments. It caught two invented numbers that disagreed with their own
  assignments; shipped, the UI would have shown two different grades for one course.
- Building it surfaced the extra-credit `isCalculable` bug, fixed the same day — see Part 8.

**Removal checklist** for when Part 7b lands: `note.md` § "Placeholder data".

---

## Part 10 — Hardening & the frontend contract

**Goal:** the "ready to connect" milestone.

**Code & details:**
- Portal fetch resilience: timeout + single retry on network failure for idempotent GETs;
  per-session request queue (serialize portal hits per session — WebForms session state is
  not obviously safe under parallel scrapes).
- Short in-memory response cache per `(token, resource)` (~2–5 min, gradebook keyed by
  period) so a frontend that refetches on navigation doesn't hammer the district portal.
  `?refresh=true` bypasses.
- **API contract deliverable — decided at Part 9 time: option (a).** Export the Zod
  schemas/types (`src/domain/`) plus a small typed fetch client for the frontend to import.
  Reasons: `src/domain/` is *already* the contract and the routes return exactly those
  types, so there is nothing to generate and nothing to drift; the frontend is TypeScript,
  so types flow straight through with no codegen step; and it also imports `src/calc/` for
  live hypotheticals, so it is already consuming this repo as a library. OpenAPI
  (`@hono/zod-openapi`) buys interop we have no consumer for. Revisit if a non-TS client
  ever appears. Part 9 added `RATE_LIMITED` and `INTERNAL` to `PortalErrorCode`, so the
  client must handle 429 (honour `Retry-After`) and 500.
- Docs: `README.md` (run real mode / mock mode, env vars, test commands) and
  `api-contract.md` (endpoints table above + error codes + auth flow), kept current.
- Final live pass: every endpoint against a real account; gradebook numbers spot-checked
  against the portal UI (Part 7b verification rerun through the API layer).

### Definition of done — "ready for frontend"

- [ ] `npm run check` green on Node 22: typecheck, lint, full test suite (unit +
      mock-portal integration).
- [ ] All endpoints work in **mock mode** with committed fixtures (frontend dev needs no
      real account).
- [ ] All endpoints verified **live** against a real district portal, including gradebook
      in an active grading period, with calc-engine grades matching the portal's displayed
      marks.
- [ ] Typed contract package/spec published for the frontend; error codes enumerated.
- [ ] No personal data in repo (fixtures sanitized + reviewed); no PII in logs; secrets
      only via env.
- [ ] `calc/` importable by the frontend with its own test suite green.

Parts 11 and 12 happen *after* Part 10: the frontend gets connected, then Part 11 hardens
the integration, then Part 12 deploys. They are separated because each needs something
that doesn't exist until the prior step is real — a live frontend, then a hardened build.

---

## Part 11 — Post-integration hardening (after the frontend is connected)

**Goal:** close the gaps that only surface once a real React client is driving the API.
Nothing here can be finished earlier because it needs an actual frontend exercising real
flows — Part 10 makes the backend *ready*; this makes the pair *work*.

**Code & details:**
- **CORS lock-down:** replace the permissive dev origin with the real frontend origin(s);
  confirm preflight + credentials behavior matches whatever the client actually sends
  (bearer header vs. cookie — revisit the store's auth model if the frontend prefers
  httpOnly cookies).
- **Auth/session UX under a real client:** verify token-expiry handling end to end — the
  frontend should get a clean `401 SESSION_EXPIRED` and a working re-login path; confirm
  the silent portal re-login (Part 2) is invisible to the user, and decide whether the API
  needs a token-refresh or "session still valid?" ping the client can call on resume.
- **Contract adjustments:** fold back any shape changes the frontend needs (fields it
  wants added/split, pagination, date formats) into the domain schemas + typed contract —
  the schemas are the source of truth, so a change here is one edit that reflows types.
- **End-to-end tests:** a small suite driving the API the way the frontend does (login →
  student → documents → gradebook → hypothetical recompute using `calc/`), run against the
  mock portal in CI and once live.
- **Resilience tuning with real traffic patterns:** revisit the per-session request queue,
  the response-cache TTLs, and login rate limits using the frontend's actual
  refetch/navigation behavior; make sure a page that fans out several resource calls on
  load doesn't trip the portal or the limiter.
- **Error-surface polish:** confirm every `PortalErrorCode` renders to a sensible frontend
  message; no raw portal HTML, stack traces, or PII ever reaches the client.
- **Bug triage:** fix issues discovered during integration; each fix lands with a
  regression test.

**Done when:** the deployed-locally frontend performs every user flow against this backend
with no integration gaps, the e2e suite is green, and the contract is frozen for release.

---

## Part 12 — Deployment (VPS)

**Goal:** the backend running on a public host, reachable by the production frontend.
Deferred to last on purpose — it needs the hardened, contract-frozen build from Part 11.

**Code & details:**
- **Runtime:** a single long-running Node process (`node`/`tsx` entry from Part 0) on a
  small VPS or container host (Railway/Render/Fly/Docker-on-a-box). **Not serverless** —
  `SessionStore` holds sessions and cookie jars in process memory, which ephemeral
  functions would lose between invocations. (Cheap production build option: compile with
  `tsc`/`tsup` to `dist/` and run plain `node dist/index.js`, or keep running via `tsx`.)
- **Process supervision:** systemd unit or pm2 — auto-restart on crash, start on boot,
  centralized logs.
- **Reverse proxy + TLS:** Caddy (automatic HTTPS) or nginx + certbot in front of the Node
  port; the proxy terminates TLS and forwards to `localhost:PORT`.
- **Config/secrets:** production env vars (`PORT`, `ALLOWED_ORIGIN` = the real frontend
  domain, `SESSION_TTL_MINUTES`, any portal overrides) via the host's secret store or a
  root-only `.env` — never committed.
- **Health & monitoring:** wire `/api/health` to an uptime check; ship logs somewhere,
  keeping the no-PII rule; basic alerting on 5xx spikes.
- **Scaling note (only if needed):** the in-memory session store means **one instance**.
  Horizontal scaling requires moving sessions to a shared store (e.g. Redis) and, ideally,
  sticky sessions — a known, bounded change to `SessionStore`, explicitly out of scope
  until traffic demands it.
- **CI/CD (optional):** GitHub Actions running `npm run check`, then a deploy step
  (rsync/ssh or the host's git-push deploy).

**Done when:** the production frontend talks to the deployed backend over HTTPS, every
flow works live, health checks are green, and restarts/boots recover automatically.

---

## Standing rules (apply to every part)

- **Privacy:** raw captures stay in gitignored `captures/`; committed fixtures only via the
  sanitizer + manual review; smoke tools print shapes/counts, never values.
- Every part lands with its tests; live-portal tests are env-gated
  (`SYNERGY_*` vars present ⇒ run, else skip) so CI never needs credentials.
- When portal reality contradicts this plan (field names, page structure, period
  switching), update this file in the same commit as the code.
