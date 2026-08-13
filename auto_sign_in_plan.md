# Auto sign-in — Execution Plan

> **Status (2026-08-05): DONE, live-verified on www.scoremap.org.** Shipped in
> `5eb558a` (feature) + `0704ad8` (the instanceof error-mapping fix, found when
> the live poisoned-password check exposed the minified-name bug — §6). Final
> verification with a real account, all passing: sign-in persists credentials;
> a fresh browser session opens `/` straight onto the dashboard with cached
> data while the pill shows "Syncing…" and the background sync lands over the
> relay; a rejected saved sign-in bounces to `/login` with the explanation,
> username/domain prefilled, and the dead credentials erased. Boot syncs are
> skipped while the snapshot is under 60 s old (relay budget). Known gap, not
> in scope: the SyncPill has no error label — a failed background refresh
> shows "Last updated ..." with no hint the refresh failed.

Goal: after the first successful sign-in, opening Grademax goes straight to the
dashboard showing the grades from the last sync, then a background sync refreshes
them in place — NumberFlow spins the deltas, charts re-sweep, the change ticker
lists what moved. The saved sign-in keeps working until the portal rejects it;
only then does the app clear it and return to the login page. All work happens in
`github/` (the deployed repo). Commits authored by Tiger only.

---

## 1. How GradeCompass did it (reference: `full/gradecompass`)

Verified against the source, not from memory:

- **Persistence = the credentials themselves.** On login it stores
  `localStorage['token'] = JSON.stringify({ username, password, domain })`
  (`login/+page.svelte:71`) — plaintext, misnamed "token". Auto sign-in is
  *replaying the password*, not a session token; the server keeps a cookie jar
  for ~20 min keyed by a hash of the credentials.
- **Data cache = raw portal payloads with timestamps.** Gradebook XML per report
  period under `gradebook4` as `{ xml, lastRefresh }` (`grades/catalog.ts`);
  attendance/documents/mail/studentInfo under their own keys via a generic
  stale-while-revalidate helper (`lib/index.ts:66-123`). Everything derived is
  recomputed on read.
- **Boot = presence check, no validation call.** Three identical guards
  (`+page.svelte:16-20`, `login/+page.svelte:29-32`, `(authed)/+layout.svelte:16-22`)
  run in component init, before first paint: token key present → `/grades`,
  absent → `/login`. Cached XML is read synchronously and painted in the same
  tick; a refresh fires from `onMount` only if the record is >5 min old.
- **The stale→fresh swap animates for free.** `@number-flow/svelte` is an
  uncontrolled odometer — replacing the data recomputes derived values and the
  digits tween. A floating banner with a stopwatch shows over the stale grades
  while the refresh is in flight.
- **Two flaws we will not copy:**
  1. **A dead password is never cleared.** `SynergyAuthError` comes back as a
     banner over stale grades (`catalog.svelte.ts:153-158`); the stored
     credentials survive, every reload retries and fails, and the only escape is
     the manual Log Out. The user's ask — "until the sign in stops working" —
     is precisely the branch GradeCompass lacks.
  2. **Non-gradebook refresh errors are swallowed** (`lib/index.ts:117-119`),
     leaving silently stale data.
- Logout is `localStorage.clear()` + a full page load (`AppSidebar.svelte:28-31`).

## 2. Where grademax stands today (`github/src`)

The app is a client-only scraper: login and every fetch run in the browser over
the blind relay; there is no server to hold sessions.

- **Nothing durable is stored.** `src/data/api.js:37-40` keeps four
  `sessionStorage` keys: `grademax-session` (portal cookie jar), `grademax-test-session`,
  `grademax-student`, `grademax-snapshot` (whole parsed snapshot, 20-min TTL —
  `SNAPSHOT_MAX_AGE_MS`, api.js:45). The password is deliberately never written
  (api.js:6-11). Close the tab → everything is gone → `/login`.
- **Cache-first already works within a tab.** `SyncProvider.jsx:23` restores the
  snapshot mirror at mount (`status:'ready'`, zero requests); every `store()`
  writes through to the mirror. The missing piece is durability + refresh.
- **No re-login exists, by design.** `SessionExpiredError` → `clearToken()` →
  `signedOut` → login page (api.js:216, SyncProvider.jsx:87-92). The comment at
  api.js:9-11 says why: "we can't silently re-login because we don't keep the
  password." Storing the password is exactly what this feature changes.
- **Errors are already distinguishable where it matters**: `mapError`
  (api.js:191-206) maps `AuthError → ['AUTH_FAILED', 401]`,
  `SessionExpiredError → ['SESSION_EXPIRED', 401]`, network/portal faults →
  502s. The policy layer can key off `e.code`.
- **The animations the user wants are already data-driven**: `GradeNumber`
  (NumberFlow, 400 ms, spins on value change), chart sweeps keyed on
  `session.lastUpdated` (`GradeChart.jsx:29`, `OverviewChart.jsx:38`,
  `.gm-chart-draw` in `index.css`), `ChangeTicker` fed by `useSyncChanges()`,
  progress bars with width transitions. A restored snapshot carries
  `lastUpdated`, so charts sweep once from cache and re-sweep when fresh data
  lands with a new timestamp — that double sweep reads as "fresh data arrived"
  and is kept deliberately.
- **Useful accidents**: `snapshot.session.username/domain` are declared but never
  written (`snapshot.js:19-20`) — free slots for login-page prefill.
  `Dashboard.jsx:201-207` shows "Syncing your gradebook…" only when `classes`
  is empty, so with cached classes present the stale rows + `SyncPill`'s
  "Syncing…" label are already the wanted refresh UX.
- **Test account** (`test`/`test` at Hustler's University) is marker-based and
  offline (`api.js:229-237`, `studentvue.js:307-311`). Replaying stored test
  credentials through `api.login()` hits the `isTestCredentials` branch before
  any network — so one storage mechanism can serve both.
- **RequireAuth** (`App.jsx:27-31`): `status === 'signedOut' && !hasToken()` →
  `/login`. `hasToken()` is a synchronous storage read, so extending it to see
  stored credentials avoids any login flash. Nothing currently redirects a
  signed-in user off `/` or `/login`.

## 3. Design decisions

1. **Store credentials in `localStorage`, plaintext, one key.**
   `grademax-credentials` = `JSON.stringify({ username, password, domain })`.
   Same call GradeCompass made, honestly named. No obfuscation: base64 or a
   bundled key is security theater — any JS on the origin (the only realistic
   reader) could decode it, and a device-level attacker has devtools anyway.
   The real mitigations are the existing ones: nothing leaves the browser
   unencrypted, and sign-out wipes it.
2. **The snapshot mirror moves to `localStorage` and loses its TTL.**
   `grademax-snapshot` currently dies with the tab and expires at 20 min because
   it was tied to the cookie jar's lifetime. With replayable credentials that
   coupling is wrong: stale grades painted instantly are the entire point.
   `lastUpdated` (already displayed by `SyncPill`, already the chart draw key)
   is the staleness signal; the auto-refresh on boot is the correction. The
   cookie jar stays in `sessionStorage` — it is genuinely short-lived.
   `grademax-student` moves alongside the snapshot (it exists to paint the
   sidebar identity).
3. **Re-login is a policy of the api layer, single-flight, retry-once.**
   A new `ensureSession()`: if an in-memory/session jar exists, use it; else if
   credentials exist, `login()` with them (deduped so concurrent resource
   fetchers share one login). `withSession()` gains: on `SESSION_EXPIRED`, if
   credentials exist → re-login once → retry the fetch; on `AUTH_FAILED` from
   that re-login → **clear credentials + all state** and surface the 401.
   This is the "until it stops working" contract:
   - `AUTH_FAILED` (portal says wrong password) → forget the sign-in, bounce to
     `/login` with an explanatory notice, username/domain prefilled.
   - `SESSION_EXPIRED` → silently heal.
   - Network/relay/portal faults (502s) → keep credentials, keep cached data,
     `status:'error'` — a dead relay must not log anyone out.
4. **Boot flow** (SyncProvider): restore mirror → if credentials or test marker
   exist, paint cached data immediately and start a background sync
   (`status:'syncing'` — with cached classes present the UI already renders
   data + "Syncing…" pill); no cached data → normal spinner path. On sync
   success, `store()` updates the snapshot → NumberFlow/charts/ticker animate.
   The existing `initial.current` guard keeps StrictMode's double-mount from
   double-syncing (GradeCompass had exactly that bug).
5. **Route behavior**: `Landing` and `Login` redirect to `/dashboard` when a
   sign-in is stored (GradeCompass bounced both). Sign-out clears storage
   before navigating to `/login`, so no loop. `RequireAuth` unchanged except it
   now sees stored credentials through `hasToken()`.
6. **Sign-out clears everything durable**: credentials, snapshot, student,
   test marker (which also moves to `localStorage` so the demo account
   auto-signs-in across restarts like a real one), plus the existing session
   keys. `clearToken()` stays the single funnel.
7. **The privacy copy must stop being false the moment we store the password.**
   - `Login.jsx:199-203`: "…never sent to our servers, stored, or logged" →
     "…never sent to our servers or logged. To keep you signed in, it's saved
     only on this device — signing out erases it."
   - `README.md` Trust section, same correction.
   - `Sidebar.jsx:199` / `PrivacyDialog.jsx` lines stay true as written
     ("only seen by StudentVUE and you") — reviewed, no change needed.
8. **Auth-failure notice**: `clearToken({ authFailed: true })` leaves a one-shot
   `sessionStorage` flag; `/login` reads it, shows "Your saved sign-in stopped
   working — StudentVUE rejected it. Enter your password to reconnect.", and
   prefills username/domain from the last snapshot's `session` fields (now
   actually written during sync).

## 4. Implementation

All in `github/src`.

- **`data/api.js`** — the bulk:
  - New key `CREDS_KEY = 'grademax-credentials'` (localStorage) + helpers
    `rememberCredentials`, `recallCredentials`, `clearCredentials`, all
    try/catch-wrapped like every other storage access.
  - `SNAPSHOT_KEY`/`STUDENT_KEY` reads/writes move to `localStorage`;
    `SNAPSHOT_MAX_AGE_MS` and the TTL check in `recallSnapshot()` are deleted
    (its test updates accordingly). Migration: on boot, purge the old
    sessionStorage copies so nothing reads a half-moved state.
  - `TEST_SESSION_KEY` moves to `localStorage`.
  - `hasToken()` also returns true when credentials exist.
  - `login()` persists credentials on success (both real and test paths).
  - New `ensureSession()` with a module-level in-flight promise (single-flight);
    `withSession()` uses it and adds the retry-once-on-expiry + clear-on-auth-fail
    policy from §3.3.
  - `clearToken(opts)` additionally removes `CREDS_KEY` + the moved keys, and
    sets the one-shot auth-failed flag when asked.
- **`data/studentvue.js`** — `sync()` writes `session.username` and
  `session.domain` into the snapshot (from the stored credentials / test
  constants) so prefill and the pill have them.
- **`data/SyncProvider.jsx`** — boot effect becomes: restored snapshot with a
  stored sign-in → `status:'syncing'` + background `runSync()`; restored
  snapshot without one (shouldn't happen post-migration, but harmless) →
  `'ready'`; no snapshot but stored sign-in → `'syncing'` spinner path (first
  paint after a cleared cache); neither → `'signedOut'`. The 401 handler keeps
  doing exactly what it does — `clearToken` has already stripped credentials by
  the time it runs.
- **`pages/Login.jsx`** — password-note copy per §3.7; auth-failed notice +
  username/domain prefill per §3.8; redirect to `/dashboard` when already
  signed in.
- **`pages/Landing.jsx`** — redirect to `/dashboard` when signed in.
- **`README.md`** — Trust section wording.
- No changes to charts/NumberFlow/ticker — they animate off data identity
  already (§2).

## 5. Tests & verification

- **Unit (`src/data/api.test.js` + new cases)**: credential round-trip;
  `hasToken()` true on credentials alone; snapshot survives >20 min and a
  simulated restart (storage stub persists); `clearToken` removes credentials
  and sets the auth flag only when asked; `withSession` heals `SESSION_EXPIRED`
  by re-login + retry (fake fetch script), clears credentials on `AUTH_FAILED`,
  and leaves them on a 502.
- **`npm run build` + `npx vitest run`** in `github/` (absolute paths — the
  cwd-reset gotcha).
- **Live, headless Edge against the deployed site**:
  1. Sign in `test`/`test` → dashboard renders.
  2. New browser context reusing the same storage state → open `/` → lands on
     `/dashboard` with data, no `/login` flash.
  3. Real-credential run: sign in, capture localStorage, fresh context → root →
     cached grades paint, pill shows "Syncing…", then "Last updated" flips and
     numbers settle — the stale→fresh swap.
  4. Poisoned-password run: overwrite the stored password via `page.evaluate`,
     reload → bounced to `/login` with the notice, username/domain prefilled,
     credentials gone from storage.
  5. Relay-down run (point `VITE_RELAY_URL` build at a dead port locally or
     block the WS host in the context): cached grades stay, error state shows,
     credentials survive.
- Deploy via push (auto-triggers), then repeat check 1–2 against
  `www.scoremap.org`.

## 6. Risks / notes

- **Shared computers**: grades + password now persist until sign-out. That is
  the feature as requested and matches the reference app; sign-out remains the
  remedy and the copy says so.
- **`mapError` keyed off `e.constructor.name` — this risk turned out to be a
  live production bug.** esbuild's minifier mangles class names, so in the
  deployed bundle every portal error mapped to `INTERNAL` and the poisoned-
  password verification stayed on the dashboard with a generic error instead of
  signing out (also pre-existing: a mid-use session expiry showed 'error'
  instead of returning to login). Fixed during implementation: the table now
  matches by `instanceof`, with a mangled-name regression test in
  `api.test.js`.
- **Quota**: snapshot writes already delete-on-failure (api.js:133); same
  pattern for the new key.
- `github_test/` untouched; work lands directly in `github/` per the standing
  push-when-it-works instruction.
