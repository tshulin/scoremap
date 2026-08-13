import { describe, expect, it } from 'vitest';
import { formatReport, sanitizeCapture } from '../tools/lib/sanitize.js';

const CAPTURE = `<html><body>
<script>
	PXP.NavigationData = {
		"school": "Foothill High School",
		"photo": "Photos/6B/6BC5BA4D-3CF3-4BBB-9084-7EB2C2630E28_Photo.PNG",
		"SchoolName":"Pleasanton Unified"
	};
</script>
<div class="nav">Welcome, Jordan Rivera</div>
<span class="tbl_label">Student Name</span><br>Jordan Rivera
<span class="tbl_label">Perm ID</span><br>104257
<span class="tbl_label">Gender</span><br>Female
<span class="tbl_label">Grade</span><br>11
<div class="teacher">Contact: ateacher@pleasantonusd.net</div>
<script>
	var grid = { "dataSource":[{"DocumentTitle":"<a href=\\"PXP_ShowDocument.aspx?AGU=&docToken=QU9EcWg4UVJSOTVYRTR3\\">Report Card</a>"}] };
	var staffGU = "F8658D13-1579-46EC-B968-CFB627C1001F";
</script>
</body></html>`;

describe('sanitizeCapture', () => {
	const result = sanitizeCapture(CAPTURE);

	it('removes every identifying value it found', () => {
		expect(result.residuals).toEqual([]);
	});

	it('scrubs the student name everywhere it appears, not just the field table', () => {
		expect(result.html).not.toContain('Jordan');
		expect(result.html).not.toContain('Rivera');
		expect(result.html).toContain('Sample Student');
		expect(result.html).toContain('Welcome, Sample Student');
	});

	it('scrubs the perm id, school, photo path, email, GUID and docToken', () => {
		expect(result.html).not.toContain('104257');
		expect(result.html).not.toContain('Foothill');
		expect(result.html).not.toContain('Pleasanton Unified');
		expect(result.html).not.toContain('6BC5BA4D');
		expect(result.html).not.toContain('pleasantonusd.net');
		expect(result.html).not.toContain('F8658D13');
		expect(result.html).not.toContain('QU9EcWg4UVJSOTVYRTR3');
	});

	it('preserves the structure the parsers depend on', () => {
		expect(result.html).toContain('<span class="tbl_label">Student Name</span><br>');
		expect(result.html).toContain('"dataSource":[');
		expect(result.html).toContain('docToken=');
		expect(result.html).toContain('Female');
		expect(result.html).toContain('Report Card');
	});

	it('produces output the real parsers still understand', async () => {
		const { parseLabeledFields, bootstrapValue } = await import('../src/extract/index.js');

		expect(parseLabeledFields(result.html)).toMatchObject({
			'Student Name': 'Sample Student',
			'Perm ID': '999001'
		});
		expect(bootstrapValue(result.html, 'school')).toBe('Example High School');
	});

	it('is deterministic', () => {
		expect(sanitizeCapture(CAPTURE).html).toBe(result.html);
	});

	it('reports what it replaced without ever printing the real values', () => {
		const report = formatReport(result);

		expect(report).toContain('student name');
		expect(report).toContain('Sample Student');
		expect(report).not.toContain('Jordan');
		expect(report).not.toContain('104257');
	});

	it('scrubs an email even without labeled student fields', () => {
		const withStrayEmail = sanitizeCapture('<html>contact stray@district.org</html>');

		expect(withStrayEmail.html).toContain('teacher1@example.edu');
		expect(withStrayEmail.warnings).toEqual([]);
	});

	it('leaves a non-capture untouched and says so', () => {
		const result = sanitizeCapture('<html><body>nothing personal</body></html>');

		expect(result.replacements).toEqual([]);
		expect(formatReport(result)).toContain('none');
	});
});
