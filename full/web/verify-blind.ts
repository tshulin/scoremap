// Proof of blindness: run a REAL login + an authenticated request through the
// browser transport (subtls) over a relay whose relayed bytes are teed to a file,
// then scan that file for the secrets. The portal hostname is a positive control:
// it IS visible (the relay must know where to connect, and TLS 1.3 SNI is
// cleartext), which proves the scan works — while the password, username, and
// session cookie are absent because they live inside the TLS-encrypted stream.
//
//   SYNERGY_DOMAIN=... SYNERGY_USERNAME=... SYNERGY_PASSWORD=... npx tsx web/verify-blind.ts

import { startRelay } from '../relay/relay.mjs';
import { createRelayFetch } from './src/transport/fetchShim.js';
import { login } from './src/portal/login.js';
import { fetchStudentInfo } from './src/portal/pages/studentInfo.js';
import fs from 'node:fs';

const domain = process.env.SYNERGY_DOMAIN;
const username = process.env.SYNERGY_USERNAME;
const password = process.env.SYNERGY_PASSWORD;
if (!domain || !username || !password) {
	console.error('Set SYNERGY_DOMAIN, SYNERGY_USERNAME, SYNERGY_PASSWORD.');
	process.exit(2);
}

const DUMP = new URL('./blind-dump.bin', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
try {
	if (fs.existsSync(DUMP)) fs.rmSync(DUMP);
} catch {}

const PORT = 8081; // separate from the live :8080 dev relay
const relay = startRelay({ port: PORT, dumpPath: DUMP, log: () => {} });
const options = { fetchImpl: createRelayFetch({ relayUrl: `ws://127.0.0.1:${PORT}` }) };

console.log(`\n=== Blindness check: capturing every byte the relay pipes ===`);
const session = await login({ domain, username, password }, options);
await fetchStudentInfo(session, options); // an authenticated request: cookie goes UP too
await relay.close(); // flush the byte dump

const bytes = fs.readFileSync(DUMP);
const cookies = session.jar.header(); // "ASP.NET_SessionId=...; EESPSV=..."
const cookieValues = cookies.split('; ').map((c) => c.split('=').slice(1).join('='));

const has = (needle: string) => bytes.includes(Buffer.from(needle, 'utf8'));
const report = (label: string, needle: string, expectFound: boolean) => {
	const found = has(needle);
	const verdict = found === expectFound ? 'as expected' : '!!! UNEXPECTED';
	console.log(`  ${label.padEnd(30)} ${found ? 'FOUND   ' : 'absent  '} (${verdict})`);
	return found === expectFound;
};

console.log(`\n  ${bytes.length} bytes crossed the relay. Scanning them:\n`);
let ok = true;
// Positive control — must be present (the relay legitimately sees the target host):
ok = report('portal hostname (control):', domain, true) && ok;
// The secrets — must all be absent:
ok = report('password:', password, false) && ok;
ok = report('username:', username, false) && ok;
ok = report('cookie name ASP.NET_SessionId:', 'ASP.NET_SessionId', false) && ok;
for (const v of cookieValues) ok = report(`session cookie value:`, v, false) && ok;

fs.rmSync(DUMP);
console.log(
	ok
		? '\n=== CONFIRMED: the relay sees the hostname only; password, username and cookies are encrypted. ===\n'
		: '\n=== UNEXPECTED RESULT — review above. ===\n'
);
process.exit(ok ? 0 : 1);
