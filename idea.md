# Idea — the "blind relay": a grademax where the password never touches the server

> **Status: PoC PASSED 2026-07-17 — hypothesis confirmed.** The proof-of-concept in
> `poc/` logged in through the blind relay against the real portal, and the browser-grade
> TLS client (subtls) completed the handshake over it — with the relay seeing only
> ciphertext. See §11 for results. The rest is engineering (port existing modules,
> harden the relay), not open research. Written 2026-07-17 from a design discussion; §4
> facts were tested live that day.

---

## 1. The problem this solves (trust model)

Grademax currently works like this: the browser sends `{domain, username, password}` to
our backend, which logs into the StudentVUE PXP2 portal server-side, holds the session
cookie, scrapes pages, and returns JSON. That architecture is sound, but it has an
unfixable trust ceiling:

- **The operator's server sees every student's plaintext password.** It must — it fills
  in the portal's login form. A malicious (or compromised, see below) server can log
  every password.
- Users **cannot verify** the server doesn't log. "Trust me" is the entire guarantee.
- A StudentVUE password is often the student's school Google password, or close to it.
- If someone compromises the home server the backend runs on, they can harvest every
  password submitted from that moment on (TLS terminates at the server), regardless of
  any no-retention policy in our code.

Constraints that rule out the standard fixes:

- **Browser extension / native app: not possible.** The audience is on school-managed
  Chromebooks — no extensions, no apps, often no DevTools. It must be a plain website.
- **Client-side portal calls: blocked.** The PXP2 portal sends no CORS headers, and the
  login depends on capturing `Set-Cookie` across redirect hops, which browser
  `fetch`/XHR never exposes to JS. This is *why the backend exists* (see
  `documentation.md` §1). That conclusion was and remains correct **for requests made
  through the browser's own HTTP machinery.**

The user-facing goal: **credentials may live in the browser (localStorage, as the
original GradeCompass did), but the plaintext password — and ideally the cookie and the
grades too — must never be readable by our server.**

## 2. The idea in one paragraph

Keep a server, but make it a **blind byte relay**: a ~100-line WebSocket service that
pipes opaque bytes between the browser and `<district>.edupoint.com:443`. The browser
runs a **TLS client implemented in JavaScript/WASM** and performs the TLS handshake
*with Edupoint, through the pipe* — so TLS terminates in the student's browser, not on
our server. The browser then speaks HTTP/1.1 over that TLS stream itself: it performs
the WebForms login, reads `Set-Cookie` directly (it *is* the TLS endpoint — CORS and
HttpOnly are browser-machinery rules and don't apply to a byte stream our own code
decrypts), scrapes the pages, and runs the parsers and grade engine locally. The server
carries only ciphertext it cannot read.

```
 Browser (GitHub Pages app)                    Home server              Edupoint portal
 ─────────────────────────                     ───────────             ───────────────
 UI + calc engine
 parsers (extract/, domain/)
 portal client (login, pages)
 fetch-shim (HTTP/1.1)                          WebSocket ⇄ TCP
 TLS 1.3 client (subtls)  ══ ciphertext ══► wss ─────────────── tcp ══► :443
 credentials + cookie jar                       (allowlist, rate
 (localStorage / memory)                         limit, Origin check)
```

Consequences:

- Password: typed in browser, encrypted in browser, decrypted only by Edupoint.
- Session cookie: extracted and held in browser. Never sent to our server.
- Grades: parsed and displayed in browser. Never seen by our server.
- The server can observe only **metadata**: client IP, timestamps, target district
  hostname (visible in the TLS SNI), and traffic volume.
- The code that *does* touch the password is the frontend — served by **GitHub Pages
  from a public repo**, so a malicious change to it must appear as a public commit.
  Server-side theft is undetectable in principle; this makes theft detectable in
  principle. That is the strongest trust story a website can offer.

## 3. Why CORS does not block this (read before objecting)

CORS is enforced by the browser on HTTP requests the **browser itself makes** via
fetch/XHR. In this design the browser makes exactly one network connection: a WebSocket
to **our** relay. WebSocket connections are not blocked by CORS (the server checks the
`Origin` header itself). The "HTTPS request to Edupoint" never exists in the browser's
networking layer — it is constructed *inside our JavaScript*, encrypted by our TLS
code, and shipped through the pipe as application data. There is nothing for CORS to
inspect, the same way CORS doesn't stop JS from computing anything else.

This is not a security-model loophole. CORS protects **ambient authority** — evil.com
silently reusing cookies your browser already holds, or probing intranet hosts. This
design has neither power: the JS has no access to the browser's edupoint.com cookie
jar (only what the user types into our form), and it can only reach hosts the relay
allowlists. In capability terms it is identical to the current server-side proxy; only
the TLS termination point moves. Prior art: websockify/noVNC (VNC-over-WebSocket since
~2010), wstunnel, and subtls's own demo (in-browser HTTPS and Postgres over a WS proxy).

## 4. Verified facts (probed live 2026-07-17, from the dev machine)

| Fact | Result | Why it matters |
|---|---|---|
| `ca-pleas-psv.edupoint.com:443` negotiates **TLS 1.3** | ✅ (also 1.2) | subtls is TLS 1.3-only — viable here |
| Certificate is `*.edupoint.com` (wildcard) | ✅ | one cert/root story covers **every district** |
| Chain root: **Go Daddy Root Certificate Authority - G2** | ✅ | the only root CA the browser TLS client must bundle |
| **No ALPN** negotiated | ✅ | server speaks plain **HTTP/1.1** — no HTTP/2 needed in the shim |
| Portal accepts non-browser TLS fingerprints | ✅ (weeks of Node scraping) | no JA3/WAF blocking expected for subtls |

Re-probe TLS for any new district with:

```bash
node -e "const tls=require('tls');const h=process.argv[1];const s=tls.connect({host:h,port:443,servername:h,minVersion:'TLSv1.3'},()=>{console.log('OK',s.getProtocol());s.end()});s.on('error',e=>console.log('FAIL',e.message))" some-district-psv.edupoint.com
```

## 5. Component spec

### 5.1 Relay server (the only thing our server runs)

A WebSocket endpoint that bridges to TCP. Node + `ws` + `node:net`, ~100 lines.

Protocol (keep it dumb):

1. Client connects to `wss://relay.<our-domain>/tunnel`.
2. First message (text, JSON): `{ "host": "ca-pleas-psv.edupoint.com" }`. Port is
   always 443 — not client-controllable.
3. Relay validates `host` against `/^[a-z0-9-]+\.edupoint\.com$/i`, opens
   `net.connect(443, host)`, replies `{ "ok": true }`.
4. Thereafter every **binary** frame is piped verbatim in both directions
   (`binaryType = 'arraybuffer'` client-side).
5. Either side closing/erroring closes both. No reconnect logic in the relay —
   the client opens a fresh tunnel per TLS session.

Mandatory hardening (this is an open relay if you skip it):

- **Host allowlist** (`*.edupoint.com` only, port 443 only) — the real security control.
- **`Origin` check** — only our GitHub Pages origin. Forgeable by non-browser clients,
  so it's an abuse filter, not security; the allowlist is what matters.
- Per-IP connection cap, connection rate limit, idle timeout (~2 min), max lifetime
  (~10 min), and backpressure (pause the TCP socket while `ws.bufferedAmount` is high,
  and vice versa).
- **Log metadata only** (timestamp, client IP, host, bytes). There is nothing else *to*
  log — that's the point — and the README will say so.

Deployment on the home server:

- Must be `wss://` (the Pages site is HTTPS; mixed content blocks `ws://`). Use Caddy
  (auto Let's Encrypt) in front, on **port 443** — also helps traverse school filters.
- Dynamic DNS (e.g. DuckDNS) for the home IP. If the ISP uses **CGNAT** (no inbound
  connections), use Cloudflare Tunnel — privacy-neutral here, since it only ever
  relays the same ciphertext the relay does.
- Note: Edupoint sees the **relay's IP** for all users' traffic (same as the current
  backend — unchanged).

### 5.2 TLS client in the browser

- **Primary: [subtls](https://github.com/jawj/subtls)** — pure-TypeScript TLS 1.3
  client, built exactly for this pattern. Does real certificate verification against
  caller-supplied trusted roots. **Bundle the Go Daddy Root CA G2 certificate** (§4);
  nothing else is needed for `*.edupoint.com`.
- **It is experimental** (one maintainer, not OpenSSL). Acceptable for a PoC; decide
  after the PoC whether to keep it or move to the fallback.
- **Fallback: rustls compiled to WASM** — mature TLS, heavier build. Only pursue if
  subtls fails the PoC.
- One TLS session per tunnel; use `Connection: close` and open a new tunnel per request
  at first (a handful of page loads — fine). TLS 1.3 session resumption / keep-alive is
  a later optimization, not a correctness need.

### 5.3 The fetch-shim (the real new work)

A function with the same signature as `fetch` that the existing portal code can accept
via its injectable `fetchImpl`, implemented as: open tunnel → TLS handshake → write an
HTTP/1.1 request → parse the response → return a `Response`-like object.

Must handle:

- Request formatting: request line, `Host`, `Cookie`, `Content-Type`,
  `Content-Length`, browser-ish `User-Agent` (copy what `portal/http.ts` sends today),
  and **`Accept-Encoding: identity`** to discourage compression.
- Response parsing: status line, headers (**including every `Set-Cookie`**, the whole
  reason we're here), body by `Content-Length` **and** `Transfer-Encoding: chunked`
  (must implement chunked decoding).
- If the server compresses anyway (`Content-Encoding: gzip/deflate`): decompress with
  the browser-native `DecompressionStream`.
- **No automatic redirect following** — return 3xx to the caller. This matches the
  existing design: `fetchFollow` in `portal/http.ts` already follows redirects
  manually and absorbs `Set-Cookie` per hop. Reuse it unchanged.
- HTTP/1.1 only (verified: no ALPN/HTTP-2, §4).

### 5.4 What ports, what retires (existing code disposition)

The backend (copies at `full/` and `local/` in this folder; `src/` therein) was built
with an injectable `fetch` throughout — that decision is what makes this port cheap.

| Module | Fate |
|---|---|
| `src/portal/http.ts` (CookieJar, fetchFollow) | **Moves to browser unchanged** — inject the fetch-shim |
| `src/portal/login.ts`, `session-alive check` | **Moves to browser unchanged** |
| `src/portal/pages/*` (studentInfo, documents, attendance, gradebook) | **Moves to browser unchanged** |
| `src/extract/*`, `src/domain/*` (Zod schemas), `src/calc/*` | **Move as-is** — already pure TS, zero Node deps |
| `src/portal/session.ts` `SessionStore` | **Retires** (server-side sessions no longer exist). Browser keeps a simple in-memory jar + creds in localStorage; re-login on `SessionExpiredError` client-side |
| `src/api/*` (Hono app, auth, bearer tokens, rate limit, error envelope) | **Retires** — there is no API anymore |
| `src/mock/portal.ts` | **Keep for tests** — the ported client still runs under Vitest in Node with `mockPortalFetch` injected, exactly as today |
| `tools/*`, `test/fixtures/portal/*` | Keep — unchanged |

Login-attempt rate limiting moves from the API layer to the relay's connection limits
(the relay can't see logins — they're ciphertext).

### 5.5 Credentials client-side

`{domain, username, password}` in localStorage, exactly as the original GradeCompass
did (accepted trade-off; it's the user's own device). Cookie jar in memory (tab
session). On portal-session expiry (~20 min idle), silently re-login client-side —
the same `withSession` retry-once idea, now in the browser, where holding the
credentials is fine.

## 6. Deployment & config

- Frontend: GitHub Pages from the public repo (already the plan — `github/` here).
  The relay URL is **build-time config** (like the existing `VITE_API_BASE`), e.g.
  `VITE_RELAY_URL=wss://relay.example.org/tunnel`.
- The README trust section this enables (write it only once it's true):
  1. Your password is encrypted *in your browser* and can be decrypted only by
     StudentVUE. Our server relays bytes it cannot read.
  2. Your grades and session never touch our server either.
  3. The code that handles your password is this public repo, served by GitHub Pages —
     changing it requires a public commit.
  4. What our server can see: your IP, when you use the app, which district, and how
     much data — nothing else.
- Still recommend in the login UI: use a StudentVUE password that differs from the
  school Google password (defense in depth; some districts sync them).

## 7. Risks, honestly

| Risk | Odds | Mitigation |
|---|---|---|
| subtls hits an edge (cert path, record layer) against Edupoint | medium | that's what the PoC is for; fallback rustls-WASM |
| Fetch-shim HTTP parsing bugs (chunked, etc.) | medium | it's parsing, we're good at parsing; test against fixtures + mock portal |
| School network blocks WebSocket to unknown domain | low-med | wss on port 443 looks like normal TLS; Cloudflare Tunnel as alternative ingress |
| Portal WAF blocks unusual TLS fingerprint | low | weeks of Node-fetch scraping never triggered anything (§4) |
| District on TLS ≤1.2 only (other districts) | low for ours (1.3 ✅) | probe per district (§4); rustls-WASM fallback covers 1.2 |
| Relay abused as open proxy | — | it never is one: hard allowlist `*.edupoint.com:443` from day one |
| Home server compromise | — | attacker gets a ciphertext pipe + metadata. **This is the whole point.** |

Not a risk but a fact: this obsoletes Parts 9's API surface and Part 2's server-side
sessions. Parts 1, 3–8 (http core, extract, domain, pages, mock, calc) carry over
nearly untouched. The gradebook parser (Part 7b) stays blocked on a live capture —
orthogonal to this idea; see `local/note.md`.

## 8. What the original server conclusion got right (so nobody relitigates it)

"The browser can't call the portal, therefore a server must" — still true. Browsers
have no raw-TCP API (Direct Sockets is restricted to Isolated Web Apps; useless here).
The relay **is** that server; it provides exactly the one capability browsers lack
(TCP reachability) and nothing else. The insight is not "we don't need a server," it's
"the server doesn't need to be trusted with plaintext."

## 9. Proof-of-concept (build this first; a day, not a month)

Success = the following works from a static page served locally, with the relay on
localhost (plain `ws://` is fine for local PoC):

1. Relay: WS→TCP pipe with the host allowlist (skip Caddy/certs for now).
2. Page: subtls handshake to the district portal through the tunnel; verify the
   `*.edupoint.com` cert against the bundled Go Daddy G2 root.
3. Fetch-shim: `GET /PXP2_Login_Student.aspx` → 200, correct HTML, `Set-Cookie`
   captured (compare against what `tools/pull-real-data.ts` sees today).
4. Drive the **existing** `login.ts` + `studentInfo` page client through the shim in
   the browser; log in with real test credentials; render the student name.
5. Confirm in the relay's logs that only opaque frames transited (no plaintext), e.g.
   by grepping a traffic dump for the known test password — it must not appear.

If step 2–3 fail on subtls internals after a honest day of debugging, stop and
reassess with rustls-WASM before writing more code. If the PoC passes, the remainder
is porting existing, tested modules — schedule it as the post-Part-12 architecture, or
as the v2 milestone.

## 10. Open questions

- Keep the current backend as a fallback mode during migration (config switch), or
  cut over entirely? (Leaning: keep it until the relay has run a full term.)
- Multi-district support: probe-and-cache TLS capability per district, or 1.3-only at
  launch with a clear error?
- localStorage vs sessionStorage for credentials (GradeCompass used localStorage;
  sessionStorage is safer on shared Chromebooks but logs the user out per tab).
  Consider an opt-in "remember me".

## 11. PoC results (2026-07-17) — hypothesis CONFIRMED

Built in `poc/` (see `poc/README.md`). Ran live against `ca-pleas-psv.edupoint.com`.

**Test 1 — full login over the blind relay (`poc/run-poc.mjs`).** A complete PXP2
WebForms login plus an authenticated `PXP2_Student.aspx` fetch, driven through the
relay with TLS terminating in the client:
- authenticated: YES (landed on `/Home_PXP2.aspx`); TLS 1.3; cert validated (CN=
  `*.edupoint.com`); session cookies `ASP.NET_SessionId` + `EESPSV` captured; student
  page HTTP 200, 63 KB, student name read.
- 4 tunnels opened (GET login → POST creds → redirect → GET student).
- **Privacy:** the password and username were scanned for in the ~173 KB of bytes that
  crossed the relay — **absent**. All ciphertext.

**Test 2 — the real browser TLS client (`poc/subtls-test.mjs`).** subtls (pure-JS TLS
1.3 over SubtleCrypto — the exact library §5.2 proposes) driven over the same relay via
Node's browser-style global `WebSocket`, trusting **only** the bundled Go Daddy Root G2:
- handshake OK; server cert CN `*.edupoint.com`; login page HTTP 200, ~20 KB;
  `Set-Cookie` captured; WebForms `__VIEWSTATE` form present.
- **Privacy:** the HTTP request payload was absent from the relayed bytes.

**Test 3 — relay allowlist.** Rejects `evil.com`, `edupoint.com.evil.com`,
`internal.local`, `notedupoint.com`; allows the real district. Not an open proxy / SSRF.

**Implication for §7 risks:** the top two — "subtls hits an edge against Edupoint" and
"fetch-shim HTTP parsing" — are **retired**; both worked live. Two subtls gotchas were
found and are Node-test artifacts, not browser problems (documented in `poc/README.md`):
subtls's `networkRead` must honor PEEK mode (the browser's `WebSocketReadQueue` already
does), and Node/undici's `WebSocket` buffer pooling + view-send needs copies (a real
browser doesn't). What remains is the port (move `src/portal|extract|domain|calc` into
the browser behind the subtls fetch-shim) and relay hardening (`wss://`, Origin, limits)
— §5, engineering only.

**Domain-regex refinement noted:** the allowlist requires a single label before
`.edupoint.com` (`<district>.edupoint.com`). Real districts fit this; if any use a deeper
subdomain, widen the regex deliberately (still anchored to `.edupoint.com$`).
