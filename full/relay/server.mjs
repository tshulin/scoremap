// VPS entrypoint. Reads config from the environment and starts the blind relay.
//
//   PORT               listen port (default 8080; put Caddy/TLS in front for wss)
//   ALLOWED_ORIGINS    comma-separated exact origins (e.g. https://tshulin.github.io)
//                      REQUIRED in production; if unset the relay allows any origin
//                      and logs a loud warning (dev only).
//   ALLOWED_HOST_RE    override the portal host allowlist (default *.edupoint.com)
//   TRUST_FORWARDED_FOR  "true" when behind a trusted reverse proxy (Caddy)
//   RATE_PER_MIN, MAX_CONCURRENT, IDLE_MS, MAX_LIFETIME_MS  limits (have defaults)

import { startRelay, ConnectionLimiter, DEFAULT_HOST_RE } from './relay.mjs';

const num = (v, d) => (v == null || v === '' ? d : Number(v));

const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
	: null;

if (allowedOrigins == null) {
	console.warn(
		'[relay] WARNING: ALLOWED_ORIGINS is unset — accepting ANY Origin. Set it in production.'
	);
}

const relay = startRelay({
	port: num(process.env.PORT, 8080),
	allowedOrigins,
	allowedHostRe: process.env.ALLOWED_HOST_RE
		? new RegExp(process.env.ALLOWED_HOST_RE, 'i')
		: DEFAULT_HOST_RE,
	trustForwardedFor: process.env.TRUST_FORWARDED_FOR === 'true',
	limiter: new ConnectionLimiter({
		maxPerWindow: num(process.env.RATE_PER_MIN, 30),
		maxConcurrent: num(process.env.MAX_CONCURRENT, 8)
	}),
	idleMs: num(process.env.IDLE_MS, 120_000),
	maxLifetimeMs: num(process.env.MAX_LIFETIME_MS, 600_000),
	log: (m) => console.log(`[relay] ${m}`)
});

console.log(`[relay] listening on :${relay.port} (allowlist: *.edupoint.com:443)`);

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		await relay.close();
		process.exit(0);
	});
}
