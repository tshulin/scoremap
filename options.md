# Scaling & IP Options

> **Written 2026-07-27**, out of the investigation into the mail crash. Covers why
> the crash happened, what was fixed, and what the ceilings are as more students
> use the app.
>
> Every number below is labelled **measured**, **estimated**, or **unknown**.
> The unknowns are unknown on purpose — nobody outside Edupoint knows their
> thresholds, and a confident number would be a fabricated one.

---

## 1. What was wrong, and what shipped

**Symptoms:** `Mail could not be loaded: Request to …/GetMessages?PORTAL=3 failed`,
and after it, the student's name vanished from the sidebar.

**Root cause — the relay, not StudentVUE.** The relay caps each client IP, and
`fetchShim.js` opened a fresh WebSocket + TLS handshake for *every* HTTP request.

| | Measured |
|---|---|
| Relay concurrent cap, per IP | **8** (`1013 "too many connections"` on the 9th) |
| Relay rate cap, per IP | **30/min** (`1013 "rate limit"` on the 31st) |
| Requests in one sign-in + sync | **18** |
| Connections that used to cost | **18** — over the concurrency cap, most of the minute's budget |
| Mail's share of those requests | **9** (1 list + 8 body prefetches, 4 concurrent) |

Both caps are the defaults in `local/relay/server.mjs`; `local/deploy/install.sh`
never overrides them.

**Fixed in `0faaad2` (deployed, verified live 8/8 on the real account):**

- `fetchShim.js` now pools and reuses connections (HTTP keep-alive). Bodies are
  framed by `Content-Length`/chunked instead of read-to-EOF, since a shared
  connection must be left positioned at the next response. A pooled connection the
  portal has already dropped is retried once — but only when nothing came back, so
  a processed request is never replayed.
- The pool doubles as the app's **global** concurrency ceiling, so fan-out can no
  longer trip the relay cap.
- The transport now honours `AbortSignal`. `portal/http.ts` had always passed a 15s
  per-hop timeout that the relay fetch silently ignored — stalled connections hung
  forever.
- A sync that loses only its student-info request no longer blanks the name. The
  student is remembered alongside the session (a reload has no caller to pass it
  back in).

| After | Measured |
|---|---|
| Connections per sign-in + sync | **4** (login 1, sync 3) |
| Requests carried over them | 18 |
| Peak in-flight requests | 8, over 4 sockets |
| Wall clock | **5.1s** |
| Bytes moved | **~0.6 MB** |

---

## 2. The constraint chain

Each problem is what you hit *after* solving the one above it.

1. **~~One connection per request~~** — fixed above.
2. **The relay's caps are per IP, and a school shares one IP.** 8 concurrent for
   *everyone* behind that NAT. Mobile carriers (CGNAT) do the same off-campus.
3. **Raising the caps is necessary but bounded.** There is no setting that is
   generous to a school and strict to a script, because per-IP cannot tell them
   apart.
4. **All student traffic reaches the portal from one IP — yours.** Hundreds of
   logins from a single datacenter IP is the shape of credential stuffing. A block
   there kills the app for everyone, and no code change fixes it.
5. **Changing hosting doesn't escape category-based blocking** (see §6).

### A side effect of the fix, worth knowing

Pooled connections now stay open until the relay's idle timeout (**120s**), so each
student parks up to 4 of the shared 8 slots for ~2 minutes after they stop clicking.

**Estimated:** ~3 students on the same WiFi within 2 minutes would start seeing the
original error. The old code released instantly but burned 18 connections/minute
per student — this is the trade that was made. Fixable by closing idle connections
after ~15s (see §3, Lever 1).

---

## 3. Options for more students on one IP

### Lever 1 — make each student cost less *(app side, deploys via Pages)*

**Done.** Requests cut in `41d3a0b`, slots freed in `53c78a8`.

#### Fewer requests per student *(`41d3a0b`)*

| Change | Effect |
|---|---|
| Mail no longer prefetches 8 message bodies for list previews | −8 requests per sync |
| Refresh syncs only the resource the page shows | A refresh is 1 request, not ~14 |
| Student info fetched only when nobody knows the name | −1 request per sync (login already had it) |
| Dropped the student portrait download | −1 request per sync; no screen rendered it |

Requests per sync went **~14 → 5**, and a Refresh click **~14 → 1**.
Measured against the real portal through the relay, per sign-in session
(bytes over the relay socket, which is ciphertext but tracks portal traffic):

| | Before | After |
|---|---|---|
| Full sync | 682 KB | 537 KB |
| Mail refresh | 492 KB | 89 KB |
| Grades refresh | 492 KB | 64 KB |

Refresh was the big one: it used to re-fetch everything from every page.

#### Fewer *slots held* per student *(`53c78a8`)*

This is the half that decides how many students fit under the **8 concurrent**
cap. Requests-per-sync never touched it: what occupies a slot is an open
connection, not a busy one.

| Change | Effect |
|---|---|
| Idle pooled connections closed on a 15s timer | Was held until the relay's 120s idle timeout |
| Pool 4 → 2 connections | One tab can hold at most 2 of the school's 8 slots |
| Snapshot mirrored to sessionStorage, restored on reload | A reload costs nothing |

`IDLE_CLOSE_MS` previously only got consulted when someone *asked* for a
connection — so a student who stopped clicking kept sockets open with nothing
to trigger the check. It is now an actual timer.

Measured against the real portal:

| | Before | After |
|---|---|---|
| Relay sockets held during a sync | up to 4 | 2 |
| Sockets open 15s after the student stops | up to 4, for ~2 min | **0** |
| A page reload | full sync | **0 sockets, 0 bytes** |

Net for one student: from *4 slots for 2 minutes* to *2 slots for ~15 seconds*
— roughly **16× more students per IP** at the same relay limits, on top of the
request cut above.

Still not sufficient alone: 8 concurrent ÷ 2 = **4 students syncing at the same
instant**. That is the ceiling Lever 2 has to raise.

### Lever 2 — raise the relay caps *(VPS, needs redeploy)*

Necessary. IP is the wrong unit of identity when 500 people share one address.

What makes it safe is that the guards doing the real work aren't IP-based:

- **Host allowlist** — anchored regex, can only reach `*.edupoint.com:443`. Cannot
  be a general proxy, ever. This is solid.
- **Origin pin** — ⚠️ **weaker than it looks.** It stops other *websites*, not
  scripts: any non-browser client sets `Origin` freely. (Demonstrated — the probe
  used to measure the caps was a Node script that set it and was accepted.)

So against a script, the host allowlist and the rate limits are the whole defence.
And because the relay is **blind by design** (it only sees ciphertext), it can
*never* distinguish a login POST from a page load — a blunt connection limit is the
only tool it has. That is permanent, not a gap to close.

**The risk isn't theft — it's reputation.** There's nothing to steal via a relay
that only reaches StudentVUE. But someone could cheaply get the VPS IP blocked by
hammering logins through it.

**Done — deployed to the VPS 2026-07-28 and verified live** (12 concurrent sockets
from one IP all accepted; the old build denied at 9). The values are now the
built-in defaults in `local/relay/server.mjs`, not
hand-edits to `/etc/grademax-relay.env`, because `deploy/install.sh` **rewrites
that file on every run** and would silently revert them. All four stay
env-overridable.

| | Was | Now |
|---|---|---|
| `RATE_PER_MIN` (per IP) | 30 | 600 |
| `MAX_CONCURRENT` (per IP) | 8 | 64 |
| `MAX_TOTAL_CONCURRENT` (relay-wide) | *did not exist* | 250 |
| `IDLE_MS` | 120000 | 30000 |

The global cap is the one that actually protects the VPS, and it is what makes the
generous per-IP numbers safe. Per-IP stays finite so one client still cannot
consume the whole relay. Order of checks is per-IP first, global last — otherwise
one abusive client's log lines read as "the relay is busy".

Measured against a locally-running relay (probe sockets complete the WebSocket
upgrade and then send nothing, so no upstream connection to Edupoint is ever
opened):

- 64 accepted from one IP, 65th denied `too many connections`
- 40 sequential connects accepted with no denial (old cap denied at 31)
- exactly 250 held across distinct IPs, then `relay at capacity`

`IDLE_MS=30000` is now redundant in practice: the app closes its own pooled
connections at 15s (Lever 1), so the relay's timeout no longer fires first. It
stays as the backstop for a client that is not our app.

### The limiter bug — fixed

`ConnectionLimiter.tryAcquire` recorded a timestamp for **every attempt**, so a
client retrying in a loop kept pushing its own window forward and could never fall
back under the limit. It now records only **accepted** connections. Two regression
tests cover it (a rate-denied loop, and a concurrency-denied one).

Also fixed while there: `release()` no longer decrements below zero on a stray
double-release, which with the new global counter would have manufactured
capacity out of nothing.

### Deploying Lever 2 — done, and how to repeat it

SSH key auth to the VPS is refused from the dev machine
(`root@187.77.26.253: Permission denied (publickey,password)`), so this is run by
hand with a password. Only two files change; `install.sh` does **not** need
re-running.

```
scp C:\Users\Tiger\Documents\Projects\grademax\local\relay\relay.mjs \
    C:\Users\Tiger\Documents\Projects\grademax\local\relay\server.mjs \
    root@187.77.26.253:/root/grademax/relay/

ssh root@187.77.26.253 "systemctl restart grademax-relay && systemctl is-active grademax-relay && journalctl -u grademax-relay -n 3 --no-pager"
```

The startup banner is the confirmation the new code is live — it now prints the
limits it is running with:

```
[relay] listening on :8080 (allowlist: *.edupoint.com:443) limits: 600/min, 64 per IP, 250 total
```

**If the VPS is small**, lower `MAX_TOTAL_CONCURRENT`: a connection may buffer up
to 1 MB toward a slow browser before the relay pauses the portal side, so 250 is a
~250 MB worst case. Add `MAX_TOTAL_CONCURRENT=<n>` to `/etc/grademax-relay.env`
— but note that `install.sh` will erase it, so change the default in
`server.mjs` if it needs to stick.

### Lever 3 — per-browser tickets *(defer)*

Relay issues short-lived tickets from a small endpoint and limits per ticket
instead of per IP. Real per-student fairness. Doesn't stop a determined attacker
(anyone can get a ticket), so an IP backstop stays. Only worth it once a
misbehaving client is actually hurting others.

### Known relay bug — fixed

`ConnectionLimiter.tryAcquire` recorded each attempt's timestamp **before**
deciding, so rejected connections extended their own window and under a retry loop
the limit never cleared. Now counts only accepted connections. See Lever 2 above;
still needs the VPS redeploy to take effect.

---

## 4. Options for the single-IP problem

### A — Browser extension *(the structural fix)*

The entire relay architecture — VPS, WebSocket bridge, `subtls` doing TLS by hand —
exists for one reason: browsers won't allow raw cross-origin requests to
`edupoint.com`. An extension with `host_permissions: ["https://*.edupoint.com/*"]`
just calls `fetch()`.

- Traffic comes from **the student's own IP** — indistinguishable from them using
  StudentVUE, because that's what it is
- No relay, no VPS, no per-IP limits, no IP concentration
- Browser handles TLS and cookies natively → `subtls` and `fetchShim` go away

Every problem in this document is downstream of "a server is in the middle," so
they all resolve at once.

**Cost:** installation friction, Chrome Web Store review, no iOS.

**Likely the real answer: hybrid.** Keep the web app; offer the extension as an
optional fast path that skips the relay when installed. Heavy users self-serve and
stop costing anything.

### B — Don't look like an attack *(cheap, do now)*

Credential stuffing is detected mostly on **failed** login rate — many usernames,
high failure %, fast. This app is many usernames with a *near-zero* failure rate,
because students know their own passwords. That difference is the main thing
separating it from an attack.

- **Never auto-retry a failed login.** A student mistyping is normal; code retrying
  in a loop is the fastest way to manufacture an attack signature.
- Cache aggressively; don't resync on every reload.

### C — Move the relay off the VPS

See §5.

### D — Ask the district *(only durable answer)*

An allowlisted IP or sanctioned integration ends the guessing. Costs a conversation.

### On rotating/residential proxies — not recommended

Mechanically they'd work, and notably credentials stay safe (TLS terminates in the
browser, so any proxy sees only ciphertext).

Avoided for a practical reason: there's a real difference between *avoiding* a
block by keeping traffic reasonable and *routing around* one after the district has
issued it. The second turns a technical problem into a standoff that can't be won —
they control the portal. Also real money and added latency.

---

## 5. Hosting comparison

### Fly.io — lower effort, do first

Runs `relay.mjs` **unchanged** (normal Node process). Deploy to 3–4 regions → an IP
per region, plus lower latency and redundancy. The per-process limiter keeps
working as written. An afternoon's work.

Egress is a shared NAT per host, so IPs are shared with other Fly customers —
traffic blends in, but their reputation is inherited, and Fly is popular with
scrapers.

### Cloudflare Workers — better destination, more work

Raw TCP via `import { connect } from 'cloudflare:sockets'`, plus `WebSocketPair` for
the browser side. ~100 lines; host allowlist and Origin check port over unchanged.

**Gains:** egress from Cloudflare's huge shared ranges, no single point of failure,
no server to patch.

**Costs:**
- **Rate limiting must be rebuilt** — Workers are stateless, so the in-process
  `Map` limiter doesn't work. Use WAF rate-limiting rules or the Rate Limiting
  binding.
- **Long-lived connections may want Durable Objects.** Current connections last
  seconds, so a plain Worker is probably fine — but pooling keeps them idle longer.
- **Workers egress is a known proxy vector** (free tier + raw sockets), so some
  services block it specifically. **Unknown** whether Edupoint does.

### Pricing *(as of 2026-07; Cloudflare changes it — verify)*

Free: 100k requests/day, 10ms CPU per invocation. Paid: $5/mo, 10M requests, 30M
CPU-ms, 30s CPU per invocation.

**The key detail: one WebSocket = one Worker request**, not one HTTP request. The
18 HTTP requests inside a tunnel are free. So a session = **4 Worker requests**.

| Scale | Sessions/day | Worker requests/day | Plan |
|---|---|---|---|
| Testing | ~20 | 80 | Free |
| 50 students | 150 | 600 | Free |
| 500 students | 2,000 | 8,000 | Free |
| 5,000 students | 25,000 | 100,000 | Free, at the ceiling |

**Most likely outcome: $0/month**, and the VPS can be dropped — cheaper than today.
The connection pooling made this ~4.5× cheaper as a side effect (was 18
connections/session, now 4).

Real risks, both **estimated**:
- The free tier's **10ms CPU per invocation** is the actual unknown, not request
  count. Piping is mostly I/O (excluded from CPU billing), so it should fit — but
  test it. If not, the $5 plan raises it to 30s.
- If Durable Objects turn out to be needed, they bill **wall-clock duration**.
  Ironically the pooling that saves requests would then cost money on idle
  connections. ~$20–30/mo at 500 students with 60s holds; under $10 with 15s holds.

---

## 6. What actually triggers a block

**Unknown:** Edupoint's real thresholds. Not published, and districts add their own
WAFs (Cloudflare, F5, Imperva). Anyone quoting a precise number is guessing.

**Measured:** one sync = 18 requests, of which 2 are login (GET form + POST creds).

```
daily requests = students × syncs/day × 18
peak req/sec   = students in window × 18 ÷ window seconds
```

Worst realistic case — 100 students during a 10-minute lunch:

```
100 × 18 = 1,800 requests ÷ 600s ≈ 3 requests/second ≈ 10 logins/minute
```

**Three requests per second.** Even a 1,000-student school peaks around 30 req/s in
bursts. **Volume is not the risk.**

What matters, in order:

| Signal | Danger |
|---|---|
| **Failed** logins/min from one IP | **Highest** — what stuffing detection is built on |
| Many distinct usernames + high failure % | Highest — the classic signature |
| Sustained rate from a datacenter IP | Moderate — datacenter IPs start with less trust |
| Raw volume with low failures | Low |

Rough tiers from a datacenter IP with a low failure rate (**estimated**):

- **< 1 req/s, < 10 logins/min** — unremarkable. Covers most realistic use.
- **1–5 req/s, 10–60 logins/min** — a school at peak. Probably fine; a WAF *could*
  start caring.
- **> 10 req/s or > 100 logins/min sustained** — looks automated regardless.
- **Any sustained burst of failed logins** — the one that gets you blocked fast, at
  almost any volume.

### The fingerprint

`fetchShim.js` sends one hardcoded User-Agent for every request from every student.
From the portal's side: one IP, one browser fingerprint, hundreds of accounts,
identical request patterns. Noted so it's known — **not** something to disguise;
faking browser diversity turns a technical problem into a bad-faith one. The
legitimate fixes are less traffic (caching) and the extension, where the requests
come from real browsers on real IPs.

### The punchline on hosting

All of it — VPS, Fly, Cloudflare — is a **datacenter ASN**. Blocking datacenter
traffic is usually a **category/ASN rule**, a checkbox in most WAFs, not an
address-by-address investigation.

| | Volume-triggered block | ASN/category block |
|---|---|---|
| VPS | Vulnerable | **Blocked** |
| Fly.io | Better (more IPs) | **Blocked** |
| Cloudflare Workers | Better still | **Blocked** |
| Browser extension | N/A | **Fine** |

Changing clouds helps against *volume* blocks. It does **nothing** against
category-based blocking. And on shared infrastructure you can be blocked for
something a stranger did, with nothing in the codebase able to fix it.

**The VPS works today**, which is evidence the district isn't doing ASN-level
blocking right now. All of this is preventative.

---

## 7. Cheap experiment that replaces the guessing

The StudentVUE **login page is public** — no credentials needed.

1. Deploy a stub to Fly (and/or a Worker) that fetches
   `https://<district>-psv.edupoint.com/PXP2_Login_Student.aspx`
2. Check for a normal 200 with the `__VIEWSTATE` form vs. a challenge/block page

~20 minutes, and it answers for *this* district whether either platform is already
unwelcome. Turns §5's unknowns into facts.

---

## 8. Recommended sequence

| # | Do | Where | Why |
|---|---|---|---|
| ~~1a~~ | ~~Lever 1 — scoped refresh, drop mail prefetch, drop duplicate student fetch~~ | App | **Done — `41d3a0b`.** Requests per sync ~14 → 5; per refresh ~14 → 1 |
| ~~1b~~ | ~~Lever 1 — idle close, smaller pool, snapshot caching~~ | App | **Done — `53c78a8`.** Slots held: 4 for ~2 min → 2 for ~15s; reloads free |
| 2 | Never auto-retry failed logins | App | The single fastest way to look like an attack |
| 3 | Run the block test (§7) | Fly/Workers | Replaces speculation with data |
| ~~4~~ | ~~Lever 2 — raise caps + global cap + fix the limiter bug~~ | Relay | **Done — deployed 2026-07-28, verified live** (§3) |
| 5 | Talk to the district (Option D) | Policy | Costs nothing, only durable answer |
| 6 | Extension as an optional fast path (Option A) | App | The only thing that removes the ceiling |
| 7 | Fly or Workers | Hosting | A hedge, not a solution |

Lever 3 (tickets) only if a misbehaving client actually starts hurting others.

---

## 9. Open decisions

- **Does mail mark messages read?** Currently `markAsRead: false` always — reading
  in Grademax never touches the real inbox. Deliberate; reversible if normal
  mail-client behaviour is wanted.
- **How many students, realistically, and on what network?** Drives whether Lever 2
  is urgent or theoretical.
- **Is the extension acceptable to ask students to install?** Decides whether the
  ceiling is ever actually removed.
- **Approach the district or stay quiet?** Only sanctioned path, but it forces a
  yes/no answer that doesn't exist today.
