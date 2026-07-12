// Save raw portal pages locally for parser development.
// Usage: bun scripts/capture-portal-page.mjs <page|all>
//

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getSessionFromEnv } from './lib/session.mjs';
import { capturesDir } from './lib/paths.mjs';
import { fetchFollow } from './lib/http.mjs';
import { countDataSourceArrays } from './lib/inspect.mjs';

const PAGES = {
	'student-info': 'PXP2_Student.aspx?AGU=0',
	documents: 'PXP2_Documents.aspx?AGU=0',
	attendance: 'PXP2_Attendance.aspx?AGU=0',
	gradebook: 'PXP2_Gradebook.aspx?AGU=0',
	'gradebook-classdetail': 'PXP2_ClassGrades.aspx?AGU=0',
	home: 'Home_PXP2.aspx'
};

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in PAGES))) {
	console.error(`Usage: bun scripts/capture-portal-page.mjs <page|all>\npages: ${Object.keys(PAGES).join(' | ')}`);
	process.exit(1);
}
const selected = target === 'all' ? Object.entries(PAGES) : [[target, PAGES[target]]];

let session;
try {
	session = await getSessionFromEnv();
} catch (e) {
	console.error(e.message);
	process.exit(1);
}
console.log(`Session established for ${session.domain}\n`);

const outDir = await capturesDir();
let errors = 0;

for (const [name, page] of selected) {
	try {
		const { body, finalUrl, redirected } = await fetchFollow(
			`https://${session.domain}/${page}`,
			{ method: 'GET' },
			session.jar
		);
		await fs.writeFile(path.join(outDir, `${name}.html`), body, 'utf8');
		console.log(
			`${name.padEnd(22)} ${String(body.length).padStart(8)} bytes  redirected=${redirected}  dataSourceArrays=${countDataSourceArrays(body)}`
		);
		if (redirected) {
			console.log(
				`${' '.repeat(23)}-> landed on ${new URL(finalUrl).pathname} (module unavailable${name.startsWith('gradebook') ? ' — likely no active grading period' : ''})`
			);
		}
	} catch (e) {
		console.log(`${name.padEnd(22)} ERROR: ${e.message}`);
		errors++;
	}
}

console.log(`\nSaved to ${outDir}`);
console.log('Captures contain personal data — never commit or share them.');
process.exit(errors > 0 ? 1 : 0);
