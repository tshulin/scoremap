// Run the old server-side client against a live portal. This prints field
// presence and row counts only; credentials come from the SYNERGY_* variables.

import { createJar, cookieHeader } from '../../src/lib/server/synergy/http.ts';
import { login } from '../../src/lib/server/synergy/login.ts';
import * as client from '../../src/lib/server/synergy/client.ts';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '_' });
const domain = process.env.SYNERGY_DOMAIN;
if (!domain) {
	console.error('Set SYNERGY_DOMAIN.');
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

const session = await getSession();
console.log(`Session established for ${domain}\n`);

async function check(label, fn, summarize) {
	try {
		const xml = await fn();
		console.log(`OK   ${label.padEnd(12)} ${summarize(xml)}`);
	} catch (e) {
		console.log(`FAIL ${label.padEnd(12)} ${e.message}`);
	}
}

await check('StudentInfo', () => client.studentInfo(session), (xml) => {
	const info = parser.parse(xml).StudentInfo ?? {};
	// Report presence, not values.
	return `hasName=${Boolean(info.FormattedName)} hasGrade=${Boolean(info.Grade)} hasPhoto=${Boolean(info.Photo)}`;
});

await check('Documents', () => client.documents(session), (xml) => {
	let rows = parser.parse(xml).StudentDocuments?.StudentDocumentDatas?.StudentDocumentData ?? [];
	if (!Array.isArray(rows)) rows = [rows];
	const types = [...new Set(rows.map((r) => r._DocumentType))];
	return `${rows.length} documents; types=[${types.join(', ')}]`;
});

await check('Attendance', () => client.attendance(session), (xml) => {
	const a = parser.parse(xml).Attendance ?? {};
	const absences = a.Absences?.Absence;
	const n = Array.isArray(absences) ? absences.length : absences ? 1 : 0;
	return `hasSchool=${Boolean(a._SchoolName)} absences=${n}`;
});

await check('Gradebook', () => client.gradebook(session), () => 'returned data (translator implemented!)');
