// VPS entrypoint. Reads config from the environment and starts the blind relay.
//
//   PORT               listen port (default 8080; put Caddy/TLS in front for wss)
//   ALLOWED_ORIGINS    comma-separated exact origins (e.g. https://tshulin.github.io)
//                      REQUIRED in production; if unset the relay allows any origin
//                      and logs a loud warning (dev only).
//   ALLOWED_HOST_RE    override the portal host allowlist (default *.edupoint.com)
//   TRUST_FORWARDED_FOR  "true" when behind a trusted reverse proxy (Caddy)
//   RATE_PER_MIN, MAX_CONCURRENT   per-IP limits (600/min, 64 concurrent)
//   MAX_TOTAL_CONCURRENT           relay-wide cap across all IPs (250)
//   IDLE_MS, MAX_LIFETIME_MS       connection lifetimes (30s idle, 10min max)
//
// The per-IP numbers are deliberately generous: a school NATs its students
// behind a single address, so a limit tight enough to deter abuse also locks out
// a classroom. MAX_TOTAL_CONCURRENT is the cap that protects the VPS. Lower it
// if the box is small — a connection may buffer up to 1 MB toward a slow browser
// before the relay pauses the portal side.

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
		maxPerWindow: num(process.env.RATE_PER_MIN, 600),
		maxConcurrent: num(process.env.MAX_CONCURRENT, 64),
		maxTotalConcurrent: num(process.env.MAX_TOTAL_CONCURRENT, 250)
	}),
	idleMs: num(process.env.IDLE_MS, 30_000),
	maxLifetimeMs: num(process.env.MAX_LIFETIME_MS, 600_000),
	log: (m) => console.log(`[relay] ${m}`)
});

console.log(
	`[relay] listening on :${relay.port} (allowlist: *.edupoint.com:443) ` +
		`limits: ${num(process.env.RATE_PER_MIN, 600)}/min, ` +
		`${num(process.env.MAX_CONCURRENT, 64)} per IP, ` +
		`${num(process.env.MAX_TOTAL_CONCURRENT, 250)} total`
);

for (const sig of ['SIGINT', 'SIGTERM']) {
	process.on(sig, async () => {
		await relay.close();
		process.exit(0);
	});
}
