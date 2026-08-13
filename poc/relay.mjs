// The blind relay — the ONLY thing the home server runs in the real design.
// A WebSocket <-> TCP bridge that pipes opaque bytes between a browser and
// <district>.edupoint.com:443. It never terminates TLS, so it only ever sees
// ciphertext. This PoC build adds an optional capture dump so we can PROVE the
// bytes crossing it are ciphertext (grep the dump for the password -> absent).

import { WebSocketServer } from 'ws';
import net from 'node:net';
import fs from 'node:fs';

const HOST_ALLOWLIST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.edupoint\.com$/i;
const PORTAL_PORT = 443;
const IDLE_MS = 120_000;

export function startRelay({ port = 8787, dumpPath = null, log = () => {} } = {}) {
	const dump = dumpPath ? fs.createWriteStream(dumpPath) : null;
	let totalBytes = 0;

	const wss = new WebSocketServer({ port });

	wss.on('connection', (ws, req) => {
		// In production this is where we'd also check req.headers.origin against
		// our GitHub Pages origin. Omitted in the PoC (localhost only).
		let upstream = null;
		let opened = false;
		const idle = () => setTimeout(() => ws.close(1000, 'idle'), IDLE_MS);
		let idleTimer = idle();
		const bump = () => {
			clearTimeout(idleTimer);
			idleTimer = idle();
		};

		ws.on('message', (data, isBinary) => {
			bump();
			if (!opened) {
				// First frame is the JSON control message: { host }.
				let host;
				try {
					host = JSON.parse(data.toString()).host;
				} catch {
					ws.close(1008, 'bad control message');
					return;
				}
				if (typeof host !== 'string' || !HOST_ALLOWLIST.test(host)) {
					log(`REJECT host=${JSON.stringify(host)} (not *.edupoint.com)`);
					ws.close(1008, 'host not allowed');
					return;
				}
				opened = true;
				log(`OPEN  -> ${host}:${PORTAL_PORT}`);
				upstream = net.connect(PORTAL_PORT, host, () => {
					ws.send(JSON.stringify({ ok: true }));
				});
				upstream.on('data', (chunk) => {
					totalBytes += chunk.length;
					if (dump) dump.write(chunk);
					if (ws.readyState === ws.OPEN) ws.send(chunk); // ciphertext -> browser
				});
				upstream.on('close', () => ws.close(1000, 'upstream closed'));
				upstream.on('error', (e) => {
					log(`UPSTREAM ERR ${e.message}`);
					ws.close(1011, 'upstream error');
				});
				return;
			}
			// Subsequent binary frames are ciphertext from the browser's TLS client.
			if (!isBinary || !upstream) return;
			totalBytes += data.length;
			if (dump) dump.write(data);
			upstream.write(data); // ciphertext -> portal
		});

		ws.on('close', () => {
			clearTimeout(idleTimer);
			if (upstream) upstream.destroy();
		});
		ws.on('error', () => {
			if (upstream) upstream.destroy();
		});
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
