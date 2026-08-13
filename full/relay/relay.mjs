// The blind relay — the ONLY thing that runs on the VPS.
//
// A WebSocket <-> TCP bridge that pipes opaque bytes between the browser and
// <district>.edupoint.com:443. It never terminates TLS, so it only ever sees
// ciphertext: the browser runs the TLS client (subtls) and speaks HTTP itself.
// See ../../idea.md and ../../poc/ for the proof this works end to end.
//
// Security model: this process must never be trickable into connecting anywhere
// but the portal (host allowlist) or usable as an open proxy by other sites
// (Origin check + rate/connection limits). Everything here is a guard toward that.

import { WebSocketServer } from 'ws';
import net from 'node:net';
import fs from 'node:fs';

const DEFAULT_PORTAL_PORT = 443;

// A single DNS label followed by .edupoint.com (e.g. ca-pleas-psv.edupoint.com).
// Anchored on both ends so `edupoint.com.evil.com` and `notedupoint.com` are rejected.
export const DEFAULT_HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.edupoint\.com$/i;

export function isHostAllowed(host, re = DEFAULT_HOST_RE) {
	return typeof host === 'string' && re.test(host);
}

// allowedOrigins: array of exact origins, or null to allow any (dev only).
export function isOriginAllowed(origin, allowedOrigins) {
	if (allowedOrigins == null) return true; // dev: no Origin pinning
	return typeof origin === 'string' && allowedOrigins.includes(origin);
}

// Sliding-window rate limiter + concurrent-connection cap, keyed by client IP.
export class ConnectionLimiter {
	#windowMs;
	#maxPerWindow;
	#maxConcurrent;
	#hits = new Map(); // ip -> number[] (recent connect timestamps)
	#active = new Map(); // ip -> count

	constructor({ windowMs = 60_000, maxPerWindow = 30, maxConcurrent = 8 } = {}) {
		this.#windowMs = windowMs;
		this.#maxPerWindow = maxPerWindow;
		this.#maxConcurrent = maxConcurrent;
	}

	// Returns null if allowed, or a short reason string if denied.
	tryAcquire(ip, now) {
		const times = (this.#hits.get(ip) ?? []).filter((t) => now - t < this.#windowMs);
		times.push(now);
		this.#hits.set(ip, times);
		if (times.length > this.#maxPerWindow) return 'rate limit';
		if ((this.#active.get(ip) ?? 0) >= this.#maxConcurrent) return 'too many connections';
		this.#active.set(ip, (this.#active.get(ip) ?? 0) + 1);
		return null;
	}

	release(ip) {
		const n = (this.#active.get(ip) ?? 1) - 1;
		if (n <= 0) this.#active.delete(ip);
		else this.#active.set(ip, n);
	}
}

const HIGH_WATER = 1 << 20; // 1 MB queued to the browser -> pause the portal socket
const LOW_WATER = 1 << 18; // 256 KB -> resume

export function startRelay({
	port = 8787,
	allowedOrigins = null,
	allowedHostRe = DEFAULT_HOST_RE,
	limiter = new ConnectionLimiter(),
	idleMs = 120_000,
	maxLifetimeMs = 600_000,
	trustForwardedFor = false,
	portalPort = DEFAULT_PORTAL_PORT, // TEST ONLY override; server.mjs never sets it
	dumpPath = null, // TEST ONLY: tee relayed bytes to a file for the blindness check
	log = () => {},
	now = () => Date.now()
} = {}) {
	const dump = dumpPath ? fs.createWriteStream(dumpPath) : null;
	let totalBytes = 0;

	const wss = new WebSocketServer({ port, maxPayload: 1 << 20 });

	wss.on('connection', (ws, req) => {
		const ip =
			(trustForwardedFor && (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim()) ||
			req.socket.remoteAddress ||
			'unknown';
		const origin = req.headers.origin;

		if (!isOriginAllowed(origin, allowedOrigins)) {
			log(`reject origin=${JSON.stringify(origin)} ip=${ip}`);
			ws.close(1008, 'origin not allowed');
			return;
		}
		const denied = limiter.tryAcquire(ip, now());
		if (denied) {
			log(`reject ${denied} ip=${ip}`);
			ws.close(1013, denied);
			return;
		}

		const startedAt = now();
		let released = false;
		let upstream = null;
		let opened = false;
		let up = 0;
		let down = 0;

		const idle = () => setTimeout(() => ws.close(1000, 'idle'), idleMs);
		let idleTimer = idle();
		const bump = () => {
			clearTimeout(idleTimer);
			idleTimer = idle();
		};
		const lifeTimer = setTimeout(() => ws.close(1000, 'max lifetime'), maxLifetimeMs);

		const cleanup = () => {
			clearTimeout(idleTimer);
			clearTimeout(lifeTimer);
			if (upstream) upstream.destroy();
			if (!released) {
				released = true;
				limiter.release(ip);
			}
		};

		ws.on('message', (data, isBinary) => {
			bump();
			if (!opened) {
				let host;
				try {
					host = JSON.parse(data.toString()).host;
				} catch {
					ws.close(1008, 'bad control message');
					return;
				}
				if (!isHostAllowed(host, allowedHostRe)) {
					log(`reject host=${JSON.stringify(host)} ip=${ip}`);
					ws.close(1008, 'host not allowed');
					return;
				}
				opened = true;
				log(`open ip=${ip} -> ${host}:${portalPort}`);
				upstream = net.connect(portalPort, host, () => ws.send(JSON.stringify({ ok: true })));

				upstream.on('data', (chunk) => {
					down += chunk.length;
					totalBytes += chunk.length;
					if (dump) dump.write(chunk);
					if (ws.readyState !== ws.OPEN) return;
					ws.send(chunk); // ciphertext -> browser
					// Backpressure: if the browser is slow, stop reading the portal.
					if (ws.bufferedAmount > HIGH_WATER) {
						upstream.pause();
						const resume = setInterval(() => {
							if (ws.readyState !== ws.OPEN) return clearInterval(resume);
							if (ws.bufferedAmount < LOW_WATER) {
								clearInterval(resume);
								upstream.resume();
							}
						}, 20);
					}
				});
				upstream.on('close', () => ws.close(1000, 'upstream closed'));
				upstream.on('error', (e) => {
					log(`upstream error ip=${ip}: ${e.message}`);
					ws.close(1011, 'upstream error');
				});
				return;
			}
			if (!isBinary || !upstream) return;
			up += data.length;
			totalBytes += data.length;
			if (dump) dump.write(data);
			upstream.write(data); // ciphertext -> portal
		});

		ws.on('close', () => {
			cleanup();
			log(`close ip=${ip} up=${up} down=${down} ms=${now() - startedAt}`);
		});
		ws.on('error', cleanup);
	});

	return {
		port,
		close: () =>
			new Promise((res) => {
				wss.close(() => (dump ? dump.end(res) : res()));
			}),
		bytes: () => totalBytes
	};
}
