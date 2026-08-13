// Phase 3 verification (manual, needs network + credentials): drive the PORTED
// browser portal client — login() + fetchStudentInfo() — through the blind relay
// via the subtls fetch-shim, against the real portal. This exercises the exact
// browser code path (transport + adapted portal modules), just under Node.
//
//   SYNERGY_DOMAIN=... SYNERGY_USERNAME=... SYNERGY_PASSWORD=... npx tsx web/verify-login.ts
//
// Credentials come from env only and are never printed.

import { startRelay } from '../relay/relay.mjs';
import { createRelayFetch } from './src/transport/fetchShim.js';
import { login } from './src/portal/login.js';
import { fetchStudentInfo } from './src/portal/pages/studentInfo.js';

const domain = process.env.SYNERGY_DOMAIN;
const username = process.env.SYNERGY_USERNAME;
const password = process.env.SYNERGY_PASSWORD;
if (!domain || !username || !password) {
	console.error('Set SYNERGY_DOMAIN, SYNERGY_USERNAME, SYNERGY_PASSWORD.');
	process.exit(2);
}

const PORT = 8797;
const relay = startRelay({ port: PORT, log: (m) => console.log(`  [relay] ${m}`) });
const relayFetch = createRelayFetch({ relayUrl: `ws://127.0.0.1:${PORT}` });
const options = { fetchImpl: relayFetch };
const line = (l: string, v: unknown) => console.log(`  ${l.padEnd(20)} ${v}`);

console.log(`\n=== Phase 3: ported portal client over the relay -> ${domain} ===`);
let ok = false;
try {
	const session = await login({ domain, username, password }, options);
	const cookieNames = session.jar
		.header()
		.split('; ')
		.map((c) => c.split('=')[0])
		.filter(Boolean);
	line('login:', 'OK');
	line('session cookies:', cookieNames.join(', ') || '(none)');

	const info = await fetchStudentInfo(session, options);
	// Redacted on purpose (personal data): presence + lengths, not values.
	line('student name:', info.name ? `read (${info.name.length} chars)` : 'MISSING');
	line('grade:', info.grade ? `read (${info.grade.length} chars)` : '(none)');
	line('photo:', info.photoBase64 ? `read (${info.photoBase64.length} b64 chars)` : '(none)');
	ok = cookieNames.length >= 2 && !!info.name;
} catch (e) {
	line('ERROR:', (e as Error).message);
}

await relay.close();
console.log(
	ok
		? '\n=== PASS: ported browser portal client logs in and reads student info over the relay. ===\n'
		: '\n=== FAIL ===\n'
);
process.exit(ok ? 0 : 1);
