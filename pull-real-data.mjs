// Smoke-test the portal without printing any personal values.
// Usage: bun scripts/pull-real-data.mjs <resource|all>
//
import { getSessionFromEnv } from './lib/session.mjs';
import { fetchFollow } from './lib/http.mjs';
import { countDataSourceArrays } from './lib/inspect.mjs';

const RESOURCES = {
	'student-info': { page: 'PXP2_Student.aspx?AGU=0', expectGrids: false },
	documents: { page: 'PXP2_Documents.aspx?AGU=0', expectGrids: true },
	attendance: { page: 'PXP2_Attendance.aspx?AGU=0', expectGrids: true },
	gradebook: { page: 'PXP2_Gradebook.aspx?AGU=0', expectGrids: true }
};

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in RESOURCES))) {
	console.error(`Usage: bun scripts/pull-real-data.mjs <resource|all>\nresources: ${Object.keys(RESOURCES).join(' | ')}`);
	process.exit(1);
}
const selected = target === 'all' ? Object.entries(RESOURCES) : [[target, RESOURCES[target]]];

async function checkResource(name, { page, expectGrids }, session) {
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

let session;
try {
	session = await getSessionFromEnv();
} catch (e) {
	console.error(e.message);
	process.exit(1);
}
console.log(`Session established for ${session.domain}\n`);

let failures = 0;
for (const [name, spec] of selected) {
	let result;
	try {
		result = await checkResource(name, spec, session);
	} catch (e) {
		result = { ok: false, detail: e.message };
	}
	if (!result.ok) failures++;
	console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${name.padEnd(14)} ${result.detail}`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
