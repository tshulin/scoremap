// Old capture script for the original GradeCompass layout. Output may contain
// student data and belongs only in the gitignored functionality/captures folder.
// Run it during an active grading period if a real gradebook payload is needed.

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJar, cookieHeader, fetchFollow } from '../../src/lib/server/synergy/http.ts';
import { login } from '../../src/lib/server/synergy/login.ts';

const domain = process.env.SYNERGY_DOMAIN;
if (!domain) {
	console.error('Set SYNERGY_DOMAIN (e.g. yourdistrict-psv.edupoint.com).');
	process.exit(1);
}

async function getSession() {
	if (process.env.SYNERGY_COOKIE) {
		const jar = createJar();
		for (const pair of process.env.SYNERGY_COOKIE.split(';')) {
			const eq = pair.indexOf('=');
			if (eq <= 0) continue;
			jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
		}
		return { domain, jar, cookie: cookieHeader(jar) };
	}
	const username = process.env.SYNERGY_USERNAME;
	const password = process.env.SYNERGY_PASSWORD;
	if (!username || !password) {
		console.error('Set SYNERGY_COOKIE, or SYNERGY_USERNAME + SYNERGY_PASSWORD.');
		process.exit(1);
	}
	return await login({ domain, username, password });
}

const PAGES = {
	'student-info': 'PXP2_Student.aspx?AGU=0',
	documents: 'PXP2_Documents.aspx?AGU=0',
	attendance: 'PXP2_Attendance.aspx?AGU=0',
	gradebook: 'PXP2_Gradebook.aspx?AGU=0',
	// Some districts put assignment details on this page.
	'gradebook-classdetail': 'PXP2_ClassGrades.aspx?AGU=0',
	home: 'Home_PXP2.aspx'
};

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'captures');
await fs.mkdir(outDir, { recursive: true });

let session;
try {
	session = await getSession();
} catch (e) {
	console.error('Could not establish a session:', e.message);
	process.exit(1);
}
console.log(`Session established for ${domain}\n`);

for (const [name, page] of Object.entries(PAGES)) {
	try {
		const { body, finalUrl, redirected } = await fetchFollow(
			`https://${domain}/${page}`,
			{ method: 'GET' },
			session.jar
		);
		const file = path.join(outDir, `${name}.html`);
		await fs.writeFile(file, body, 'utf8');
		const dataSourceCount = (body.match(/"dataSource":/g) || []).length;
		console.log(
			`${name.padEnd(22)} ${String(body.length).padStart(7)} bytes  redirected=${redirected}  dataSource_arrays=${dataSourceCount}`
		);
		if (redirected) console.log(`   -> redirected to ${finalUrl} (likely no data for the current period)`);
	} catch (e) {
		console.log(`${name.padEnd(22)} ERROR: ${e.message}`);
	}
}

console.log('\nSaved to functionality/captures/ (gitignored — contains personal data; do NOT commit).');
console.log('Next: inspect captures/gradebook.html for `"dataSource":[...]` arrays and map their');
console.log('fields to the legacy Gradebook XML shape (see documentation.md § Gradebook translator).');
