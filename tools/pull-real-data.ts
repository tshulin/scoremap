// Check live page clients without printing student data.
// Usage: npx tsx tools/pull-real-data.ts <resource|all>
// Set SYNERGY_DOMAIN and either SYNERGY_COOKIE or portal credentials.

import { portalBase } from '../src/portal/base.js';
import { NoActiveGradingPeriodError, ParseError } from '../src/portal/errors.js';
import { CookieJar, fetchFollow } from '../src/portal/http.js';
import { login, validatePortalDomain, type PortalSession } from '../src/portal/login.js';
import {
	downloadDocument,
	fetchAttendance,
	fetchDocuments,
	fetchGradebook,
	fetchStudentInfo
} from '../src/portal/pages/index.js';

const present = (value: string | undefined): string => (value ? 'present' : 'MISSING');

const RESOURCES: Record<string, (session: PortalSession) => Promise<string>> = {
	'student-info': async (session) => {
		const info = await fetchStudentInfo(session);
		return `name=${present(info.name)} permId=${present(info.permId)} gender=${present(
			info.gender
		)} grade=${present(info.grade)} photo=${info.photoBase64 ? `${info.photoBase64.length}b64chars` : 'none'}`;
	},
	documents: async (session) => {
		const docs = await fetchDocuments(session);
		const categories = new Set(docs.map((doc) => doc.category));
		const withToken = docs.filter((doc) => doc.docToken !== '').length;
		const summary = `documents=${docs.length} withDocToken=${withToken} categories=${categories.size} dates=${
			docs.every((doc) => /^\d{4}-\d{2}-\d{2}$/.test(doc.uploadDate)) ? 'all ISO' : 'NOT ISO'
		}`;

		const first = docs[0];
		if (!first?.docToken) return `${summary}; no document to download`;
		const file = await downloadDocument(session, first.docToken);
		return `${summary} | download: ${file.mimeType} ${file.bytes.length}bytes name=${present(file.fileName)}`;
	},
	attendance: async (session) => {
		const attendance = await fetchAttendance(session);
		const withPeriods = attendance.absences.filter((a) => a.periods !== undefined).length;
		return `school=${present(attendance.schoolName)} absences=${attendance.absences.length} withPeriods=${withPeriods}`;
	},
	gradebook: async (session) => {
		try {
			await fetchGradebook(session);
			return 'parsed';
		} catch (e) {
			if (e instanceof NoActiveGradingPeriodError) {
				throw new Error(e.message, { cause: e });
			}
			if (!(e instanceof ParseError)) throw e;
			const { body } = await fetchFollow(
				`${portalBase(session.domain)}/PXP2_Gradebook.aspx?AGU=0`,
				{ method: 'GET' },
				session.jar
			);
			const grids = (body.match(/"dataSource":/g) ?? []).length;
			return `gradebook page rendered; dataSourceArrays=${grids}. Capture with: npx tsx tools/capture-portal-page.ts gradebook`;
		}
	}
};

async function sessionFromEnv(): Promise<{ session: PortalSession; mode: 'cookie' | 'login' }> {
	const domain = process.env.SYNERGY_DOMAIN;
	if (!domain) {
		throw new Error('Set SYNERGY_DOMAIN (e.g. "yourdistrict-psv.edupoint.com"). See env.example.');
	}
	validatePortalDomain(domain);

	const cookieString = process.env.SYNERGY_COOKIE;
	if (cookieString) {
		const jar = CookieJar.fromCookieString(cookieString);
		if (jar.size === 0) {
			throw new Error('SYNERGY_COOKIE is set but has no name=value pairs.');
		}
		return { session: { domain, jar }, mode: 'cookie' };
	}

	const username = process.env.SYNERGY_USERNAME;
	const password = process.env.SYNERGY_PASSWORD;
	if (username && password) {
		return { session: await login({ domain, username, password }), mode: 'login' };
	}

	throw new Error('Set SYNERGY_COOKIE, or SYNERGY_USERNAME + SYNERGY_PASSWORD. See env.example.');
}

const target = process.argv[2];
if (!target || (target !== 'all' && !(target in RESOURCES))) {
	console.error(
		`Usage: npx tsx tools/pull-real-data.ts <resource|all>\nresources: ${Object.keys(RESOURCES).join(' | ')}`
	);
	process.exit(1);
}
const selected = Object.entries(RESOURCES).filter(([name]) => target === 'all' || name === target);

let session: PortalSession;
let mode: string;
try {
	({ session, mode } = await sessionFromEnv());
} catch (e) {
	console.error(e instanceof Error ? e.message : String(e));
	process.exit(1);
}
console.log(`Session established for ${session.domain} (${mode} mode)\n`);

let failures = 0;
for (const [name, check] of selected) {
	try {
		console.log(`OK   ${name.padEnd(14)} ${await check(session)}`);
	} catch (e) {
		failures++;
		console.log(`FAIL ${name.padEnd(14)} ${e instanceof Error ? e.message : String(e)}`);
	}
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
