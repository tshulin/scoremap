# Grademax — backend scripts

## What this project is

We are rebuilding GradeCompass (a grade calculator that interfaces with StudentVUE) from
scratch, because the original (https://github.com/PurelyAnecdotal/gradecompass) no longer
works — Edupoint deprecated the mobile SOAP API it relied on (every call now returns error
`D5518-00`). The replacement data source is the modern **PXP2 web portal** (ASP.NET
WebForms, session-cookie auth), scraped server-side.

The final product will be a new website in **TypeScript + React** with cleaner code — it
shares no code with the original. **Current focus: backend only** (login, session
handling, portal scraping/parsing).

## Repo layout

- This git repo is `scripts/` (branch `back` = backend work; there are also `frontend` and
  `main` branches). Since Part 0 it is the **TypeScript backend project**:
  - `src/` — `index.ts` (server entry via `@hono/node-server`); `api/` (Hono app, routes,
    bearer auth, error envelope, config, rate limit, logging — Part 9); `portal/` (`http.ts`
    CookieJar + manual-redirect fetch, `errors.ts` taxonomy, `login.ts`, `session.ts`,
    `base.ts`, `pages/` page clients incl. `gradebook/`); `extract/` (HTML/JSON scraping
    toolkit); `domain/` (Zod schemas = the API contract); `calc/` (pure grade engine);
    `mock/` (in-process mock portal + `dev.ts`).
  - `tools/` — `pull-real-data.ts` (drives the real page clients; prints shapes/counts
    only), `capture-portal-page.ts`, `sanitize-capture.ts` (+ pure `lib/sanitize.ts`).
  - `test/fixtures/portal/` — sanitized, committable portal HTML (**in `.prettierignore`**);
    `test/helpers/` — fixture/portal/grade/api test helpers.
  - Config: `tsconfig.json` (strict, `nodenext`, `noUncheckedIndexedAccess`),
    `eslint.config.js` (flat config; bans `bun:*` imports and the `Bun` global),
    `.prettierrc` (tabs, 100 cols), `vitest.config.ts`, `.nvmrc` (Node 22).
  It also still contains the original standalone Node `.mjs` tooling, kept working until
  superseded by the TS ports (Parts 1–2):
  - `pull-real-data.mjs` — smoke-test portal resources without printing personal values.
  - `capture-portal-page.mjs` — save raw portal pages to `captures/` (gitignored) for
    parser development.
  - `lib/` — shared modules: `http.mjs` (cookie-jar fetch with manual redirect following —
    the portal sets cookies on 302 hops), `login.mjs` (WebForms login: hidden
    `__VIEWSTATE` fields, detects failure by the form re-rendering), `session.mjs`
    (session from `SYNERGY_COOKIE` or username/password env vars), `inspect.mjs`
    (counts DevExpress `"dataSource":` JSON grids embedded in page HTML),
    `paths.mjs` (repo-root/captures resolution).
  - `legacy/` — older scripts kept for reference (fixture generation/verification tied to
    the old GradeCompass app).
- `gradecompass/` — **reference only, gitignored, never commit.** A clone of the original
  SvelteKit app with prior PXP2-proxy work applied on top (untracked there:
  `src/lib/server/synergy/`, `src/routes/api/`, `functionality/`). Useful as a working
  reference for portal endpoints, translators, and the grade-calc engine
  (`src/lib/grades/`).
- Parent folder `../` (grademax root, outside this repo) holds `documentation.md`,
  `env.example`, and `fixtures/` (synthetic legacy-XML examples).

## Execution plan

`execution-plan.md` (repo root) is the master plan for the backend build-out — 10 parts
from scaffolding to frontend-ready, with per-part specs and tests. Follow it; update it in
the same commit when reality (portal structure, field names) contradicts it.

Stack: **Node.js 22 LTS** + TypeScript + Hono + Zod, run via `tsx`, tested with Vitest —
**not Bun** (the original app used Bun; see the plan's "Bun → Node" notes). Never import
`bun:*` or use the `Bun` global in backend code (ESLint enforces this).

Progress:
- **Part 0 (scaffold) — done 2026-07-15.** Project scaffolded on Node 22.19; deps
  installed (`hono`, `@hono/node-server`, `zod`; dev: `typescript`, `tsx`, `vitest`,
  `eslint` + `typescript-eslint` + `@eslint/js`, `prettier`, `eslint-config-prettier`,
  `@types/node`); placeholder health endpoint with a passing Vitest test; `npm run check`
  green; live server boot verified (`/api/health` → `{"ok":true}`). One deviation from the
  plan: `dev:mock` is a failing stub script until Part 6 delivers the mock portal.
- **Part 1 (portal HTTP core) — code + tests done 2026-07-15.** `src/portal/http.ts`
  (CookieJar class, `fetchFollow`/`fetchFollowRaw` with manual redirects, Set-Cookie
  absorption on 302 hops, GET-downgrade after redirects, browser UA, per-hop
  `AbortSignal.timeout`, injectable `fetch`) + `src/portal/errors.ts`. 13 unit tests over
  a scripted fake fetch. Fixed a real bug vs. the `.mjs` original: cookie pairs with an
  empty (whitespace) name are now rejected instead of stored under `""`.
  `tools/pull-real-data.ts` ported. **Live-verified 2026-07-15** against
  ca-pleas-psv.edupoint.com (cookie mode): student-info/documents/attendance OK,
  gradebook redirected to Home (expected — no active grading period in summer).
- **Part 2 (login & sessions) — done 2026-07-15.** `src/portal/login.ts` (WebForms
  login: hidden-field echo, user/pass field detection, `AuthError` on form re-render,
  `PortalShapeError` on unrecognized pages, `validatePortalDomain` hostname guard →
  `InvalidDomainError`) and `src/portal/session.ts` (`SessionStore`: opaque tokens via
  `create`/`adopt`, sliding 20-min TTL, `sweep()`, single-flight login dedupe,
  `withSession()` re-login-once recovery; `assertSessionAlive()` detects login-page
  bounces — page clients must call it). 27 new unit tests (41 total).
  `tools/pull-real-data.ts` supports both cookie and credential modes.
  **Live-verified credential login 2026-07-15** against ca-pleas (login mode). This run
  found + fixed a real bug: login success was judged by sniffing the body for a password
  input, but the authenticated landing page (`Home_PXP2.aspx`) itself contains one —
  success is now judged by the landing URL not being the login module (regression test
  added).
- **Part 3 (extraction toolkit) — done 2026-07-15.** `src/extract/`: `json.ts`
  (`extractJsonAfter` balanced-literal scanner, `findDataSourceWithKeys`,
  `countDataSources`), `html.ts` (`decodeEntities`, `stripTags`, `parseLabeledFields`,
  `bootstrapValue`), `module.ts` (`assertNotBounced` → `ModuleUnavailableError`), barrel
  `index.ts`. Patterns verified against live captures of the student/documents/attendance
  pages. 28 new tests (70 total). Also added `ModuleUnavailableError` + `ParseError` to
  `portal/errors.ts`. Noted for Part 5: attendance rows key the date as `Date` (not
  `AbsenceDate`); `studentGU` is absent on the documents page.
- **Part 4 (domain model) — done 2026-07-15.** `src/domain/` Zod schemas + inferred types
  = the API contract (camelCase, real numbers, ISO-8601 date strings; no legacy
  `_Attribute` shapes): `common.ts` (`IsoDateString`), `student.ts`, `documents.ts`
  (+ `DocumentContent` runtime type for binary downloads), `attendance.ts`, `gradebook.ts`
  (the load-bearing `Assignment` with its normalization rules in a docstring, plus
  Category/Mark/Course/ReportPeriod/Gradebook), `errorCodes.ts` (`PortalErrorCode` enum +
  `ApiError` envelope), barrel `index.ts`. 22 round-trip tests (92 total). Zod is v4 —
  mind API differences (`z.iso.*`, etc.).
- **Part 5 (page clients) — done 2026-07-15.** `src/portal/pages/`: `shared.ts`
  (`getPage` — every page GET calls `assertSessionAlive`; `validate()` — scraped objects
  are checked against their domain schema before leaving the portal layer, so bugs surface
  as `ParseError` at the boundary), `studentInfo.ts` (+ `checkLogin`; portrait failures
  degrade to no photo, never fail the request), `documents.ts` (+ `downloadDocument`;
  docToken is base64-ish so it's `encodeURIComponent`'d; an HTML response = expired token
  → `ModuleUnavailableError`), `attendance.ts`, barrel `index.ts`. Added
  `extract/dates.ts` `toIsoDate()` (portal dates are US month-first `MM/DD/YYYY`; throws
  `ParseError` on unknown formats rather than guessing). Committed synthetic fixtures in
  `test/fixtures/portal/` + helpers in `test/helpers/`. 29 new tests (121 total).
  `tools/pull-real-data.ts` now drives the real page clients and prints parsed
  shapes/counts only. **Live-verified 2026-07-15**: student-info all fields + portrait;
  documents=50, all with docTokens, all dates ISO, real PDF download (53 KB,
  `application/pdf`); attendance school + 0 absences; gradebook still redirects (out of
  term, Part 7b).
  - **`test/fixtures/` is in `.prettierignore`** — Prettier rewrites fixture markup and
    embedded JSON into JS-literal syntax, which silently breaks every parser test.
  - Attendance rows are **still unverified**: the account has no absences (grid is
    `"dataSource":[]`). Field names (`Date`, `AttAllDayReason`, `AttPeriods`) come from the
    grid's column config; the row mapping + `attendance-absences.html` fixture are a
    reconstruction to re-check against real data.
  - **Degradation fixed 2026-07-16.** Rows are validated one at a time; a `ParseError` row is
    skipped and counted in `Attendance.unreadableAbsences` (new, `.default(0)`) instead of
    failing the page — one bad date used to throw inside `rows.map(toAbsence)` and hide every
    absence. The count is **reported, not swallowed**: a silently short list could hide an
    unexcused absence, so the frontend must surface `unreadableAbsences > 0`. Only
    `ParseError` is caught; our own bugs still fail loudly. `/api/attendance` logs
    `unreadable_rows` — **that log is how we learn the reconstruction is wrong** once real
    absences exist.
- **Part 6 (fixtures + mock portal) — done 2026-07-15.** `src/portal/base.ts`
  (`portalBase()` — the whole stack honours `PORTAL_BASE_OVERRIDE`, read at call time);
  `src/mock/portal.ts` (`createMockPortal` — WebForms login, cookie-gated pages,
  login-bounce on expiry, out-of-term gradebook redirect; options `gradebookAvailable`,
  `withAbsences`, `sessionExpired`) + `mockPortalFetch` (runs it in-process via
  `app.fetch` — no ports, no network), `src/mock/dev.ts` (`npm run dev:mock` boots mock +
  backend in one process). `tools/capture-portal-page.ts` (TS port) and
  `tools/sanitize-capture.ts` (+ pure `tools/lib/sanitize.ts`). 23 new tests (144 total),
  incl. `test/integration/mockPortal.test.ts` driving the real login/session/page-client
  stack against the mock. **Verified**: `dev:mock` boots both servers; the sanitizer
  scrubs a real capture clean (residual scan passes).
  - The mock serves the **same fixtures** the parser tests use — one source of truth.
  - Fixed while building: Hono's `setCookie` writes to the context, so handlers must
    return `c.html(...)`, not a bare `new Response` (which silently drops the cookies).
  - The sanitizer won't blanket-replace names <4 chars (corruption risk), so **manual
    review of every fixture stays mandatory** — it says so on every run.
- **Part 7a (gradebook skeleton + assignment normalizer) — done 2026-07-15.**
  `src/portal/pages/gradebook/`: `index.ts` (`fetchGradebook(session, periodIndex?)` —
  redirect ⇒ `NoActiveGradingPeriodError`, a new error kept distinct from
  `ModuleUnavailableError` because it's expected, not a fault; throws `ParseError` until
  7b; `periodIndex` can't be honoured yet since period switching is unobserved) and
  `assignment.ts` (`rawAssignmentToDomain` — the most correctness-critical function in the
  backend). Raw edge-case rows: `test/fixtures/assignments.ts`, one per case in
  `gradecompass/docs/assignment_edge_cases.md`. 20 new tests (168 total). ESLint now
  ignores `_`-prefixed unused vars.
  - **Never collapse `''` and `undefined`** in raw assignment rows: `Point: ''` = zero
    earned, absent `Point` = not graded; `PointPossible: ''` = extra credit, never 0.
    Hence `optionalString` in the normalizer, *not* `asString` (which returns `''`).
  - Two deliberate improvements on the reference: its `Points`-text fallback parsed
    `"3 / 4"` as **3** (earned points as the total) — ours requires text that looks like a
    total; and unparseable numbers become `undefined`, not `NaN`.
  - Absent values are **omitted keys**, not `key: undefined` — so `toMatchObject` with an
    expected `undefined` fails; assert fields explicitly.
- **Part 8 (grade-calc engine) — done 2026-07-15.** `src/calc/` — pure functions over the
  domain model, zero portal/HTTP/framework deps (the React frontend imports this same
  module for live hypotheticals): `points.ts` (calculable/categorized predicates,
  `pointTotals`, `pointsByCategory`), `grade.ts` (`gradePercentage`, `courseGrade` +
  both modes, `markGrade`, `gradesMatch`), `impact.ts` (`assignmentImpacts`,
  `hiddenPoints`), `target.ts` (`pointsNeededForTargetGrade`), barrel `index.ts`.
  48 new tests (216 total); every target-solver answer is verified by substituting it back
  into `courseGrade`.
  - **The renormalization that matters**: weighted grades sum only over categories that
    *have* points and divide by *those* categories' combined weight — so an ungraded
    category doesn't drag the grade down. Early in a term the grade is the homework grade.
  - Four deliberate deviations from the reference: no `NaN`/`Infinity` escape (it could
    return `Infinity` as a course grade); `assignmentImpacts` computes chronological order
    itself instead of assuming newest-first input, and returns results in input order;
    point discrepancies are their own `PointDiscrepancy` type rather than fake
    `Assignment`s with random ids/dates; computed `gradeImpact` stays off the domain
    `Assignment` (portal data only).
  - `gradesMatch` compares at the **coarser** precision, so a portal showing `90` matches
    anything rounding *or* truncating to 90 — lenient by design.
  - **Grade bug fixed 2026-07-16 — `isCalculable` dropped extra credit.** It demanded both
    `pointsEarned` and `pointsPossible`, but for extra credit the portal sends
    `PointPossible: ''` and only supplies a possible via `ScoreMaxValue`, which it may omit
    — so such a row was excluded entirely and **the student's bonus points vanished,
    lowering their grade**. It's now `extraCredit || pointsPossible !== undefined`, and
    `CalculableAssignment` is a discriminated union that only requires `pointsPossible` when
    `extraCredit` is false. This was an internal contradiction, not a data question: *every*
    read of `assignment.pointsPossible` (`points.ts`, `impact.ts`, `target.ts`) is already
    guarded by `!extraCredit`, so the field is provably never used for extra credit.
    `src/calc/points.test.ts` (new) is the regression, incl. a raw portal row
    (`EXTRA_CREDIT_NO_MAX`) driven through the normalizer into `courseGrade`.
- **Part 9 (HTTP API) — done 2026-07-15.** `src/api/`: `config.ts` (`loadConfig(env)` —
  `PORT`, `ALLOWED_ORIGIN`, `SESSION_TTL_MINUTES`, `LOGIN_RATE_LIMIT`,
  `LOGIN_RATE_WINDOW_MINUTES`, `TRUST_PROXY`; **throws** on malformed values rather than
  defaulting), `errors.ts` (`apiErrorFor` — every `PortalError` → one status + code;
  `RequestValidationError`, `RateLimitedError`), `auth.ts` (`requireSession` bearer
  middleware), `rateLimit.ts` (sliding-window `RateLimiter` + `clientKey`), `logging.ts`,
  `deps.ts`, `schemas.ts`, `routes/auth.ts`, `routes/resources.ts`, `app.ts`
  (`createApp({config, fetchOptions, log, sessions})` — all injectable, which is how tests
  reach the in-process mock portal). All 8 planned endpoints live. 74 new tests (291 total)
  + a real-socket boot of every endpoint against the mock portal.
  - **Two new `PortalErrorCode`s: `INTERNAL` and `RATE_LIMITED`** — the 500 and 429 the plan
    mandates had no code to carry. Frontend must handle both (429 carries `Retry-After`).
  - **Found + fixed a real bug in Part 1's `fetchFollow`**: it returned 5xx bodies, so a
    portal outage flowed into the parsers and surfaced as `PARSE_FAILED` — blaming us for
    the portal being down. It now throws `PortalHttpError` on 5xx → `PORTAL_UNAVAILABLE`.
    `fetchFollowRaw` stays permissive (`downloadDocument` checks status itself). 4xx bodies
    still return: they can carry a real page.
  - **Mock portal fidelity fix**: it served a PDF for *any* non-empty docToken, which hid
    the bad-token path. It now only honours tokens present in `documents.html`.
  - **No-leak is structural, not careful**: only `PortalError` messages (hand-written by us)
    reach the client; everything else becomes a generic 500. The request log records
    `c.req.routePath` — the *pattern* — so docTokens and query strings can't reach a log
    line. Tests assert both, incl. that a submitted password never echoes back.
  - `TRUST_PROXY` defaults **off**: unproxied, a spoofed `X-Forwarded-For` would hand every
    request a fresh rate-limit bucket. Part 12 must turn it on behind the VPS proxy.
  - **Part 10's contract decision is now recorded in the plan: option (a)** — the frontend
    imports `src/domain/` schemas + a typed fetch client from this repo. No OpenAPI: the
    domain schemas already *are* the contract and the frontend is TypeScript.
- **Placeholder data (2026-07-16)** — so the frontend can be built before the term starts.
  Gradebook: `SAMPLE_GRADEBOOK` in `src/mock/placeholders.ts`, served by `/api/gradebook`
  only when `PLACEHOLDER_DATA=true` **and** the portal threw `NoActiveGradingPeriodError`
  or `ParseError`. Attendance: no sample — `MOCK_WITH_ABSENCES=true` drives the **real
  parser** over `attendance-absences.html` instead. `npm run dev:mock` enables both and
  prints which data is real. Full detail + the removal checklist in `note.md`.
  - **Domain-level, not invented HTML.** We have never seen a real gradebook page, so a
    parser built against made-up markup would only learn to read our own fiction. The
    schema is the known part; the sample satisfies `GradebookSchema` at import.
  - **Safety**: off by default; `loadConfig` **throws** if on with `NODE_ENV=production`;
    responses carry `X-Grademax-Placeholder: true`; each fallback logs `placeholder_served`;
    real faults (portal 5xx, auth) still surface as errors. It's a *fallback*, so real
    grades win automatically once 7b lands — no config or frontend change.
  - A test asserts every sample course's stated `percentage` matches what `src/calc/`
    computes from its assignments. Writing it **caught my own invented numbers being wrong**
    twice (88.4 vs 82.5, and 91.5 vs 92) — the frontend would have shown two different
    grades for one course.
  - Building it surfaced the extra-credit `isCalculable` bug, **since fixed** (below).
- **Frontend connected (2026-07-16)** — the `frontend` branch (checked out as a git
  worktree at `../frontend`) now talks to this backend. New `src/data/api.js` (hand-written
  JS client for all 8 endpoints, bearer token in sessionStorage) + rewritten
  `studentvue.js`/`SyncProvider.jsx` map domain shapes → page shapes; Vite dev server
  proxies `/api` → `localhost:3000` (same-origin, so the `X-Grademax-Placeholder` header is
  readable — CORS only exposes `Content-Disposition`). Login now really sends the password
  and the false *"we can't see your password"* copy is fixed (concern 1 resolved; 2
  sidestepped by the hand-written client until the contract package exists; 3 — plain JS —
  still open). Placeholder gradebook is flagged with a banner; Mail (no backend endpoint)
  is banner-flagged as sample data; attendance surfaces `unreadableAbsences`.
  **Live-verified 2026-07-16** end-to-end through browser + Vite proxy against ca-pleas:
  login, student info, documents=50 + real PDF download, attendance (0 absences),
  gradebook placeholder. Mock-portal run (`dev:mock`) verified the absence rows + all
  page renders. One React gotcha fixed: a `useRef(true)`-style "alive" flag must be
  re-armed inside the effect, or StrictMode's dev unmount/remount drops every sync result.
- **Next: Part 10** — hardening & frontend contract: per-session request queue, short
  response cache (`?refresh=true` bypass), the `@grademax/contract` client, `README.md` +
  `api-contract.md`, final live pass. (Part 7b still waits on live data — see `note.md`.)
  - **Before connecting the frontend, three things need deciding** (raised 2026-07-16):
    (1) `origin/frontend`'s `Login.jsx` tells students *"Your device connects directly to
    StudentVUE. We can't see your password or your grades."* — **false** for this
    server-side scraping backend, and unachievable for a website (CORS). Probably inherited
    from the original app's client-side SOAP calls, which Edupoint's `D5518-00` deprecation
    killed. (2) The frontend is a separate **git branch**, so it cannot import
    `src/domain/` — the Part 10 contract decision needs a monorepo or a published package.
    (3) The frontend is plain **JavaScript** (`.jsx`, no TS), which contradicts both the
    stated "TS + React" goal and the contract decision's reasoning.

**`note.md` (repo root)** tracks the two data-blocked items — the gradebook (needs an
active grading period; high certainty, just wait) and attendance rows (needs an actual
absence; may never appear on this account). Read it before picking either up.

The plan now runs to **Part 12**: Parts 1–10 finish the backend, then the frontend is
connected, then Part 11 (post-integration hardening) and Part 12 (VPS deployment).

Test credentials + a session cookie live in `sample_credentials.md` (gitignored, like
all secrets). The cookie expires ~20 min after last use; the login is durable — prefer
credential mode. Ask the user for fresh values if login stops working.

## Build & test commands

Node 22 (`.nvmrc`) + npm. `npm run check` = typecheck + lint + tests — keep it green;
run it before finishing any task. Others: `npm run dev` (tsx watch server), `npm test` /
`npm run test:watch`, `npm run format`, `npm run dev:mock` (boots the mock portal + backend
in one process; prints the mock login to use).

**API env vars** (all optional, all with defaults — see `src/api/config.ts`): `PORT` (3000),
`ALLOWED_ORIGIN` (`http://localhost:5173`, the Vite dev server), `SESSION_TTL_MINUTES` (20),
`LOGIN_RATE_LIMIT` (10) / `LOGIN_RATE_WINDOW_MINUTES` (5), `TRUST_PROXY` (false — turn on
only behind a real reverse proxy), `PLACEHOLDER_DATA` (false — sample gradebook; **throws**
if on with `NODE_ENV=production`). `PORTAL_BASE_OVERRIDE` (read by `portal/base.ts` at call
time) points the whole stack at the mock portal. Malformed values throw at startup by
design. `dev:mock` also reads `MOCK_PORT` (3001), `MOCK_WITH_ABSENCES` (true),
`MOCK_GRADEBOOK_AVAILABLE` (false).

## Key documentation (read before portal or grade-calc work)

- `gradecompass/functionality/documentation.md` (same file at `../documentation.md`) —
  the full PXP2 integration handoff: architecture, per-page endpoints, login flow, legacy
  XML shapes, and the open gradebook task.
- `gradecompass/docs/assignment_edge_cases.md` — assignment score edge cases
  (extra credit = `PointPossible=""`, "Not For Grading" via `Notes`, scaled vs. unscaled
  points, empty `Point` = 0 earned). Getting these wrong produces wrong grades.

## Status / open task

Login, student info, documents, attendance were verified live against a production
portal. **Gradebook is the open item**: it needs a captured payload from an active
grading period (during breaks the portal redirects `PXP2_Gradebook.aspx` to Home, so
there is nothing to scrape). Capture with `capture-portal-page.mjs gradebook` once
grades are back, then build the parser from the embedded `"dataSource"` arrays.

## Running the scripts

Run with Node ≥ 18: `node pull-real-data.mjs all`. Credentials come from env
vars only (see `../env.example`): `SYNERGY_DOMAIN` plus either `SYNERGY_COOKIE`
(browser-copied, ~20 min idle expiry) or `SYNERGY_USERNAME`/`SYNERGY_PASSWORD`.

## Rules

- **Never commit or print personal data**: no real credentials, cookies, or `captures/`
  output. Script output should be shapes/counts only.
- Code style: tabs for indentation, ES modules. The legacy `.mjs` scripts are
  dependency-free (bare Node fetch); the TS backend keeps runtime deps minimal
  (`hono`, `@hono/node-server`, `zod` only so far).
- **Comment sparingly.** The Part 9 code was reviewed down to almost zero comments — keep
  code clean and let the markdown (`CLAUDE.md`, `execution-plan.md`, `note.md`) carry the
  reasoning. Write a comment only for a constraint the code cannot show: a non-obvious
  portal quirk, a deliberate deviation, or a safety property that looks removable.
