# grademax relay

The blind byte relay — the only server-side component. It bridges a browser
WebSocket to `<district>.edupoint.com:443` and pipes ciphertext both ways. It
never terminates TLS, so it cannot read passwords, cookies, or grades: the
browser runs the TLS client (subtls) and speaks HTTP itself. See `../../idea.md`
and `../../poc/` for the proof.

## Run (dev)

```bash
npm install
node server.mjs            # listens on :8080, accepts any Origin (dev)
```

## Run (production)

Put a TLS terminator (Caddy / Let's Encrypt) in front so the browser can reach it
over `wss://`, and pin the Origin:

```bash
ALLOWED_ORIGINS=https://<you>.github.io \
TRUST_FORWARDED_FOR=true \
PORT=8080 \
node server.mjs
```

Then a Caddyfile like:

```
relay.example.org {
    reverse_proxy 127.0.0.1:8080
}
```

If your home IP is behind CGNAT, use a Cloudflare Tunnel instead of port
forwarding — it only ever carries the same ciphertext.

## Config (env)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | 8080 | listen port (behind the TLS proxy) |
| `ALLOWED_ORIGINS` | *(any, with warning)* | comma-separated exact origins; **set in prod** |
| `ALLOWED_HOST_RE` | `*.edupoint.com` | portal host allowlist |
| `TRUST_FORWARDED_FOR` | false | read `X-Forwarded-For` (only behind a trusted proxy) |
| `RATE_PER_MIN` | 30 | new connections per IP per minute |
| `MAX_CONCURRENT` | 8 | concurrent tunnels per IP |
| `IDLE_MS` / `MAX_LIFETIME_MS` | 120000 / 600000 | per-tunnel timeouts |

## Test

```bash
npm test                                  # offline: guards + local piping
SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com \
  node verify-live.mjs                     # live: pipes real TLS, proves blindness
```

## Security properties

- **Host allowlist** — connects only to `<label>.edupoint.com:443`; rejects
  `edupoint.com.evil.com`, `notedupoint.com`, intranet hosts, etc.
- **Origin pinning** — rejects WebSocket connections from other sites.
- **Rate + concurrency limits** — not usable as a general open proxy.
- **Blind** — only ciphertext transits; verified by `verify-live.mjs`.
