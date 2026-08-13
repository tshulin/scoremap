/**
 * verify-fixtures.mjs
 * ---------------------------------------------------------------------------
 * Parse the mock fixtures through the SAME client-side code path the app uses
 * (wrapEnvelope -> unwrapEnvelope -> parseResult / parseGradebookXML) and assert
 * they produce the shapes the UI expects. Catches malformed fixtures BEFORE they
 * crash the browser (e.g. a Course missing _CourseName, which the sidebar reads).
 *
 * By default it checks the app's mock data in src/lib/mocks/data. Pass a folder
 * to check a different set (e.g. the reference fixtures):
 *   bun functionality/scripts/verify-fixtures.mjs functionality/fixtures
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	wrapEnvelope,
	unwrapEnvelope,
	parseResult,
	parseGradebookXML,
	Operation
} from '../../src/lib/synergy.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..', '..');
const dir = process.argv[2]
	? path.resolve(process.cwd(), process.argv[2])
	: path.join(repoRoot, 'src/lib/mocks/data');

const removeCourseType = (name) => name.replace(/ \([A-Z]+\)$/, ''); // mirrors src/lib/index.ts

async function read(file) {
	return fs.readFile(path.join(dir, file), 'utf8');
}
// MSW wraps the fixture in a SOAP envelope; the client unwraps + parses it.
const roundTrip = (raw) => parseResult(unwrapEnvelope(wrapEnvelope(raw, Operation.Request), Operation.Request));

let failures = 0;
const ok = (m) => console.log('  OK   ' + m);
const bad = (m) => {
	console.log('  FAIL ' + m);
	failures++;
};

console.log(`Verifying fixtures in ${dir}\n`);

// Documents (filename may be StudentDocuments.xml in the app, Documents.xml in reference set)
try {
	const raw = await read('StudentDocuments.xml').catch(() => read('Documents.xml'));
	const list = roundTrip(raw).StudentDocuments?.StudentDocumentDatas?.StudentDocumentData;
	const arr = Array.isArray(list) ? list : list ? [list] : [];
	if (arr.length && arr.every((d) => d._DocumentGU && d._DocumentType && d._DocumentComment))
		ok(`Documents: ${arr.length} rows with required fields`);
	else bad('Documents: missing rows or required fields (_DocumentGU/_DocumentType/_DocumentComment)');
} catch (e) {
	bad('Documents: ' + e.message);
}

// Gradebook — the crash-prone one. Every Course needs _CourseName and _CourseID.
try {
	const raw = await read('Gradebook.xml');
	const gb = parseGradebookXML(unwrapEnvelope(wrapEnvelope(raw, Operation.Request), Operation.Request));
	const courses = gb.Courses.Course;
	if (!Array.isArray(courses) || courses.length === 0) throw new Error('Courses.Course is not a non-empty array');
	for (const c of courses) {
		if (typeof c._CourseName !== 'string') throw new Error(`Course ${c._CourseID} missing _CourseName (sidebar will crash)`);
		if (typeof c._CourseID !== 'string') throw new Error('a Course is missing _CourseID');
		removeCourseType(c._CourseName); // must not throw
	}
	if (typeof gb.ReportingPeriod?._Index !== 'string') throw new Error('missing top-level ReportingPeriod._Index');
	ok(`Gradebook: ${courses.length} courses, all with _CourseName/_CourseID; ReportingPeriod._Index=${gb.ReportingPeriod._Index}`);
} catch (e) {
	bad('Gradebook: ' + e.message);
}

// The remaining fixtures just need to parse without throwing.
for (const f of ['StudentInfo.xml', 'Attendance.xml', 'DocumentData.xml', 'SynergyMailDataXML.xml', 'AttachmentXML.xml']) {
	try {
		await read(f).then(roundTrip);
		ok(`${f} parses`);
	} catch (e) {
		// Missing optional reference files are not failures.
		if (e.code === 'ENOENT') console.log(`  --   ${f} not present (skipped)`);
		else bad(`${f}: ${e.message}`);
	}
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
