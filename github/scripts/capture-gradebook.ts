// Capture real portal pages for parser development - run this WHEN GRADES ARE BACK,
// then implement parseGradebook (src/portal/pages/gradebook/index.ts) against the
// captured markup. See ADDING_REAL_DATA.md.
//
// Start the relay first (it's the same one the app uses), then:
//   RELAY_URL=ws://localhost:8080 \
//   SYNERGY_DOMAIN=... SYNERGY_USERNAME=... SYNERGY_PASSWORD=... \
//   npx tsx scripts/capture-gradebook.ts
//
// Output goes to captures/ (gitignored). It contains REAL personal data - never
// commit it. Sanitize before turning any of it into a committed test fixture.

import { createRelayFetch } from '../src/transport/fetchShim.js';
import { login } from '../src/portal/login';
import { fetchFollow } from '../src/portal/http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const domain = process.env.SYNERGY_DOMAIN;
const username = process.env.SYNERGY_USERNAME;
const password = process.env.SYNERGY_PASSWORD;
const relayUrl = process.env.RELAY_URL || 'ws://localhost:8080';
if (!domain || !username || !password) {
	console.error('Set SYNERGY_DOMAIN, SYNERGY_USERNAME, SYNERGY_PASSWORD (and start the relay).');
	process.exit(2);
}

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'captures');
fs.mkdirSync(outDir, { recursive: true });

const PAGES = [
	{ name: 'gradebook', path: 'PXP2_Gradebook.aspx?AGU=0' },
	{ name: 'classgrades', path: 'PXP2_ClassGrades.aspx?AGU=0' },
	// For verifying the absence row shape once a real absence exists (see attendance.ts).
	{ name: 'attendance', path: 'PXP2_Attendance.aspx?AGU=0' }
];

const options = { fetchImpl: createRelayFetch({ relayUrl }) };

console.log(`\n=== Capturing portal pages via ${relayUrl} -> ${domain} ===`);
const session = await login({ domain, username, password }, options);
console.log('  login OK\n');

for (const p of PAGES) {
	try {
		const page = await fetchFollow(`https://${domain}/${p.path}`, { method: 'GET' }, session.jar, options);
		const file = path.join(outDir, `${p.name}.html`);
		fs.writeFileSync(file, page.body);
		const grids = (page.body.match(/"dataSource":\s*\[/g) || []).length;
		const redirected = page.redirected ? '  (REDIRECTED - likely out of term / unavailable)' : '';
		console.log(`  ${p.name.padEnd(12)} ${page.body.length} bytes, ${grids} dataSource grid(s)${redirected}`);
		console.log(`               -> ${file}`);
	} catch (e) {
		console.log(`  ${p.name.padEnd(12)} ERROR: ${(e as Error).message}`);
	}
}

console.log(
	'\n  DONE. captures/ holds REAL personal data - do not commit it. Search each file for\n' +
		'  `"dataSource":[` to find the grids, then implement parseGradebook. Sanitize before\n' +
		'  making a committed fixture.\n'
);
process.exit(0);
