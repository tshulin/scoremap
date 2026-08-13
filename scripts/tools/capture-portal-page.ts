// Save portal pages locally for parser development.
// Usage: npx tsx tools/capture-portal-page.ts <page|all>

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { portalBase } from '../src/portal/base.js';
import { CookieJar, fetchFollow } from '../src/portal/http.js';
import { login, validatePortalDomain, type PortalSession } from '../src/portal/login.js';

const PAGES: Record<string, string> = {
	'student-info': 'PXP2_Student.aspx?AGU=0',
	documents: 'PXP2_Documents.aspx?AGU=0',
	attendance: 'PXP2_Attendance.aspx?AGU=0',
	gradebook: 'PXP2_Gradebook.aspx?AGU=0',
	'gradebook-classdetail': 'PXP2_ClassGrades.aspx?AGU=0',
	home: 'Home_PXP2.aspx'
};

async function sessionFromEnv(): Promise<PortalSession> {
	const domain = process.env.SYNERGY_DOMAIN;
	if (!domain) throw new Error('Set SYNERGY_DOMAIN. See env.example.');
	validatePortalDomain(domain);

	const cookieString = process.env.SYNERGY_COOKIE;
	if (cookieString) {
		const jar = CookieJar.fromCookieString(cookieString);
		if (jar.size === 0) throw new Error('SYNERGY_COOKIE has no name=value pairs.');
		return { domain, jar };
	}

	const username = process.env.SYNERGY_USERNAME;
	const password = process.env.SYNERGY_PASSWORD;
	if (!username || !password) {
		throw new Error('Set SYNERGY_COOKIE, or SYNERGY_USERNAME + SYNERGY_PASSWORD.');
	}
	return login({ domain, username, password });
}

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in PAGES))) {
	console.error(
		`Usage: npx tsx tools/capture-portal-page.ts <page|all>\npages: ${Object.keys(PAGES).join(' | ')}`
	);
	process.exit(1);
}
const selected = Object.entries(PAGES).filter(([name]) => target === 'all' || name === target);

let session: PortalSession;
try {
	session = await sessionFromEnv();
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}

const outDir = resolve('captures');
mkdirSync(outDir, { recursive: true });

let errors = 0;
for (const [name, page] of selected) {
	try {
		const { body, finalUrl, redirected } = await fetchFollow(
			`${portalBase(session.domain)}/${page}`,
			{ method: 'GET' },
			session.jar
		);
		const file = resolve(outDir, `${name}.html`);
		writeFileSync(file, body, 'utf8');
		const grids = (body.match(/"dataSource":/g) ?? []).length;
		console.log(
			`${name.padEnd(22)} ${String(body.length).padStart(8)} bytes  dataSourceArrays=${grids}${
				redirected ? `  -> redirected to ${new URL(finalUrl).pathname} (module unavailable)` : ''
			}`
		);
	} catch (e) {
		console.log(`${name.padEnd(22)} ERROR: ${e instanceof Error ? e.message : String(e)}`);
		errors++;
	}
}

console.log(`\nSaved to ${outDir}`);
console.log('Captures contain personal data. Sanitize them before creating fixtures:');
console.log('  npx tsx tools/sanitize-capture.ts captures/<page>.html');
process.exit(errors > 0 ? 1 : 0);
