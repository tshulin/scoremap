// Check live portal responses without printing student data.
// Usage: npx tsx tools/pull-real-data.ts <resource|all>
// Set SYNERGY_DOMAIN and copy SYNERGY_COOKIE from a browser session.

import { CookieJar, fetchFollow } from '../src/portal/http.js';

// DevExpress embeds portal grids in dataSource arrays.
const countDataSourceArrays = (html: string): number => (html.match(/"dataSource":/g) ?? []).length;

interface ResourceSpec {
	page: string;
	expectGrids: boolean;
}

const RESOURCES: Record<string, ResourceSpec> = {
	'student-info': { page: 'PXP2_Student.aspx?AGU=0', expectGrids: false },
	documents: { page: 'PXP2_Documents.aspx?AGU=0', expectGrids: true },
	attendance: { page: 'PXP2_Attendance.aspx?AGU=0', expectGrids: true },
	gradebook: { page: 'PXP2_Gradebook.aspx?AGU=0', expectGrids: true }
};

interface Session {
	domain: string;
	jar: CookieJar;
}

function sessionFromEnv(): Session {
	const domain = process.env.SYNERGY_DOMAIN;
	if (!domain) {
		throw new Error('Set SYNERGY_DOMAIN (e.g. "yourdistrict-psv.edupoint.com"). See env.example.');
	}
	const cookieString = process.env.SYNERGY_COOKIE;
	if (!cookieString) {
		throw new Error(
			'Set SYNERGY_COOKIE (browser-copied, e.g. "ASP.NET_SessionId=x; EESPSV=y").\n' +
				'For credential login, use `node pull-real-data.mjs`.'
		);
	}
	const jar = CookieJar.fromCookieString(cookieString);
	if (jar.size === 0) {
		throw new Error('SYNERGY_COOKIE is set but has no name=value pairs.');
	}
	return { domain, jar };
}

async function checkResource(
	name: string,
	{ page, expectGrids }: ResourceSpec,
	session: Session
): Promise<{ ok: boolean; detail: string }> {
	const { body, finalUrl, redirected, status } = await fetchFollow(
		`https://${session.domain}/${page}`,
		{ method: 'GET' },
		session.jar
	);
	const grids = countDataSourceArrays(body);
	const detail = `status=${status} bytes=${body.length} dataSourceArrays=${grids}`;
	if (status >= 400) return { ok: false, detail: `${detail} — HTTP error` };
	if (redirected) {
		const why = name === 'gradebook' ? ' (likely no active grading period)' : '';
		return { ok: false, detail: `${detail} — redirected to ${new URL(finalUrl).pathname}${why}` };
	}
	if (expectGrids && grids === 0) {
		return { ok: false, detail: `${detail} — expected embedded "dataSource" grids, found none` };
	}
	return { ok: true, detail };
}

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in RESOURCES))) {
	console.error(
		`Usage: npx tsx tools/pull-real-data.ts <resource|all>\nresources: ${Object.keys(RESOURCES).join(' | ')}`
	);
	process.exit(1);
}
const selected = Object.entries(RESOURCES).filter(([name]) => target === 'all' || name === target);

let session: Session;
try {
	session = sessionFromEnv();
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
console.log(`Session configured for ${session.domain}\n`);

let failures = 0;
for (const [name, spec] of selected) {
	let result: { ok: boolean; detail: string };
	try {
		result = await checkResource(name, spec, session);
	} catch (e) {
		result = { ok: false, detail: e instanceof Error ? e.message : String(e) };
	}
	if (!result.ok) failures++;
	console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${name.padEnd(14)} ${result.detail}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
