/**
 * generate-mock-fixtures.mjs
 * ---------------------------------------------------------------------------
 * Regenerate the SYNTHETIC MSW mock fixtures used for offline/demo development.
 * Writes to src/lib/mocks/data/ (gitignored). Run this after a fresh clone, or
 * whenever the mock data folder is empty, so the app has data to render without
 * a real StudentVUE account.
 *
 *   bun functionality/scripts/generate-mock-fixtures.mjs
 *
 * All data here is fake — no real students, IDs, or grades. The fixtures are the
 * INNER XML that the proxy would return (before SOAP-envelope wrapping); the MSW
 * handler wraps them in an envelope, and the client parses them normally.
 *
 * IMPORTANT: field names must match the parsed shapes the UI reads. In particular
 * every Course needs CourseName + CourseID (the sidebar renders them), or the app
 * crashes with "Cannot read properties of undefined (reading 'replace')".
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dir = path.join(repoRoot, 'src/lib/mocks/data');
await fs.mkdir(dir, { recursive: true });

const XMLNS =
	'xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';

// A minimal but structurally valid one-page PDF (correct xref offsets) so that
// "open document" in the UI actually renders something.
function buildPdf() {
	const enc = (s) => Buffer.from(s, 'latin1');
	const objs = [
		`<< /Type /Catalog /Pages 2 0 R >>`,
		`<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
		`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
	];
	const stream =
		'BT /F1 24 Tf 72 720 Td (GradeCompass) Tj 0 -40 Td /F1 14 Tf (Sample document from a mock fixture.) Tj ET';
	objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
	let pdf = enc('%PDF-1.4\n');
	const offsets = [];
	objs.forEach((body, i) => {
		offsets[i] = pdf.length;
		pdf = Buffer.concat([pdf, enc(`${i + 1} 0 obj\n${body}\nendobj\n`)]);
	});
	const xrefStart = pdf.length;
	let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
	for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
	xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
	return Buffer.concat([pdf, enc(xref)]).toString('base64');
}
const pdfBase64 = buildPdf();

const docs = [
	['DOC-0003', 'Official Transcript', '02/15/2026', 'Transcript', 'Official High School Transcript'],
	['DOC-0001', 'Report Card Q1', '10/28/2025', 'Report Card', 'Report Card - Quarter 1'],
	['DOC-0002', 'Report Card Q2', '01/20/2026', 'Report Card', 'Report Card - Quarter 2'],
	['DOC-0004', 'MAP Growth Report', '03/05/2026', 'MAP Growth Family Report', 'MAP Growth Family Report - Spring'],
	['DOC-0005', 'Immunization Letter', '09/01/2025', 'Health', 'Immunization Compliance Letter']
];
const docRows = docs
	.map(
		([gu, file, date, type, comment]) =>
			`    <StudentDocumentData DocumentGU="${gu}" DocumentFileName="${file}" DocumentDate="${date}" DocumentType="${type}" StudentGU="GU-DEMO-0001" DocumentComment="${comment}" />`
	)
	.join('\n');

// One reusable course template. Marks -> GradeCalculationSummary (weights) + Assignments.
const course = (period, title, name, id, room, staff, image, mark, cats, assigns) => `
		<Course Period="${period}" Title="${title}" CourseName="${name}" CourseID="${id}" Room="${room}" Staff="${staff}" StaffEMail="staff${id}@demo.net" StaffGU="GU-STAFF-${id}" ImageType="${image}" HighlightPercentageCutOffForProgressBar="70" UsesRichContent="false">
			<Marks>
				<Mark MarkName="Quarter 2" ShortMarkName="Q2" CalculatedScoreString="${mark[0]}" CalculatedScoreRaw="${mark[1]}">
					<GradeCalculationSummary>
${cats.map((c) => `						<AssignmentGradeCalc Type="${c[0]}" Weight="${c[1]}" Points="${c[2]}" PointsPossible="${c[3]}" WeightedPct="${c[4]}" CalculatedMark="${c[5]}" />`).join('\n')}
					</GradeCalculationSummary>
					<Assignments>
${assigns.map((a) => `						<Assignment GradebookID="${a[0]}" Measure="${a[1]}" Type="${a[2]}" Date="${a[3]}" DueDate="${a[3]}" Score="${a[4]}" DisplayScore="${a[4]} out of ${a[5]}" ScoreCalValue="${a[4]}" TimeSincePost="20d" TotalSecondsSincePost="1728000" ScoreMaxValue="${a[5]}" ScoreType="Raw Score" Points="${a[4]} / ${a[5]}" Point="${a[4]}" PointPossible="${a[5]}" Notes="" TeacherID="${id}" StudentID="1" MeasureDescription="" HasDropBox="false" DropStartDate="" DropEndDate="" />`).join('\n')}
					</Assignments>
				</Mark>
			</Marks>
		</Course>`;

const files = {
	'StudentDocuments.xml': `<StudentDocuments ${XMLNS} StudentGU="GU-DEMO-0001">
  <StudentDocumentDatas>
${docRows}
  </StudentDocumentDatas>
</StudentDocuments>`,

	'DocumentData.xml': `<DocumentData ${XMLNS} DocumentGU="DOC-0001" FileName="report-card.pdf" DocFileName="report-card.pdf" DocType="Document"><Base64Code>${pdfBase64}</Base64Code></DocumentData>`,

	'StudentInfo.xml': `<StudentInfo ${XMLNS} Type="StudentInfo"><FormattedName>Sample Student</FormattedName><PermID>000000</PermID><Gender>Not specified</Gender><Grade>11</Grade><Photo></Photo></StudentInfo>`,

	'Attendance.xml': `<Attendance ${XMLNS} Type="Attendance" SchoolName="Demo High School"><Absences /><TotalExcused /><TotalTardies /><TotalUnexcused /><TotalActivities /><TotalUnexcusedTardies /></Attendance>`,

	'Gradebook.xml': `<Gradebook ${XMLNS} Type="Gradebook" ErrorMessage="" HideStandardGraphInd="true" HideMarksColumnElementary="false" HidePointsColumnElementary="false" HidePercentSecondary="false" DisplayStandardsData="false" GBStandardsTabDefault="false">
	<ReportingPeriods>
		<ReportPeriod Index="0" GradePeriod="Quarter 1" StartDate="08/14/2025" EndDate="10/17/2025" />
		<ReportPeriod Index="1" GradePeriod="Quarter 2" StartDate="10/20/2025" EndDate="01/16/2026" />
	</ReportingPeriods>
	<ReportingPeriod GradePeriod="Quarter 2" Index="1" StartDate="10/20/2025" EndDate="01/16/2026" />
	<Courses>${course(1, 'Algebra II (H) (4501)', 'Algebra II (H)', '4501', '204', 'Ms. Rivera', 'math', ['A-', '91.4'], [['Tests', '60%', '264.0', '300.0', '52.8%', 'B+'], ['Homework', '40%', '96.0', '100.0', '38.4%', 'A'], ['TOTAL', '100%', '360.0', '400.0', '91.4%', 'A-']], [['1001', 'Unit 4 Test', 'Tests', '12/05/2025', '88', '100'], ['1002', 'Homework 4.3', 'Homework', '11/28/2025', '10', '10']])}${course(2, 'English 11 (2210)', 'English 11', '2210', '112', 'Mr. Okafor', 'language', ['B+', '88.2'], [['Essays', '50%', '132.0', '150.0', '44.0%', 'B+'], ['Participation', '50%', '90.0', '100.0', '45.0%', 'A-'], ['TOTAL', '100%', '222.0', '250.0', '88.8%', 'B+']], [['2001', 'Rhetoric Essay', 'Essays', '12/10/2025', '82', '100'], ['2002', 'Socratic Seminar', 'Participation', '12/03/2025', '47', '50']])}${course(3, 'Chemistry (3305)', 'Chemistry', '3305', 'Lab B', 'Dr. Chen', 'science', ['A', '95.6'], [['Labs', '45%', '140.0', '150.0', '42.0%', 'A-'], ['Exams', '55%', '191.0', '200.0', '52.5%', 'A'], ['TOTAL', '100%', '331.0', '350.0', '94.6%', 'A']], [['3001', 'Titration Lab', 'Labs', '12/08/2025', '48', '50'], ['3002', 'Stoichiometry Exam', 'Exams', '12/15/2025', '96', '100']])}
	</Courses>
</Gradebook>`,

	'SynergyMailDataXML.xml': `<SynergyMailDataXML ${XMLNS}><InboxItemListings /><DraftItemListings /><SentItemListings /></SynergyMailDataXML>`,

	'AttachmentXML.xml': `<AttachmentXML ${XMLNS}><Base64Code></Base64Code></AttachmentXML>`
};

for (const [name, content] of Object.entries(files)) {
	await fs.writeFile(path.join(dir, name), content, 'utf8');
	console.log('wrote', name, `(${content.length} bytes)`);
}
console.log(`\nDone. ${Object.keys(files).length} fixtures written to src/lib/mocks/data/`);
console.log('Validate them with: bun functionality/scripts/verify-fixtures.mjs');
