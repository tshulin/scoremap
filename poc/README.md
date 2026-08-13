# Blind-relay PoC

Proof-of-concept for `../idea.md`: a grademax where the student's password never
reaches our server, because TLS terminates **in the browser** over an opaque byte
relay. Verified live against the real portal (`ca-pleas-psv.edupoint.com`) on
2026-07-17.

## Result: HYPOTHESIS CONFIRMED ✅

| Test | What it proves | Result |
|---|---|---|
| `run-poc.mjs` | Full PXP2 login + authenticated page fetch through the relay, TLS terminating in the client | ✅ logged in, cookies captured, student page read |
| `subtls-test.mjs` | The **actual browser TLS client** (subtls, pure-JS TLS 1.3) does the handshake + HTTP + `Set-Cookie` over the relay, trusting only the Go Daddy root | ✅ handshake OK, login page + form + cookies |
| relay allowlist | Relay can't be abused as an open proxy / SSRF | ✅ rejects `evil.com`, `edupoint.com.evil.com`, `internal.local`, `notedupoint.com` |
| privacy check | The relay only ever sees ciphertext | ✅ password/username/HTTP payload absent from the relayed bytes |

Both the password (Node-TLS path) and the HTTP request body (subtls path) were
scanned for in the raw bytes crossing the relay and found **absent** — everything is
TLS ciphertext.

## Run it

```bash
cd poc
npm install
# credentials come from env only, never hardcoded / never printed
SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com \
SYNERGY_USERNAME=you@district.net \
SYNERGY_PASSWORD='...' \
node run-poc.mjs

SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com node subtls-test.mjs
```

## Files

- `relay.mjs` — the blind relay: WebSocket ⇄ TCP bridge with a `*.edupoint.com:443`
  allowlist and an optional byte-dump for the privacy check. **This is the only thing
  the home server would run in production.**
- `tunnel.mjs` — the client transport + HTTP/1.1 shim. Opens a WS to the relay, runs
  TLS over it (Node `tls.connect` here; subtls in the browser), writes an HTTP request,
  parses the response (chunked + gzip), captures `Set-Cookie`.
- `login-flow.mjs` — the PXP2 WebForms login + an authenticated page fetch, mirroring
  `../full/src/portal/login.ts` and `http.ts` (manual redirects, cookie jar).
- `run-poc.mjs` — orchestrator for the architecture test (Node TLS).
- `subtls-test.mjs` — orchestrator for the real browser-TLS test (subtls).

## What the PoC establishes vs. what remains

**Established (was uncertain, now proven):**

- The portal accepts a TLS session that terminates in the client over a byte relay.
- A pure-JS/WASM TLS client (subtls) completes the TLS 1.3 handshake against the
  portal and validates its cert against only the bundled Go Daddy Root G2.
- An HTTP/1.1 shim over that TLS stream reads `Set-Cookie` and the login form — the
  two things a browser `fetch` cannot do cross-origin, and the whole reason a server
  existed.
- The relay is structurally blind (ciphertext only) and safely allowlisted.

**Remains for the real build (engineering, not research):**

- Port the existing `src/portal`, `src/extract`, `src/domain`, `src/calc` into the
  browser bundle, injecting the subtls-backed fetch-shim (they already take an
  injectable `fetch`).
- Serve the relay over `wss://` with a real cert; add `Origin` check + rate limits +
  connection caps (see `idea.md` §5.1).
- Handle multi-request efficiency (one TLS session per tunnel is fine to start).

## Implementation gotchas found (write these into the browser port)

1. **subtls `networkRead` must honor PEEK.** subtls calls `read(1, PEEK)` to peek the
   TLS record-type byte before consuming it. A naive read function that always consumes
   eats the type byte, and subtls then reads the version byte `0x03` as the type →
   `Illegal TLS record type 0x3`. subtls's own `WebSocketReadQueue` handles this; if you
   roll your own read queue, implement PEEK. (In the browser, just use
   `WebSocketReadQueue` directly.)
2. **Node/undici only:** the global `WebSocket` pools receive buffers, and
   `new Uint8Array(msg.data)` is a *view*, so queued bytes get clobbered — copy them
   out. Also `WebSocket.send(view)` transmits the whole backing buffer, so send an
   exact-length copy. **Neither issue exists in a real browser** — these are artifacts
   of testing subtls under Node, not problems for the actual target.
3. `Connection: close` + one TLS session per request keeps the shim simple; the login
   flow opens ~4 tunnels and that's fine.
