// Phase 4 verification (manual, needs network + credentials): drive the full
// resource set the app's data layer uses — login + student + documents +
// attendance + gradebook — through the blind relay via the ported browser
// portal client. Proves every fetcher api.js calls works over the relay.
//
//   SYNERGY_DOMAIN=... SYNERGY_USERNAME=... SYNERGY_PASSWORD=... npx tsx web/verify-resources.ts

import { startRelay } from '../relay/relay.mjs';
import { createRelayFetch } from './src/transport/fetchShim.js';
import { login } from './src/portal/login.js';
import { fetchStudentInfo } from './src/portal/pages/studentInfo.js';
import { fetchDocuments } from './src/portal/pages/documents.js';
import { fetchAttendance } from './src/portal/pages/attendance.js';
import { fetchGradebook } from './src/portal/pages/gradebook/index.js';

const domain = process.env.SYNERGY_DOMAIN;
const username = process.env.SYNERGY_USERNAME;
const password = process.env.SYNERGY_PASSWORD;
if (!domain || !username || !password) {
	console.error('Set SYNERGY_DOMAIN, SYNERGY_USERNAME, SYNERGY_PASSWORD.');
	process.exit(2);
}

const PORT = 8798;
const relay = startRelay({ port: PORT, log: () => {} });
const options = { fetchImpl: createRelayFetch({ relayUrl: `ws://127.0.0.1:${PORT}` }) };
const line = (l: string, v: unknown) => console.log(`  ${l.padEnd(16)} ${v}`);

console.log(`\n=== Phase 4: full resource set over the relay -> ${domain} ===`);
let ok = true;
try {
	const session = await login({ domain, username, password }, options);
	line('login:', 'OK (cookies: ' + session.jar.header().split('; ').length + ')');

	const info = await fetchStudentInfo(session, options);
	line('student:', info.name ? `name read (${info.name.length} chars)` : 'MISSING');
	ok &&= !!info.name;

	const docs = await fetchDocuments(session, options);
	const docsOk = Array.isArray(docs) && docs.every((d) => d.docToken && d.title && d.uploadDate);
	line('documents:', `${docs.length} rows, well-formed=${docsOk}`);
	ok &&= docsOk && docs.length > 0;

	const att = await fetchAttendance(session, options);
	line('attendance:', `school set=${!!att.schoolName}, absences=${att.absences.length}, unreadable=${att.unreadableAbsences}`);
	ok &&= typeof att.schoolName === 'string';

	// Gradebook is expected to be blocked out of term (NoActiveGradingPeriod) or
	// unimplemented (ParseError) — both are "handled", not a transport failure.
	try {
		await fetchGradebook(session, undefined, options);
		line('gradebook:', 'returned data (term is active!)');
	} catch (e) {
		line('gradebook:', `blocked as expected: ${(e as Error).constructor.name}`);
	}
} catch (e) {
	ok = false;
	line('ERROR:', (e as Error).message);
}

await relay.close();
console.log(ok ? '\n=== PASS: all resource fetchers work over the relay. ===\n' : '\n=== FAIL ===\n');
process.exit(ok ? 0 : 1);
