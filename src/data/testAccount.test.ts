import { describe, expect, it } from 'vitest';
import { courseGrade, gradesMatch } from '../calc/index';
import {
	AttendanceSchema,
	DocumentMetaSchema,
	GradebookSchema,
	MailMessageSchema
} from '../domain/index';
import {
	TEST_ATTENDANCE,
	TEST_DISTRICT,
	TEST_DOCUMENTS,
	TEST_GRADEBOOK,
	TEST_MAIL,
	isTestCredentials,
	testDocumentContent,
	testMailAttachmentContent
} from './testAccount.js';

const markOf = (name: string) => {
	const course = TEST_GRADEBOOK.courses.find((c) => c.name === name);
	if (!course) throw new Error(`no test course ${name}`);
	return course.marks[0]!;
};

describe('test account credentials', () => {
	it('accepts test/test at the Hustler\'s University domain', () => {
		expect(TEST_DISTRICT.domain).toBe('hustler-uni-psv.edupoint.com');
		expect(
			isTestCredentials({ domain: 'hustler-uni-psv.edupoint.com', username: 'test', password: 'test' })
		).toBe(true);
	});

	it('is forgiving about username case/whitespace, never about the password', () => {
		expect(
			isTestCredentials({ domain: TEST_DISTRICT.domain, username: ' Test ', password: 'test' })
		).toBe(true);
		expect(
			isTestCredentials({ domain: TEST_DISTRICT.domain, username: 'test', password: 'TEST' })
		).toBe(false);
	});

	it('does not hijack a real "test" user at a real district', () => {
		expect(
			isTestCredentials({ domain: 'ak-matsu-psv.edupoint.com', username: 'test', password: 'test' })
		).toBe(false);
	});
});

describe('TEST_GRADEBOOK', () => {
	it('satisfies the real domain schema', () => {
		expect(() => GradebookSchema.parse(TEST_GRADEBOOK)).not.toThrow();
	});

	it('has one course in each grade band the palette distinguishes: A, B, C, F', () => {
		const letters = TEST_GRADEBOOK.courses.map((c) => c.marks[0]!.letter);
		expect(letters.sort()).toEqual(['A', 'B', 'C', 'F']);
	});

	it('the percentage the portal claims matches what calc/ computes', () => {
		for (const course of TEST_GRADEBOOK.courses) {
			for (const mark of course.marks) {
				const computed = courseGrade(mark.assignments, mark.categories);
				expect(
					gradesMatch(computed, mark.percentage),
					`${course.name} ${mark.name}: portal ${mark.percentage}, computed ${computed}`
				).toBe(true);
			}
		}
	});

	it('covers weighted and unweighted courses', () => {
		expect(markOf('AP Calculus BC').categories).toBeDefined();
		expect(markOf('Chemistry').categories).toBeDefined();
		expect(markOf('English 11 Honors').categories).toBeUndefined();
		expect(markOf('World History').categories).toBeUndefined();
	});

	it('covers the assignment states the UI has to render', () => {
		const assignments = TEST_GRADEBOOK.courses.flatMap((c) =>
			c.marks.flatMap((m) => m.assignments)
		);

		expect(assignments.some((a) => a.extraCredit)).toBe(true);
		expect(assignments.some((a) => a.notForGrade)).toBe(true);
		expect(assignments.some((a) => a.pointsEarned === undefined)).toBe(true);
		expect(assignments.some((a) => a.pointsEarned === 0 && a.pointsPossible !== 0)).toBe(true);
		expect(assignments.some((a) => a.unscaledPoints !== undefined)).toBe(true);
		expect(assignments.some((a) => a.resources !== undefined)).toBe(true);
	});

	it('spreads graded work across enough distinct dates for a chart series', () => {
		for (const course of TEST_GRADEBOOK.courses) {
			const dates = new Set(
				course.marks[0]!.assignments.filter(
					(a) => a.pointsEarned !== undefined && !a.notForGrade
				).map((a) => a.date)
			);
			expect(dates.size, `${course.name} has ${dates.size} graded dates`).toBeGreaterThanOrEqual(10);
		}
	});

	it('category totals equal the visible assignments (no accidental hidden points)', () => {
		for (const name of ['AP Calculus BC', 'Chemistry']) {
			for (const category of markOf(name).categories!) {
				const rows = markOf(name).assignments.filter(
					(a) => a.category === category.name && a.pointsEarned !== undefined && !a.notForGrade
				);
				const earned = rows.reduce((n, a) => n + a.pointsEarned!, 0);
				const possible = rows.reduce((n, a) => n + (a.extraCredit ? 0 : a.pointsPossible!), 0);
				expect(earned, `${name} ${category.name} earned`).toBe(category.pointsEarned);
				expect(possible, `${name} ${category.name} possible`).toBe(category.pointsPossible);
			}
		}
	});
});

describe('TEST_ATTENDANCE and TEST_DOCUMENTS', () => {
	it('attendance satisfies the domain schema and covers the status kinds', () => {
		expect(() => AttendanceSchema.parse(TEST_ATTENDANCE)).not.toThrow();
		const reasons = TEST_ATTENDANCE.absences.flatMap((a) => [
			a.reason,
			...(a.periods || []).map((p) => p.reason)
		]);
		for (const kind of ['Excused', 'Unexcused', 'Tardy']) {
			expect(reasons.some((r) => r && r.includes(kind)), kind).toBe(true);
		}
	});

	it('documents satisfy the domain schema and span several categories', () => {
		for (const doc of TEST_DOCUMENTS) {
			expect(() => DocumentMetaSchema.parse(doc)).not.toThrow();
		}
		const categories = new Set(TEST_DOCUMENTS.map((d) => d.category));
		expect(categories.size).toBeGreaterThanOrEqual(4);
		expect(categories.has('Report Card')).toBe(true);
		expect(categories.has('Transcript')).toBe(true);
	});

	it('every document downloads as a PDF', () => {
		for (const doc of TEST_DOCUMENTS) {
			const { bytes, mimeType, fileName } = testDocumentContent(doc.docToken);
			expect(mimeType).toBe('application/pdf');
			expect(fileName.endsWith('.pdf')).toBe(true);
			expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
			expect(new TextDecoder().decode(bytes.slice(-5))).toBe('%%EOF');
		}
	});

	it('rejects an unknown document token', () => {
		expect(() => testDocumentContent('NOPE')).toThrow();
	});
});

describe('TEST_MAIL', () => {
	it('satisfies the domain schema', () => {
		for (const message of TEST_MAIL) {
			expect(() => MailMessageSchema.parse(message)).not.toThrow();
		}
	});

	it('covers the states the UI renders: links, attachments, multiples, and neither', () => {
		expect(TEST_MAIL.some((m) => m.links.length === 0 && m.attachments.length > 0)).toBe(true);
		expect(TEST_MAIL.some((m) => m.links.length > 0 && m.attachments.length === 0)).toBe(true);
		expect(TEST_MAIL.some((m) => m.links.length > 1 && m.attachments.length > 1)).toBe(true);
	});

	it('message ids are unique (they are route params)', () => {
		expect(new Set(TEST_MAIL.map((m) => m.id)).size).toBe(TEST_MAIL.length);
	});

	it('every attachment downloads as a PDF named after itself', () => {
		for (const message of TEST_MAIL) {
			for (const attachment of message.attachments) {
				const { bytes, mimeType, fileName } = testMailAttachmentContent(attachment.token);
				expect(mimeType).toBe('application/pdf');
				expect(fileName).toBe(attachment.name);
				expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
			}
		}
	});

	it('rejects an unknown attachment token', () => {
		expect(() => testMailAttachmentContent('NOPE')).toThrow();
	});
});
