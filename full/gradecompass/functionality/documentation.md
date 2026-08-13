# GradeCompass — StudentVUE (PXP2 Web Portal) Integration — Functionality & Handoff

> **Purpose of this folder.** GradeCompass's original data source (Edupoint's mobile
> SOAP API) was deprecated. This document + the scripts/fixtures here capture how the
> **replacement** works, what is finished, and exactly what remains — so a future
> human or AI can pick it up (specifically the **Gradebook translator**, which can only
> be finished once a grading period is active and real grades are back).
>
> **No personal data lives in this folder.** All scripts take credentials/cookies from
> environment variables; all fixtures are synthetic. Raw portal captures go to
> `functionality/captures/`, which is **gitignored**.

---

## 0. Status at a glance

The proxy logs into the district web portal server-side, scrapes each page, and
re-emits the data in the **legacy Synergy SOAP XML shape** so the entire existing
client (parsing, types, UI, grade-calc engine) keeps working unchanged.

| Feature | Portal page | `methodName` | Server fn (`client.ts`) | Status |
|---|---|---|---|---|
| Login / session | `PXP2_Login_Student.aspx` | — | `login.ts login()` | ✅ Works |
| Student info | `PXP2_Student.aspx` | `StudentInfo` | `studentInfo()` | ✅ Works |
| Documents list | `PXP2_Documents.aspx` | `GetStudentDocumentInitialData` | `documents()` | ✅ Works |
| Document download | `PXP_ShowDocument.aspx` | `GetReportCardDocumentData` | `reportCard()` | ✅ Works |
| Attendance | `PXP2_Attendance.aspx` | `Attendance` | `attendance()` | ✅ Works |
| **Gradebook** | `PXP2_Gradebook.aspx` | `Gradebook` | `gradebook()` | ⛔ **Pending capture** |
| Mail | messages module | `SynergyMailGetData` | `mailData()` | ⛔ Not started (throws) |
| Mail attachment | messages module | `SynergyMailGetAttachment` | `attachment()` | ⛔ Not started (throws) |

**The single blocking item is the Gradebook translator** (§6). It was verified live that
Student Info, Documents (incl. real PDF download), and Attendance all work against a
production portal. Gradebook could not be finished because it was summer break — with no
active grading period, the portal redirects the gradebook module to Home. See §6.

---

## 1. Why this exists

Edupoint deprecated the old stateless mobile SOAP API used by StudentVUE clients; every
request now returns error **`D5518-00`**. The modern **PXP2 web portal** API is
session-cookie based and cannot be called cross-origin from the browser (CORS + auth), so
GradeCompass now uses a **server-side proxy**:

1. The browser calls the app's own endpoint `POST /api/synergy` (same-origin, no CORS).
2. The proxy logs into the district portal server-side, fetches the requested page(s),
   and **translates** the scraped HTML/JSON back into the *legacy* SOAP-enveloped XML the
   old API used to return.
3. The existing client parser (`src/lib/synergy.ts`) and every `src/lib/types/*`
   interface are therefore **untouched** — including the grade-calculation engine.

This "translate to the legacy shape" decision is the key architectural idea. It's why
nothing downstream had to change, and why the remaining work is isolated to one translator.

---

## 2. Architecture & request lifecycle

```
 Browser (Svelte)                         App server (SvelteKit)                 District portal
 ────────────────                         ─────────────────────                 ───────────────
 StudentAccount.documents()               POST /api/synergy
   src/lib/synergy.ts                        src/routes/api/synergy/+server.ts
        │  fetch POST /api/synergy   ───────────►│
        │  {domain,userID,password,             │ getSession(creds)  ──► login.ts / session.ts ──► cookies
        │   methodName, params}                 │ client.<method>(session) ──► http.ts GET pages ──► HTML/JSON
        │                                        │ translate.ts  → legacy inner XML
        │                                        │ wrapEnvelope(inner)  (SOAP envelope)
        │  ◄─── application/soap+xml ────────────│
   res.text()                                    │
   unwrapEnvelope() → parseResult()              │
   → typed object → UI / grade calc              │
```

**Mock mode** (default dev): the browser's Mock Service Worker intercepts
`POST /api/synergy` *before* it leaves the browser and returns a fixture — the server
proxy is never hit. Turn mocks off to exercise the real proxy (§8).

---

## 3. File-by-file reference

### Client side
- **`src/lib/synergy.ts`** — the client's Synergy interface. `StudentAccount` methods
  (`checkLogin`, `gradebookRequest`, `attendance`, `studentInfo`, `documents`,
  `reportCard`, `mailData`, `attachment`) all POST to `/api/synergy`. Contains
  `wrapEnvelope`/`unwrapEnvelope` (SOAP envelope helpers, keyed on the single operation
  `ProcessWebServiceRequest`), `parseResult` (throws on `RT_ERROR`), and
  `parseGradebookXML`. `alwaysArray` forces `Course`, `Mark`, `Assignment`,
  `ReportPeriod`, `Absence` to parse as arrays even when singular.
- **`src/lib/account.svelte.ts`** — `acc.studentAccount` global + `loadStudentAccount()`
  (rebuilds it from the `token` in localStorage: `{username, password, domain}`).
- **`src/routes/login/+page.svelte`** — the login form. Contains a **dev-only auto-skip**
  block (see §9) that must be removed before shipping.
- **`src/lib/grades/`** — the grade-calc engine and gradebook catalog:
  - `catalog.svelte.ts` / `catalog.ts` — fetch, cache (localStorage key `gradebook4`),
    and report-period switching. `getGradebookRecord()` calls
    `account.gradebookRequest()`; records are cached per period and refreshed after 5 min.
  - `gradebook.ts` — `getActiveGradebook()` (parses the cached record for the active period).
  - `course.ts` — `getCourseGrade`, `getSynergyCourseAssignmentCategories`.
  - `assignments.ts` — `parseSynergyAssignment` + all calculation functions (§7).

### Server side (all under `src/lib/server/`, i.e. never sent to the browser)
- **`src/routes/api/synergy/+server.ts`** — the proxy endpoint. Validates the JSON body,
  calls `getSession`, dispatches on `methodName` to a `client.ts` function, wraps the
  result via `wrapEnvelope`, and returns it. **Errors are returned as an `RT_ERROR`
  inside a normal HTTP 200 envelope** (mirrors the old API's error channel) — see
  `errorEnvelope()`.
- **`src/lib/server/synergy/login.ts`** — `login({domain,username,password})`: GETs
  `PXP2_Login_Student.aspx` (follows the `?regenerateSessionId=true` redirect that seeds
  `ASP.NET_SessionId` + `EESPSV`), reads the WebForms hidden fields
  (`__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`), POSTs the credentials, and
  detects failure by whether the login form re-renders. Returns a `SynergySession`
  `{domain, jar, cookie}`. Throws `SynergyAuthError` on bad credentials.
- **`src/lib/server/synergy/http.ts`** — cookie-aware fetch. `CookieJar` is a
  `Map<name,value>`. `fetchFollowRaw`/`fetchFollow` follow redirects **manually**
  (`redirect: 'manual'`) so `Set-Cookie` from intermediate 302 hops is accumulated, and a
  browser-ish `User-Agent` is sent. `redirected` flags whether any hop redirected (used to
  detect "module bounced to Home").
- **`src/lib/server/synergy/session.ts`** — in-memory session cache (20 min TTL, keyed by
  `sha256(domain+username+password)`), so repeated loads reuse one login. Contains the
  **dev-only `devCookieSession()` override** (see §9).
- **`src/lib/server/synergy/client.ts`** — high-level fetchers. Each returns a *legacy
  inner XML string*. `studentInfo`, `documents`, `reportCard`, `attendance` are done.
  `gradebook`, `mailData`, `attachment` **throw** `SynergyDataError` for now.
- **`src/lib/server/synergy/translate.ts`** — converts scraped portal HTML/JSON to the
  legacy inner XML shapes (`studentInfoXml`, `documentsXml`, `reportCardXml`,
  `attendanceXml`). `extractJsonAfter()` pulls a balanced JSON literal following a needle
  (used to grab DevExpress grid `"dataSource":[...]` arrays out of page HTML). **The
  gradebook translator will live here.**

### Mocks (offline/demo dev)
- **`src/lib/mocks/handlers.ts`** — MSW handler for `POST /api/synergy`; maps `methodName`
  → fixture, wrapped in an envelope. It `import(... '?raw')`s **all 7** fixtures at module
  load, so **every fixture file must exist** or MSW fails to initialize.
- **`src/lib/mocks/browser.ts`**, **`src/hooks.client.ts`** — MSW worker setup. Enabled
  when `dev && browser && PUBLIC_DISABLE_MSW !== 'true'`.
- **`src/lib/mocks/data/*.xml`** — the fixtures. **Gitignored** and generated (see
  `scripts/generate-mock-fixtures.mjs`). Not shipped.

---

## 4. The legacy XML shapes

Each proxy response is `wrapEnvelope(<inner XML>)`. The inner XML shapes (what the
translators must emit and what the client parses) are:

| Root element | Consumed by | Reference fixture |
|---|---|---|
| `<StudentInfo>` | `src/lib/types/StudentInfo.ts` | `fixtures/StudentInfo.xml` |
| `<StudentDocuments>` | `src/lib/types/Documents.ts` | `fixtures/Documents.xml` |
| `<DocumentData>` | `src/lib/types/ReportCard.ts` | `fixtures/DocumentData.xml` |
| `<Attendance>` | `src/lib/types/Attendance.ts` | `fixtures/Attendance.xml` |
| `<Gradebook>` | `src/lib/types/Gradebook.ts` + grade calc | `fixtures/Gradebook.xml` |

XML **attributes** parse to `_`-prefixed keys (e.g. `CourseName="…"` → `._CourseName`);
child elements parse to nested objects. Empty elements become `null` client-side
(`convertEmptyElementToNull`). See `fixtures/` for annotated, synthetic-but-valid
examples, and validate any fixture set with `scripts/verify-fixtures.mjs`.

---

## 5. Endpoint call convention

Client → proxy request body (`POST /api/synergy`, `application/json`):

```json
{ "domain": "…-psv.edupoint.com", "userID": "…", "password": "…",
  "methodName": "GetStudentDocumentInitialData", "params": { } }
```

`params` carries per-method extras: `{ "ReportPeriod": <number> }` for `Gradebook`,
`{ "DocumentGU": "<token>" }` for `GetReportCardDocumentData`,
`{ "SmAttachmentGU": "…" }` for `SynergyMailGetAttachment`.

Response is always HTTP 200 `application/soap+xml`. Success → data envelope; failure →
`<RT_ERROR ERROR_MESSAGE="…"/>` envelope (the client's `parseResult` throws that message).

---

## 6. ⛔ THE OPEN TASK — Gradebook translator

### 6.1 Why it's pending
`client.ts gradebook()` currently GETs `PXP2_Gradebook.aspx?AGU=0` and then throws:
- if the request **redirected** → `"No gradebook is available for the current grading
  period yet."` (happens between terms / summer — the module bounces to Home);
- otherwise → `"Gradebook translation is pending a captured active-term payload."`

An active-term gradebook renders as server HTML with embedded JSON (DevExpress grids). To
map every field correctly (especially scaled points and the empty-string conventions the
calc engine relies on), you need a **real captured payload from a live grading period.**
That's the only reason this is unfinished.

### 6.2 How to capture (do this first, once grades are back)
```powershell
$env:SYNERGY_DOMAIN   = "yourdistrict-psv.edupoint.com"
$env:SYNERGY_USERNAME = "you@school.net"; $env:SYNERGY_PASSWORD = "your-password"
bun functionality/scripts/capture-portal-payloads.mjs
```
This writes raw pages to `functionality/captures/` (gitignored). Open
`captures/gradebook.html` and locate the `"dataSource":[ … ]` arrays — those hold the
courses / marks / assignments. Some districts also render per-class detail on
`PXP2_ClassGrades.aspx` (also captured). Use `extractJsonAfter()` (already in
`translate.ts`) to pull those arrays out.

### 6.3 What to build
Add `gradebookXml(...)` to `translate.ts` and rewrite `client.ts gradebook()` to:
1. GET the gradebook page (and per-class pages if the weights/assignments live there).
2. `extractJsonAfter(html, '"dataSource":')` for each grid.
3. Emit `<Gradebook>` matching **`fixtures/Gradebook.xml`** and `src/lib/types/Gradebook.ts`.

### 6.4 Target field mapping (what the emitted XML MUST contain)

| Legacy XML | Meaning | Read by |
|---|---|---|
| `ReportingPeriods/ReportPeriod[]` `_Index/_GradePeriod/_StartDate/_EndDate` | all periods | period switcher; `catalog.ts` |
| `ReportingPeriod` (singular) `_Index` | the period THIS payload is for | `catalog.ts getInitialGradebookCatalog` (`parseInt`) |
| `Course` `_CourseName` **and** `_CourseID` | **required** — sidebar renders them | `AppSidebar.svelte`, `grades/+page.svelte` |
| `Course` `_Title/_Period/_Room/_Staff/_ImageType` | display | grades UI |
| `Mark._CalculatedScoreString` / `_CalculatedScoreRaw` | official letter / % | `course.ts getCourseGrade` |
| `GradeCalculationSummary/AssignmentGradeCalc[]` `_Type/_Weight/_Points/_PointsPossible/_WeightedPct/_CalculatedMark` | weighted categories | `getSynergyCourseAssignmentCategories` |
| `Assignments/Assignment[]` (see §7 for exact fields) | per-assignment scores | `parseSynergyAssignment` |

### 6.5 Non-negotiable conventions (get these wrong → wrong grades)
- **Extra credit** is encoded as `PointPossible=""` (empty string), not `0`.
- **Not for grading** is `Notes` starting with `"(Not For Grading)"`.
- **Scaled scores**: the calc engine distinguishes scaled points
  (`Point`/`PointPossible`) from unscaled (`ScoreCalValue`/`ScoreMaxValue`). If an
  assignment is scaled, populate **both** pairs with different values; if not, keep them
  equal. Map the portal's raw vs. scaled columns accordingly.
- **`Point` may be empty** to mean 0 earned.
- Arrays: `Course`/`Mark`/`Assignment`/`ReportPeriod` are forced to arrays by
  `alwaysArray`, so a single element is fine.

### 6.6 Verify after building
1. `bun functionality/scripts/pull-real-data.mjs` → the `Gradebook` line should report
   "returned data".
2. Run the app in real mode (§8) and confirm the Grades page + hypotheticals match the
   portal's numbers for a few courses (weighted and unweighted).

---

## 7. Grade calculations — do they still work?

**Yes.** The entire calc engine (`src/lib/grades/assignments.ts`, `course.ts`) is
**client-side and source-agnostic** — it operates only on the parsed `Gradebook` object,
with no knowledge of SOAP vs. web portal. Weighted category grades, per-assignment grade
impact (GPCs), hypothetical assignments, "points needed for target grade", and hidden/
point-discrepancy detection are all preserved **as long as the Gradebook translator emits
the fields in §6.4–6.5.**

`parseSynergyAssignment` (assignments.ts) reads exactly these assignment fields:

| Field | Derived value |
|---|---|
| `_Point` (empty ⇒ 0) | `pointsEarned` |
| `_PointPossible` \|\| `_ScoreMaxValue` \|\| parse of `_Points` | `pointsPossible` |
| `_PointPossible === ''` | `extraCredit` |
| `_Notes` starts `(Not For Grading)` | `notForGrade` |
| `_Type` | `category` |
| `_ScoreCalValue` / `_ScoreMaxValue` vs `_Point` / `_PointPossible` | scaled → `unscaledPoints` |
| `_Measure` / `_MeasureDescription` / `_Notes` / `_Date` / `_GradebookID` | name / description / comments / date / id |

If a class has **no** `GradeCalculationSummary`, the engine gracefully falls back to
point-total calculation (`calculateAssignmentGPCsFromTotals`) — same behavior as old
GradeCompass on unweighted classes.

---

## 8. Running & testing

### Run the app
```powershell
bun run dev
```
The package script binds `--host gradecompass.localhost`. **On Windows that hostname may
not resolve at the OS level** (it only resolves inside browsers), so if Vite errors with
"port in use"/host binding, run:
```powershell
bun run -b vite dev --host localhost --port 5173 --strictPort
```

### Mode A — Mock data (default, no account)
MSW serves the fixtures. Just open `/login` (dev auto-skip, see §9) or the `/dev-login`
helper to land in the app with synthetic data. If `src/lib/mocks/data/` is empty (fresh
clone), generate it first:
```powershell
bun functionality/scripts/generate-mock-fixtures.mjs
bun functionality/scripts/verify-fixtures.mjs   # sanity check
```

### Mode B — Real portal, real login
```powershell
$env:PUBLIC_DISABLE_MSW = "true"   # disables MSW; real /api/synergy proxy is used
bun run dev
```
Log in at `/login` with a real StudentVUE username/password/domain. Documents/StudentInfo/
Attendance load live; Gradebook shows the "not available" message until §6 is done.

### Mode C — Real portal via a captured cookie (demo without a password)
The proxy has a dev-only override (`session.ts devCookieSession()`): set a cookie + domain
and it skips login entirely.
```powershell
$env:PUBLIC_DISABLE_MSW  = "true"
$env:SYNERGY_DEV_DOMAIN  = "yourdistrict-psv.edupoint.com"
$env:SYNERGY_DEV_COOKIE  = "ASP.NET_SessionId=xxx; EESPSV=yyy"
bun run dev
```
(Session cookies expire after ~20 min idle; then use Mode B.)

### Standalone scripts (no app server needed)
| Script | What it does |
|---|---|
| `scripts/capture-portal-payloads.mjs` | **§6.2** — dump raw portal pages to `captures/` for building translators |
| `scripts/pull-real-data.mjs` | drive the real `client.ts` fetchers; prints shapes/counts only (safe output) |
| `scripts/verify-fixtures.mjs [dir]` | parse fixtures through the real client path; catches malformed data |
| `scripts/generate-mock-fixtures.mjs` | (re)write the synthetic MSW fixtures into `src/lib/mocks/data/` |

All credential-using scripts read env vars (`env.example`); none hardcode secrets.

---

## 9. ⚠️ Dev-only scaffolding to REMOVE before shipping

These were added to demo the integration and must be deleted/reverted before production:

1. **`src/routes/dev-login/`** — entire route. Presets a fake token, clears localStorage,
   redirects to `/documents`.
2. **`src/routes/login/+page.svelte`** — the auto-skip block gated on
   `dev && PUBLIC_DISABLE_MSW !== 'true'` (marked with a "Remove this block before
   shipping" comment). Restore the original `if (browser && token) goto('/grades')`.
3. **`src/lib/server/synergy/session.ts`** — `devCookieSession()` and its call at the top
   of `getSession()` (marked "TEMPORARY dev-only override").
4. **`src/lib/mocks/data/`** — synthetic fixtures; gitignored, so they won't ship, but
   they are only for mock-mode dev. Keep the generator script, not committed data.

(`functionality/` itself is developer documentation — exclude it from the production build;
it is not imported by the app.)

---

## 10. Environment variables

| Var | Used by | Purpose |
|---|---|---|
| `PUBLIC_DISABLE_MSW` | `hooks.client.ts`, login auto-skip | `"true"` disables mocks → real proxy |
| `PUBLIC_MOCK_STUDENTVUE_ORIGIN` | `hooks.*` | (existing) origin used for MSW unhandled-request warnings |
| `SYNERGY_DEV_DOMAIN` | `session.ts` | dev cookie-override domain |
| `SYNERGY_DEV_COOKIE` | `session.ts` | dev cookie-override `Cookie` header |
| `SYNERGY_DOMAIN` | scripts | portal host for capture/pull scripts |
| `SYNERGY_USERNAME` / `SYNERGY_PASSWORD` | scripts | login for capture/pull |
| `SYNERGY_COOKIE` | scripts | cookie alternative to user/pass for capture/pull |

---

## 11. Security & privacy

- Credentials are passed through per request and **never persisted** server-side; only the
  derived cookie jar is cached in memory (`session.ts`, 20 min TTL). On the client, the
  `{username,password,domain}` token lives in localStorage (unchanged from before).
- **Never commit** real cookies, credentials, or `functionality/captures/` output.
- The dev overrides (§9) bypass authentication — they must not reach production.

---

## 12. Glossary

- **PXP2** — the modern Synergy/StudentVUE web portal (ASP.NET WebForms).
- **`D5518-00`** — the error the deprecated mobile SOAP API now returns for everything.
- **Legacy inner XML** — the XML the old API returned inside its SOAP `…Result` element;
  the whole proxy exists to reproduce this shape so the client stays unchanged.
- **`ProcessWebServiceRequest`** — the single SOAP operation name the envelope
  wrap/unwrap and the gradebook cache are keyed on.
- **DevExpress `dataSource`** — the embedded JSON arrays in portal page HTML that hold the
  actual grid rows (documents, attendance, gradebook).
- **RT_ERROR** — the error element carried inside an otherwise-normal 200 response.
