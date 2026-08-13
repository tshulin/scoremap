// PoC orchestrator. Starts the blind relay, drives a full PXP2 login + an
// authenticated page fetch THROUGH it with TLS terminating in the client, then
// proves the relay only ever saw ciphertext by scanning its byte dump for the
// secrets. Credentials come from env only (never hardcoded / never printed).

import { startRelay } from './relay.mjs';
import { runLogin } from './login-flow.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DUMP = path.join(here, 'relay-dump.bin');

const domain = process.env.SYNERGY_DOMAIN;
const username = process.env.SYNERGY_USERNAME;
const password = process.env.SYNERGY_PASSWORD;

if (!domain || !username || !password) {
	console.error('Set SYNERGY_DOMAIN, SYNERGY_USERNAME, SYNERGY_PASSWORD in the env.');
	process.exit(2);
}

const line = (label, value) => console.log(`  ${label.padEnd(22)} ${value}`);
const PORT = Number(process.env.POC_RELAY_PORT || 8787);

try {
	if (fs.existsSync(DUMP)) fs.rmSync(DUMP);
} catch {}

const relay = startRelay({
	port: PORT,
	dumpPath: DUMP,
	log: (m) => console.log(`  [relay] ${m}`)
});

console.log('\n=== grademax blind-relay PoC ===');
console.log(`Relay listening on ws://127.0.0.1:${PORT}  (allowlist: *.edupoint.com:443)`);
console.log(`Target: ${domain}\n`);

let exitCode = 0;
try {
	console.log('-> Running PXP2 login through the tunnel (TLS terminates in the client)...\n');
	const r = await runLogin({
		relayUrl: `ws://127.0.0.1:${PORT}`,
		host: domain,
		username,
		password
	});

	console.log('\nLOGIN RESULT');
	line('authenticated:', r.ok ? 'YES' : 'NO');
	line('tunnels opened:', r.tunnels);
	line('TLS version:', r.protocol);
	line('cert validated:', r.certAuthorized ? `YES (CN=${r.peerCN})` : 'NO');
	line('session cookies:', r.cookieNames.join(', ') || '(none)');
	line('landed on:', r.landedPath);
	line('student page:', `HTTP ${r.studentPageStatus}, ${r.studentPageBytes} bytes`);
	// Redacted on purpose (personal data): report presence, not the value.
	line('student name read:', r.studentName ? `YES (${r.studentName.length} chars)` : 'NO');
} catch (e) {
	exitCode = 1;
	console.log(`\nLOGIN RESULT`);
	line('authenticated:', 'NO');
	line('error:', e.message);
}

// Flush the relay's byte dump, then prove it is ciphertext.
await relay.close();

console.log('\nPRIVACY CHECK (does the relay ever see plaintext?)');
line('relayed bytes:', relay.bytes());
if (fs.existsSync(DUMP)) {
	const dump = fs.readFileSync(DUMP);
	const leakedPass = dump.includes(Buffer.from(password, 'utf8'));
	const leakedUser = dump.includes(Buffer.from(username, 'utf8'));
	line('password in bytes:', leakedPass ? 'FOUND — LEAK!' : 'not present ✓');
	line('username in bytes:', leakedUser ? 'FOUND — LEAK!' : 'not present ✓');
	if (leakedPass || leakedUser) exitCode = 1;
	fs.rmSync(DUMP);
} else {
	line('dump:', 'no bytes captured');
}

console.log(
	exitCode === 0
		? '\n=== PoC PASSED: login worked over the blind relay, and the relay saw only ciphertext. ===\n'
		: '\n=== PoC FAILED (see above). ===\n'
);
process.exit(exitCode);
