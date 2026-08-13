import { describe, expect, it } from 'vitest';
import { bootstrapValue, decodeEntities, parseLabeledFields, stripTags } from './html.js';

describe('decodeEntities', () => {
	it('decodes named entities', () => {
		expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;')).toBe(
			`a & b <c> "d" 'e'`
		);
		expect(decodeEntities('x&nbsp;y')).toBe('x y');
	});

	it('decodes decimal and hex numeric entities', () => {
		expect(decodeEntities('&#65;&#x42;&#x43;')).toBe('ABC');
	});

	it('leaves unknown entities untouched', () => {
		expect(decodeEntities('&notreal; &#xZZ;')).toBe('&notreal; &#xZZ;');
	});
});

describe('stripTags', () => {
	it('removes tags, decodes entities, and collapses whitespace', () => {
		expect(stripTags('<b>Report</b>&nbsp;<i>Card</i>\n  2026')).toBe('Report Card 2026');
	});
});

describe('parseLabeledFields', () => {
	const studentHtml =
		'<span class="tbl_label">Student Name</span><br>Shulin Lu' +
		'<span class="tbl_label">Perm ID</span><br>104257' +
		'<span class="tbl_label">Gender</span><br>Male' +
		'<span class="tbl_label">Grade</span><br>11';

	it('scrapes the student info table', () => {
		expect(parseLabeledFields(studentHtml)).toEqual({
			'Student Name': 'Shulin Lu',
			'Perm ID': '104257',
			Gender: 'Male',
			Grade: '11'
		});
	});

	it('tolerates extra span classes/attributes, self-closing br, and entities', () => {
		const html =
			'<span id="a" class="foo tbl_label bar">Home Address</span><br />123 Main &amp; 4th';
		expect(parseLabeledFields(html)).toEqual({ 'Home Address': '123 Main & 4th' });
	});

	it('keeps a label with an empty value', () => {
		expect(parseLabeledFields('<span class="tbl_label">Nickname</span><br></td>')).toEqual({
			Nickname: ''
		});
	});
});

describe('bootstrapValue', () => {
	const html = '{ "school": "Foothill High", "photo": "Photo\\/get?id=1", "count": 3 }';

	it('reads a string value regardless of spacing', () => {
		expect(bootstrapValue(html, 'school')).toBe('Foothill High');
	});

	it('decodes JSON escapes in the value', () => {
		expect(bootstrapValue(html, 'photo')).toBe('Photo/get?id=1');
	});

	it('returns undefined for a missing key', () => {
		expect(bootstrapValue(html, 'missing')).toBeUndefined();
	});

	it('returns undefined for a non-string value', () => {
		expect(bootstrapValue(html, 'count')).toBeUndefined();
	});

	it('does not confuse a key that is a suffix of another', () => {
		expect(bootstrapValue('{"studentGU":"A","GU":"B"}', 'GU')).toBe('B');
	});
});
