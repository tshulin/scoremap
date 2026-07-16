// Pass the old XML fixtures through the same parsing path used by the client.
// Usage: bun functionality/scripts/verify-fixtures.mjs [fixture-directory]

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

const removeCourseType = (name) => name.replace(/ \([A-Z]+\)$/, '');

async function read(file) {
	return fs.readFile(path.join(dir, file), 'utf8');
}
const roundTrip = (raw) => parseResult(unwrapEnvelope(wrapEnvelope(raw, Operation.Request), Operation.Request));

let failures = 0;
const ok = (m) => console.log('  OK   ' + m);
const bad = (m) => {
	console.log('  FAIL ' + m);
	failures++;
};

console.log(`Verifying fixtures in ${dir}\n`);

// The app and reference fixture sets use different document filenames.
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

for (const f of ['StudentInfo.xml', 'Attendance.xml', 'DocumentData.xml', 'SynergyMailDataXML.xml', 'AttachmentXML.xml']) {
	try {
		await read(f).then(roundTrip);
		ok(`${f} parses`);
	} catch (e) {
		// Reference fixture sets do not always include these files.
		if (e.code === 'ENOENT') console.log(`  --   ${f} not present (skipped)`);
		else bad(`${f}: ${e.message}`);
	}
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
