// TLS-over-relay: run a TLS 1.3 client (subtls) in the browser, over a WebSocket
// to the blind relay, so TLS terminates HERE and the relay sees only ciphertext.
// The relay bridges the encrypted bytes to <host>:443. See ../../scripts/plans/idea.md.
//
// Portable on purpose: uses only Uint8Array + platform globals (WebSocket,
// crypto.subtle), so the exact same code runs in the browser and under Node tests.
//
// subtls is pinned to an exact version (it's a young, single-maintainer TLS 1.3
// implementation). If it ever proves unreliable, the fallback is rustls compiled
// to WASM - heavier but battle-tested. Both satisfy the same {read,write} contract
// used below, so swapping is contained to this file.

import { startTls, TrustedCert } from 'subtls';
import { GODADDY_ROOT_G2_PEM } from './goDaddyRootG2.js';

const CONSUME = 0;
const PEEK = 1;

let rootCertsPromise;
function trustedRoots() {
	rootCertsPromise ??= TrustedCert.databaseFromPEM(GODADDY_ROOT_G2_PEM);
	return rootCertsPromise;
}

// Open the WebSocket to the relay and complete the {host} control handshake,
// resolving once the relay confirms the upstream TCP connection is open.
function openRelaySocket(relayUrl, host, WebSocketImpl) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocketImpl(relayUrl);
		ws.binaryType = 'arraybuffer';
		ws.addEventListener('error', () => reject(new Error('relay connection failed')));
		ws.addEventListener('close', () => reject(new Error('relay closed before handshake')));
		ws.addEventListener('open', () => ws.send(JSON.stringify({ host })));
		ws.addEventListener('message', function onControl(ev) {
			let ok = false;
			try {
				const text = typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data);
				ok = JSON.parse(text).ok === true;
			} catch {
				/* not the control frame */
			}
			ws.removeEventListener('message', onControl);
			ok ? resolve(ws) : reject(new Error(`relay refused tunnel to ${host}`));
		});
	});
}

// A read queue over the socket that honors subtls's CONSUME/PEEK modes. subtls
// peeks the record-type byte before reading it, so a consume-only queue desyncs
// the record framing. Bytes are copied out of each frame because Node pools its
// receive buffers (harmless in the browser).
function makeNetworkRead(ws) {
	const chunks = [];
	let closed = false;
	let waiting = null;
	const available = () => chunks.reduce((n, c) => n + c.length, 0);

	const copyFirst = (n) => {
		const out = new Uint8Array(n);
		let off = 0;
		let ci = 0;
		let cpos = 0;
		while (off < n) {
			const c = chunks[ci];
			const take = Math.min(c.length - cpos, n - off);
			out.set(c.subarray(cpos, cpos + take), off);
			off += take;
			if (cpos + take === c.length) {
				ci++;
				cpos = 0;
			} else {
				cpos += take;
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
		if (available() >= waiting.bytes) {
			const w = waiting;
			waiting = null;
			w.resolve(w.mode === PEEK ? copyFirst(w.bytes) : consume(w.bytes));
		} else if (closed) {
			const w = waiting;
			waiting = null;
			w.resolve(undefined);
		}
	};

	ws.addEventListener('message', (ev) => {
		chunks.push(new Uint8Array(ev.data).slice()); // copy out of the pooled buffer
		serve();
	});
	ws.addEventListener('close', () => {
		closed = true;
		serve();
	});

	return (bytes, mode = CONSUME) =>
		new Promise((resolve) => {
			waiting = { bytes, mode, resolve };
			serve();
		});
}

// Send exactly the view's bytes (a copy), never the whole backing buffer.
function makeNetworkWrite(ws) {
	return (data) => ws.send(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

// Open a TLS connection to `host` through the relay. Returns subtls's
// { read, write } for TLS application data, plus the validated cert and close().
export async function openTlsThroughRelay(relayUrl, host, { WebSocketImpl } = {}) {
	const Impl = WebSocketImpl ?? WebSocket;
	const ws = await openRelaySocket(relayUrl, host, Impl);
	const networkRead = makeNetworkRead(ws);
	const networkWrite = makeNetworkWrite(ws);
	const conn = await startTls(host, await trustedRoots(), networkRead, networkWrite, {
		useSNI: true
	});
	return {
		read: conn.read,
		write: conn.write,
		cert: conn.userCert,
		close: () => {
			try {
				ws.close();
			} catch {
				/* already closing */
			}
		}
	};
}
