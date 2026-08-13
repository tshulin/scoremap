# Refactor plan — the "blind relay" (browser-terminated TLS)

Turn the architecture proven in `poc/` (see `idea.md` §11) into the real product:
the browser does login + scraping + parsing + grade math over a **blind byte relay**,
so the VPS never sees a plaintext password, cookie, or grade. This plan is the
step-by-step to get there without breaking the app between steps.

> **Status: plan only. Nothing here is built yet.** Do not start until this is approved.

---

## 1. Folder & branch model

Three working trees, all clones/copies of `github.com/tshulin/grademax` except `local`:

| Folder | Is | Git | Ships to | Pushed? |
|---|---|---|---|---|
| `full/` | **Integration workspace** — VPS code (`src/`) + site (`web/`) together | branch `full` (local only) | nothing directly | no (local integration) |
| `github/` | **The GitHub Pages site** (the browser app) | branch `main` | GitHub Pages | **yes → `origin/main`** |
| `local/` | **The VPS code** (the blind relay) | not a git repo | the VPS | **no — never pushed to this repo** |

**Workflow for every phase:** make the change in `full/` first (both halves visible, so
it can be verified end-to-end), verify it works, then mirror the site half into `github/`
and the VPS half into `local/`, and commit/push per §7.

**Heads-up — `github/main` is ahead of `origin/main`.** The local `main` already has
unpushed commits that moved the app to the repo root and started running the grade engine
in the browser (`4bf933d`, `5bbb8a9`, `91a8013`). The first `git push` will include those.
That looks intended (it's the direction this refactor completes), but confirm before the
first push.

---

## 2. Decisions & assumptions

Flag any you want changed before we start.

1. **Migration = replace outright (assumed).** The PoC proved the relay path against the
   real portal and the site is pre-launch, so we delete the server-side scraper (Hono API,
   session store, page clients on the server) and the VPS becomes only the relay. *No
   dual-mode flag.* If you'd rather keep the old backend behind a flag and cut over later,
   say so and I'll restructure Phases 1/4.
2. **subtls is the browser TLS client, pinned + vendored, with a validation gate.** It's
   labeled experimental, so: pin an exact version, vendor a copy (don't float on npm), and
   Phase 2 has a hard go/no-go browser test. Fallback if it fails in a real browser:
   rustls-compiled-to-WASM (heavier). The Go Daddy Root G2 cert is bundled as the only
   trusted root (verified in the PoC).
3. **Ported modules stay TypeScript; Vite compiles them.** `portal/extract/domain/calc`
   move into the site as `.ts`; Vite/esbuild handle TS in a JS project with no ceremony.
   Their `*.test.ts` suites move with them and run under Vitest added to the site — we keep
   the ~existing test safety net, not throw it away.
4. **Relay stays small and dependency-light.** `ws` + Node `net` only, mirroring
   `poc/relay.mjs`. Written as TS to reuse the repo's eslint/prettier/vitest, but it's
   ~150 lines including hardening.
5. **Git attribution:** commits are authored as you, **no `Co-Authored-By` trailer** (per
   your instruction). Pushes go to `origin/main` for site changes only.
6. **Session model (idea.md §5.5):** credentials in `localStorage` (as GradeCompass did),
   cookie jar in memory per tab, silent client-side re-login on portal-session expiry. The
   backend bearer-token/session store is deleted.

---

## 3. Module disposition (current → after)

| Current (`full/src/…`) | After | Where it lives |
|---|---|---|
| `portal/http.ts` (CookieJar, fetchFollow) | keep, inject the subtls fetch-shim | site: `web/src/portal/` |
| `portal/login.ts`, `portal/pages/*` | keep, unchanged logic | site: `web/src/portal/` |
| `extract/*`, `domain/*`, `calc/*` | keep as-is (pure TS) | site: `web/src/{extract,domain,calc}/` |
| `portal/session.ts` (`SessionStore`) | **delete** — browser holds session | — |
| `portal/base.ts` (`PORTAL_BASE_OVERRIDE`) | fold into relay/host config | site (thin) |
| `api/*` (Hono app, auth, rate limit, routes) | **delete** — no API anymore | — |
| `mock/portal.ts`, `mock/*` | keep for tests (inject as fetch) | site tests |
| `index.ts` (server entry) | **delete** | — |
| *(new)* blind relay | **new** | VPS: `local/` (dev copy `full/relay/`) |
| *(new)* `transport/` subtls + WS + fetch-shim | **new** | site: `web/src/transport/` |
| `web/src/data/api.js` (HTTP→backend) | rewrite to call the browser portal client | site |
| `web/src/data/{studentvue,SyncProvider,snapshot}.js`, pages, components | **unchanged** (consume domain shapes) | site |

---

## 4. Phases

Each phase: **Objective → Edit in `full` → Verify → Ship** (mirror + commit + push per §7).
Phases are ordered so the app keeps working (or is verifiably inert) between steps.

### Phase 1 — The blind relay (VPS side)
- **Objective:** production-grade relay replacing the whole backend.
- **Edit in `full`:** create `full/relay/` from `poc/relay.mjs`, hardened per idea.md §5.1:
  host allowlist (`*.edupoint.com:443`), **`Origin` check** (the Pages origin), per-IP
  connection cap + rate limit, idle/lifetime timeouts, backpressure, metadata-only logging.
  Add `wss`-readiness note (terminates at Caddy/repo entry). Its own `package.json` (`ws`).
- **Verify:** unit tests for allowlist/Origin/limits (extend the PoC's allowlist test);
  boot the relay and re-run `poc/run-poc.mjs` + `poc/subtls-test.mjs` against it (login +
  subtls handshake still pass; relay dump still ciphertext-only).
- **Ship:** mirror `full/relay/` → `local/`. Commit `full`. **No `main` push** (VPS-only).

### Phase 2 — Browser transport: subtls + fetch-shim (site side)
- **Objective:** a `fetch`-compatible function that runs TLS in the browser over the relay.
- **Edit in `full/web`:** add pinned+vendored `subtls`; create `web/src/transport/`:
  - `relayTls.js` — open `WebSocket(VITE_RELAY_URL)`, `{host}` handshake, subtls `startTls`
    with the bundled Go Daddy Root G2 (browser build uses subtls's `WebSocketReadQueue` —
    the PoC's PEEK/undici workarounds are Node-only, see `poc/README.md`).
  - `fetchShim.js` — HTTP/1.1 over the TLS stream: build request (UA, `Accept-Encoding:
    identity`, `Cookie`), parse response (status, headers, **every `Set-Cookie`**, chunked,
    gzip via `DecompressionStream`), no auto-redirect. Signature matches `portal/http.ts`'s
    injectable `FetchLike`.
  - `goDaddyRootG2.js` — the bundled PEM.
- **Verify (go/no-go for subtls):** a dev harness route in the app that does a login-page
  GET over the relay from a **real browser** and shows handshake OK + `Set-Cookie` +
  `__VIEWSTATE` present. If subtls fails here, stop and switch to rustls-WASM before Phase 3.
- **Ship:** mirror `web/` → `github/` (root paths). Commit + **push `main`**.

### Phase 3 — Port portal/extract/domain/calc into the browser
- **Objective:** the real scraping/parsing/calc stack running client-side behind the shim.
- **Edit in `full/web`:** move `src/{portal,extract,domain,calc}` → `web/src/…`; wire
  `portal/http.ts` to the fetch-shim; delete `session.ts`/`base.ts`/server-only bits; add
  Vitest to `web` so the moved `*.test.ts` run (mock portal injected as the fetch). Delete
  `src/api`, `src/index.ts`, server `mock` entry.
- **Verify:** `npm test` in `web` green (ported unit tests, ~unchanged count); extend the
  Phase 2 harness to a **full login + student-info fetch** in-browser over the relay against
  the real portal (name renders). This is the real end-to-end proof.
- **Ship:** mirror `web/` → `github/`. Commit + **push `main`**. Mirror the now-shrunken
  VPS tree (only the relay remains) → `local/`.

### Phase 4 — Rewire the app data layer + session + login copy
- **Objective:** the app uses the browser portal client; the false privacy copy becomes true.
- **Edit in `full/web`:** rewrite `web/src/data/api.js` to call the browser portal client
  (login, student, documents, attendance, gradebook, downloadDocument) returning the **same
  domain shapes** — so `studentvue.js`/`SyncProvider.jsx`/`snapshot.js`/pages are untouched.
  Replace bearer-token-in-sessionStorage with the browser session model (§2.6). Update
  `Login.jsx` copy to the now-true statement (server can't see password; idea.md §6). Remove
  the Vite `/api` proxy; add `VITE_RELAY_URL`.
- **Verify:** run the app in a browser against relay + real portal (and mock): login,
  dashboard, attendance, documents, gradebook placeholder, PDF download, logout, expiry
  re-login. Confirm relay logs show ciphertext/metadata only.
- **Ship:** mirror `web/` → `github/`. Commit + **push `main`**.

### Phase 5 — Config, deploy, docs
- **Objective:** production build + deploy story for both halves.
- **Edit in `full`:** update `.github/workflows/deploy.yml` (drop `VITE_API_BASE`, add
  `VITE_RELAY_URL`); README trust section (idea.md §6 — the four honest claims); a
  `local/README` for VPS deploy (wss cert via Caddy/Let's Encrypt, `Origin`, DuckDNS/
  Cloudflare-Tunnel-for-CGNAT). Confirm gradebook placeholder path now runs in the browser.
- **Verify:** production build with `VITE_BASE=/grademax/`; Pages deploy dry run (or a real
  deploy to a test env); relay reachable over `wss://` from the built site.
- **Ship:** mirror → `github/` (commit + **push `main`**, triggers Pages). Deploy the relay
  from `local/` to the VPS (not pushed to this repo).

### Phase 6 — Cleanup & subtls hardening
- **Objective:** no dead code; subtls decision finalized.
- **Edit in `full`:** delete any remaining server-only leftovers; finalize subtls (pinned +
  vendored, or swapped to rustls-WASM per Phase 2 outcome); fold `poc/` learnings into docs
  and either keep `poc/` as a reference or remove it; refresh `CLAUDE.md`/`note.md` to the
  new architecture.
- **Verify:** full test pass in `web`; one more end-to-end browser run; grep the built
  bundle to confirm no `/api` remnants; relay dump ciphertext-only.
- **Ship:** mirror → `github/` (commit + **push `main`**) and → `local/`.

---

## 5. Verification strategy (what "confirm each step works" means)

- **Unit tests preserved:** the ported `extract/domain/calc/portal` suites run under Vitest
  in `web` — a step isn't done until they're green.
- **In-browser end-to-end:** the load-bearing checks (Phases 2–4) run in a real browser
  against the **real portal** over the relay, because subtls + WS + `DecompressionStream`
  are browser-runtime behaviors Node can't fully stand in for.
- **Privacy assertion carried forward:** each e2e run confirms the relay saw only ciphertext
  (scan its dev dump for the password/username — must be absent), the PoC's key guarantee.
- **No step regresses the app:** between steps the app either still works via the old path
  (until Phase 4 flips it) or the harness proves the new path before the flip.

---

## 6. Risks & rollback

| Risk | Mitigation |
|---|---|
| subtls fails in a real browser (vs. Node PoC) | Phase 2 is a hard gate before any porting; fallback rustls-WASM |
| `DecompressionStream`/chunked edge cases in the shim | test against real portal responses in Phase 2/3; `Accept-Encoding: identity` first |
| Pushing unpushed `main` reorg commits unintentionally | confirm before first push (§1) |
| Relay abused as open proxy | allowlist + Origin + limits from Phase 1, with tests |
| Losing the test safety net in the JS site | add Vitest to `web` in Phase 3; port `*.test.ts` with the modules |
| Mid-refactor breakage | each phase is a commit; `main` only moves forward on verified site steps; revert = reset the branch to the prior phase commit |

---

## 7. Git workflow per step

- **Author as the user; no `Co-Authored-By` trailer.**
- **`full`:** commit after each phase's `full` edits are verified (local integration record;
  not pushed).
- **`github/` → `origin/main`:** for phases that change the site (2, 3, 4, 5, 6), mirror
  `full/web/*` into `github/*` (site is at repo root; `full` keeps it under `web/`), commit,
  and `git push origin main`. One commit per phase, message describing the site change.
- **`local/`:** for phases that change the VPS code (1, 3, 5, 6), mirror the relay/VPS tree
  in; **do not push** (it's the VPS deployable, out of this repo's `main`).
- **Mirror mechanics:** `full` ↔ `github`/`local` structures differ (site under `web/` vs.
  at root; VPS is just the relay), so propagation is applying the equivalent edits/copies,
  not a git merge.
- **Confirm-before-push** on the very first `main` push (the pending reorg commits, §1).

---

## Open items to confirm before starting

1. Migration = **replace outright** vs. dual-mode flag (§2.1) — assumed replace.
2. OK to push the pending local `main` reorg commits with the first push (§1)?
3. Relay hosting: is there a VPS + domain for `wss://` yet, or should Phase 5 assume
   `ws://localhost` dev only for now and defer real hosting?
4. Keep `poc/` in the repo as reference, or remove in Phase 6?
