// De-risks the ONE part the main PoC couldn't: does a *userland* TLS client — the
// kind that runs in a browser — actually complete a TLS 1.3 handshake with the
// portal over the relay and let us read HTTP + Set-Cookie?
//
// This is the real thing: subtls (pure-JS TLS 1.3 over SubtleCrypto), the exact
// library idea.md proposes for the browser, driven over the same blind relay via
// Node's browser-style global WebSocket. Only the Go Daddy Root G2 cert is trusted
// (what the browser build would bundle), so a passing handshake means subtls did
// genuine certificate validation.

// The browser build would use subtls's own WebSocketReadQueue; here we hand-roll an
// equivalent copying+PEEK queue (see below) to work around Node/undici specifics.
import { startTls, TrustedCert } from 'subtls';
import tls from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { startRelay } from './relay.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.join(here, 'subtls-dump.bin');
const host = process.env.SYNERGY_DOMAIN;
const PORT = Number(process.env.POC_RELAY_PORT || 8788);
const line = (l, v) => console.log(`  ${l.padEnd(22)} ${v}`);

if (!host) {
	console.error('Set SYNERGY_DOMAIN in the env.');
	process.exit(2);
}

const goDaddyG2 = tls.rootCertificates.find((p) => {
	try {
		return new X509Certificate(p).subject.includes('Go Daddy Root Certificate Authority - G2');
	} catch {
		return false;
	}
});

// Bridge Node's global WebSocket to the relay, consuming the {ok} control frame
// before subtls starts reading TLS bytes off the same socket.
function connectTunnel(relayUrl) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(relayUrl);
		ws.binaryType = 'arraybuffer';
		ws.addEventListener('error', (e) => reject(new Error('ws error: ' + (e.message || 'failed'))));
		ws.addEventListener('open', () => ws.send(JSON.stringify({ host })));
		ws.addEventListener(
			'message',
			(msg) => {
				let ok = false;
				try {
					ok = JSON.parse(typeof msg.data === 'string' ? msg.data : '').ok === true;
				} catch {}
				ok ? resolve(ws) : reject(new Error('relay refused tunnel'));
			},
			{ once: true }
		);
	});
}

try {
	if (fs.existsSync(DUMP)) fs.rmSync(DUMP);
} catch {}

const relay = startRelay({ port: PORT, dumpPath: DUMP, log: (m) => console.log(`  [relay] ${m}`) });

console.log('\n=== subtls (browser-grade TLS client) over the blind relay ===');
line('trusting only:', 'Go Daddy Root Certificate Authority - G2');
line('target:', host);
console.log('');

let exitCode = 0;
try {
	const rootCerts = await TrustedCert.databaseFromPEM(goDaddyG2);
	const ws = await connectTunnel(`ws://127.0.0.1:${PORT}`);

	// A copying read queue. subtls's own WebSocketReadQueue does `new Uint8Array(msg.data)`
	// (a VIEW onto the received ArrayBuffer); Node/undici pools those buffers, so queued
	// bytes get clobbered by later frames. Browsers hand out a fresh buffer per message,
	// so this is a Node-only workaround — the browser build uses WebSocketReadQueue as-is.
	// Minimal ReadQueue that honors subtls's two read modes: CONSUME (0) and PEEK (1).
	// PEEK returns the next N bytes WITHOUT removing them — subtls peeks the record-type
	// byte before reading it for real. (subtls's own WebSocketReadQueue does this; we
	// reimplement it only to also copy out of undici's pooled receive buffers.)
	const CONSUME = 0;
	const PEEK = 1;
	const chunks = [];
	let closed = false;
	let waiting = null;
	const avail = () => chunks.reduce((n, c) => n + c.length, 0);
	const copyFirst = (n) => {
		const out = Buffer.allocUnsafe(n);
		let off = 0;
		let ci = 0;
		let cpos = 0;
		while (off < n) {
			const c = chunks[ci];
			const chunk = Math.min(c.length - cpos, n - off);
			c.copy(out, off, cpos, cpos + chunk);
			off += chunk;
			if (cpos + chunk === c.length) {
				ci++;
				cpos = 0;
			} else {
				cpos += chunk;
			}
		}
		return out;
	};
	const consume = (n) => {
		const out = copyFirst(n);
		let remaining = n;
		while (remaining > 0) {
			const c = chunks[0];
			if (c.length <= remaining) {
				remaining -= c.length;
				chunks.shift();
			} else {
				chunks[0] = c.subarray(remaining);
				remaining = 0;
			}
		}
		return out;
	};
	const serve = () => {
		if (!waiting) return;
		if (avail() >= waiting.bytes) {
			const { resolve, bytes, mode } = waiting;
			waiting = null;
			resolve(new Uint8Array(mode === PEEK ? copyFirst(bytes) : consume(bytes)));
		} else if (closed) {
			const { resolve } = waiting;
			waiting = null;
			resolve(undefined);
		}
	};
	ws.addEventListener('message', (msg) => {
		chunks.push(Buffer.from(new Uint8Array(msg.data))); // COPY out of undici's pooled buffer
		serve();
	});
	ws.addEventListener('close', () => {
		closed = true;
		serve();
	});
	const rx = [];
	const networkRead = (bytes, mode = CONSUME) =>
		new Promise((resolve) => {
			waiting = { bytes, mode, resolve };
			serve();
		}).then((out) => {
			if (out && mode === CONSUME) rx.push(Buffer.from(out));
			return out;
		});
	globalThis.__rx = rx; // walked on error for TLS-framing diagnostics
	// Node's global WebSocket.send() transmits the whole backing ArrayBuffer, not
	// just the view — send an exact-length copy so the ClientHello isn't padded.
	const networkWrite = (data) => ws.send(data.slice().buffer);

	console.log('-> subtls TLS 1.3 handshake through the tunnel...');
	const conn = await startTls(host, rootCerts, networkRead, networkWrite, { useSNI: true });
	line('handshake:', 'OK');
	line('server cert CN:', conn.userCert.subject?.CN ?? '(unknown)');

	const req =
		`GET /PXP2_Login_Student.aspx?regenerateSessionId=True HTTP/1.1\r\n` +
		`Host: ${host}\r\n` +
		`User-Agent: Mozilla/5.0 (subtls-poc) AppleWebKit/537.36\r\n` +
		`Accept: */*\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`;
	await conn.write(new TextEncoder().encode(req));

	const parts = [];
	for (;;) {
		const chunk = await conn.read();
		if (chunk === undefined) break;
		parts.push(Buffer.from(chunk));
	}
	const raw = Buffer.concat(parts);
	const sep = raw.indexOf('\r\n\r\n');
	const headerText = raw.subarray(0, sep).toString('latin1');
	const status = Number(headerText.split('\r\n')[0].split(' ')[1]);
	const setCookie = /^set-cookie:/im.test(headerText);
	const hasForm = raw.includes(Buffer.from('__VIEWSTATE'));

	console.log('\nHTTP OVER subtls');
	line('status:', status);
	line('bytes received:', raw.length);
	line('Set-Cookie present:', setCookie ? 'YES' : 'NO');
	line('WebForms login form:', hasForm ? 'YES (__VIEWSTATE)' : 'NO');
	if (!(status === 200 && setCookie && hasForm)) exitCode = 1;
} catch (e) {
	exitCode = 1;
	console.log('\nHTTP OVER subtls');
	line('error:', e.message);
	const buf = Buffer.concat(globalThis.__rx ?? []);
	console.log(`  server bytes seen: ${buf.length}`);
	let pos = 0;
	for (let i = 0; i < 12 && pos + 5 <= buf.length; i++) {
		const type = buf[pos];
		const ver = `${buf[pos + 1].toString(16)}${buf[pos + 2].toString(16)}`;
		const len = buf.readUInt16BE(pos + 3);
		console.log(`    record[${i}] pos=${pos} type=0x${type.toString(16)} ver=0x${ver} len=${len}`);
		pos += 5 + len;
	}
}

await relay.close();

console.log('\nPRIVACY CHECK');
if (fs.existsSync(DUMP)) {
	const dump = fs.readFileSync(DUMP);
	// The User-Agent travels inside the TLS-encrypted HTTP request, so it must not
	// appear in the bytes the relay saw.
	const leaked = dump.includes(Buffer.from('AppleWebKit/537.36 (subtls-poc)')) || dump.includes(Buffer.from('subtls-poc'));
	line('http payload in bytes:', leaked ? 'FOUND — LEAK!' : 'not present ✓');
	if (leaked) exitCode = 1;
	fs.rmSync(DUMP);
}

console.log(
	exitCode === 0
		? '\n=== subtls PASSED: real browser-grade TLS client works over the blind relay. ===\n'
		: '\n=== subtls test FAILED (see above). ===\n'
);
process.exit(exitCode);
