// End-to-end check of the DEPLOYED relay: DNS -> Caddy TLS -> relay -> portal.
//
//   node check-wss.mjs wss://relay.example.org [districtHost] [origin]
//
// Proves three things, from anywhere with Node 22+:
//   1. a tunnel to the district opens and a real TLS handshake completes THROUGH it
//      (TLS terminates in this process — exactly what the browser will do),
//   2. the Origin pin rejects other sites,
//   3. the host allowlist rejects non-Edupoint targets.
// Resolves `ws` from the relay's node_modules (run `npm ci` in ../relay first).
import { createRequire } from 'node:module';
import tls from 'node:tls';
import { Duplex } from 'node:stream';

const require = createRequire(new URL('../relay/', import.meta.url));
const { WebSocket } = require('ws');

const url = process.argv[2];
const district = process.argv[3] || 'ca-pleas-psv.edupoint.com';
const goodOrigin = process.argv[4] || 'https://tshulin.github.io';
if (!url) {
	console.error('usage: node check-wss.mjs wss://relay.example.org [districtHost] [origin]');
	process.exit(2);
}

// Resolves to { outcome: 'tunnel', ws } | { outcome: 'closed' | 'error' | 'timeout', ... }.
function connect({ origin, host, timeoutMs = 15_000 }) {
	return new Promise((resolve) => {
		const ws = new WebSocket(url, { origin, handshakeTimeout: timeoutMs });
		ws.binaryType = 'nodebuffer';
		const timer = setTimeout(() => {
			ws.terminate();
			resolve({ outcome: 'timeout' });
		}, timeoutMs);
		ws.on('open', () => ws.send(JSON.stringify({ host })));
		ws.on('error', (e) => {
			clearTimeout(timer);
			resolve({ outcome: 'error', detail: e.message });
		});
		ws.on('close', (code, reason) => {
			clearTimeout(timer);
			resolve({ outcome: 'closed', code, detail: reason.toString() });
		});
		ws.on('message', (data, isBinary) => {
			if (isBinary) return;
			let ok = false;
			try {
				ok = JSON.parse(data.toString()).ok === true;
			} catch {
				/* not the control frame */
			}
			if (ok) {
				clearTimeout(timer);
				resolve({ outcome: 'tunnel', ws });
			}
		});
	});
}

let pass = true;
const report = (name, good, detail) => {
	pass &&= good;
	console.log(`  ${good ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const describe = (r) => [r.outcome, r.code, r.detail].filter(Boolean).join(' ');

console.log(`\n=== checking deployed relay at ${url} ===`);

// 1. Real tunnel + TLS handshake through it.
{
	const r = await connect({ origin: goodOrigin, host: district });
	if (r.outcome !== 'tunnel') {
		report(`tunnel to ${district}`, false, describe(r));
	} else {
		const dup = new Duplex({ write: (c, _e, cb) => r.ws.send(c, { binary: true }, cb), read() {} });
		r.ws.on('message', (d, bin) => bin && dup.push(d));
		r.ws.on('close', () => dup.push(null));
		const res = await new Promise((resolve) => {
			const sock = tls.connect({ socket: dup, servername: district, rejectUnauthorized: true }, () =>
				resolve({ ok: true, proto: sock.getProtocol(), cn: sock.getPeerCertificate()?.subject?.CN })
			);
			sock.on('error', (e) => resolve({ ok: false, detail: e.message }));
		});
		report(
			`tunnel to ${district} + TLS handshake through it`,
			res.ok === true,
			res.ok ? `${res.proto}, cert CN=${res.cn}` : res.detail
		);
		r.ws.close();
	}
}

// 2. A foreign Origin must be rejected before any tunnel opens.
{
	const r = await connect({ origin: 'https://evil.example', host: district });
	report(
		'foreign Origin rejected',
		r.outcome !== 'tunnel',
		r.outcome === 'tunnel' ? 'tunnel opened — ALLOWED_ORIGINS is not set on the relay!' : describe(r)
	);
	if (r.ws) r.ws.close();
}

// 3. A non-Edupoint host must be rejected.
{
	const r = await connect({ origin: goodOrigin, host: 'example.com' });
	report(
		'non-Edupoint host rejected',
		r.outcome !== 'tunnel',
		r.outcome === 'tunnel' ? 'tunnel opened to example.com!' : describe(r)
	);
	if (r.ws) r.ws.close();
}

console.log(pass ? '\n=== PASS ===\n' : '\n=== FAIL ===\n');
process.exit(pass ? 0 : 1);
