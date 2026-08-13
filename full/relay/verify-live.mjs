// LIVE proof (manual, needs network): boot the hardened relay and fetch the real
// portal's login page THROUGH it with TLS terminating in this process — then scan
// the relayed bytes to prove the relay saw only ciphertext.
//
//   SYNERGY_DOMAIN=ca-pleas-psv.edupoint.com node verify-live.mjs
//
// This reuses Node's TLS as the stand-in for the browser's subtls (idea.md: the
// only production difference is where the TLS client runs). No credentials needed —
// the login page is public; we just prove piping + blindness on the hardened relay.

import { startRelay } from './relay.mjs';
import tls from 'node:tls';
import { Duplex } from 'node:stream';
import { WebSocket } from 'ws';
import fs from 'node:fs';

const host = process.env.SYNERGY_DOMAIN;
if (!host) {
	console.error('Set SYNERGY_DOMAIN (e.g. ca-pleas-psv.edupoint.com).');
	process.exit(2);
}
const PORT = 8795;
const DUMP = new URL('./verify-dump.bin', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const MARKER = 'AppleWebKit/537.36 (relay-verify)';

try {
	if (fs.existsSync(DUMP)) fs.rmSync(DUMP);
} catch {}

const relay = startRelay({ port: PORT, dumpPath: DUMP, log: (m) => console.log(`  [relay] ${m}`) });

function tunnelDuplex() {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
		ws.binaryType = 'nodebuffer';
		let ready = false;
		ws.on('open', () => ws.send(JSON.stringify({ host })));
		ws.on('error', reject);
		ws.on('message', (data, isBinary) => {
			if (!ready) {
				if (JSON.parse(data.toString()).ok !== true) return reject(new Error('relay refused'));
				ready = true;
				const dup = new Duplex({ write: (c, _e, cb) => ws.send(c, { binary: true }, cb), read() {} });
				ws.on('message', (d, bin) => bin && dup.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
				ws.on('close', () => dup.push(null));
				resolve(dup);
			}
		});
	});
}

console.log(`\n=== relay live verify -> ${host} ===`);
let ok = false;
try {
	const duplex = await tunnelDuplex();
	const res = await new Promise((resolve, reject) => {
		const chunks = [];
		const sock = tls.connect({ socket: duplex, servername: host, rejectUnauthorized: true }, () => {
			sock.write(
				`GET /PXP2_Login_Student.aspx?regenerateSessionId=True HTTP/1.1\r\n` +
					`Host: ${host}\r\nUser-Agent: ${MARKER}\r\n` +
					`Accept-Encoding: identity\r\nConnection: close\r\n\r\n`
			);
		});
		sock.on('data', (d) => chunks.push(d));
		sock.on('end', () => resolve({ raw: Buffer.concat(chunks), proto: sock.getProtocol(), cn: sock.getPeerCertificate()?.subject?.CN }));
		sock.on('error', reject);
	});
	const head = res.raw.subarray(0, res.raw.indexOf('\r\n\r\n')).toString('latin1');
	const status = Number(head.split('\r\n')[0].split(' ')[1]);
	const setCookie = /^set-cookie:/im.test(head);
	const form = res.raw.includes(Buffer.from('__VIEWSTATE'));
	console.log(`  TLS: ${res.proto}, cert CN=${res.cn}`);
	console.log(`  HTTP ${status}, Set-Cookie=${setCookie ? 'yes' : 'no'}, __VIEWSTATE=${form ? 'yes' : 'no'}`);
	ok = status === 200 && setCookie && form;
} catch (e) {
	console.log(`  ERROR: ${e.message}`);
}

await relay.close();
const leaked = fs.existsSync(DUMP) && fs.readFileSync(DUMP).includes(Buffer.from(MARKER));
console.log(`  privacy: request marker in relayed bytes = ${leaked ? 'FOUND — LEAK!' : 'absent ✓'}`);
if (fs.existsSync(DUMP)) fs.rmSync(DUMP);
if (ok && !leaked) console.log('\n=== PASS: hardened relay pipes TLS and stays blind. ===\n');
else console.log('\n=== FAIL ===\n');
process.exit(ok && !leaked ? 0 : 1);
