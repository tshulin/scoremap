// Capture real portal pages for parser verification. The gradebook parser and its
// GB-row adapter (src/portal/pages/gradebook/assignment.ts) were verified against
// real posted grades on 2026-08-21; re-run this if a district renders rows
// differently and diff the printed keys. See scripts/plans/gradedata.md and scripts/plans/ADDING_REAL_DATA.md.
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
import { countDataSources, findDataSourceWithKeys } from '../src/extract/index';
import { parseGradebookLanding } from '../src/portal/pages/gradebook/landing';
import { loadControl } from '../src/portal/pages/gradebook/loadControl';
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

let gradebookBody: string | undefined;
for (const p of PAGES) {
	try {
		const page = await fetchFollow(`https://${domain}/${p.path}`, { method: 'GET' }, session.jar, options);
		const file = path.join(outDir, `${p.name}.html`);
		fs.writeFileSync(file, page.body);
		if (p.name === 'gradebook' && !page.redirected) gradebookBody = page.body;
		const grids = (page.body.match(/"dataSource":\s*\[/g) || []).length;
		const redirected = page.redirected ? '  (REDIRECTED - likely out of term / unavailable)' : '';
		console.log(`  ${p.name.padEnd(12)} ${page.body.length} bytes, ${grids} dataSource grid(s)${redirected}`);
		console.log(`               -> ${file}`);
	} catch (e) {
		console.log(`  ${p.name.padEnd(12)} ERROR: ${(e as Error).message}`);
	}
}

// The gradebook's real payloads are the per-class Gradebook_ClassDetails
// fragments, fetched through the same LoadControl POST the app uses. Only row
// KEYS (column names) are printed - values are personal data and stay in the
// files. Compare the printed keys against the adapter in
// src/portal/pages/gradebook/assignment.ts (see scripts/plans/gradedata.md).
if (gradebookBody) {
	try {
		const landing = parseGradebookLanding(gradebookBody);
		console.log(
			`\n  gradebook: ${landing.periods.length} grading period(s), ${landing.classes.length} class(es)`
		);
		for (const cls of landing.classes) {
			const fragment = await loadControl(session, 'Gradebook_ClassDetails', cls.focusArgs, options);
			const file = path.join(outDir, `gradebook-class-${cls.classId}.html`);
			fs.writeFileSync(file, fragment);
			const rows = findDataSourceWithKeys(fragment, [
				'GBAssignment',
				'GBPoints',
				'GradebookID',
				'Measure'
			]);
			console.log(
				`    class ${cls.classId}: ${fragment.length} bytes, ${countDataSources(fragment)} grid(s), ${rows.length} assignment row(s) -> ${file}`
			);
			if (rows[0]) console.log(`      row keys: ${Object.keys(rows[0]).join(', ')}`);
		}

		const otherIndex = landing.periods.findIndex((_, i) => i !== landing.currentPeriodIndex);
		const other = landing.periods[otherIndex];
		if (other) {
			const fragment = await loadControl(
				session,
				'Gradebook_SchoolClasses',
				{
					schoolID: other.schoolId,
					OrgYearGU: other.orgYearGu,
					gradePeriodGU: other.gu,
					GradingPeriodGroup: other.groupName,
					AGU: landing.agu
				},
				options
			);
			const file = path.join(outDir, `gradebook-period-${otherIndex}.html`);
			fs.writeFileSync(file, fragment);
			console.log(
				`    period ${otherIndex} (${other.name}): ${fragment.length} bytes (Gradebook_SchoolClasses) -> ${file}`
			);
		}
	} catch (e) {
		console.log(`  gradebook details ERROR: ${(e as Error).message}`);
	}
}

console.log(
	'\n  DONE. captures/ holds REAL personal data - do not commit it. Search each file for\n' +
		'  `"dataSource":[` to find the grids, then implement parseGradebook. Sanitize before\n' +
		'  making a committed fixture.\n'
);
process.exit(0);
