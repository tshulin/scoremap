import { describe, expect, it } from 'vitest';
import { courseGrade, gradesMatch } from '../calc/index';
import {
	AttendanceSchema,
	DocumentMetaSchema,
	GradebookSchema,
	MailMessageSchema
} from '../domain/index';
import { TEST_DISTRICT, TEST_MAIL } from './testAccount.js';
import {
	DISPLAY_ATTENDANCE,
	DISPLAY_DOCUMENTS,
	DISPLAY_GRADEBOOK,
	DISPLAY_MAIL,
	DISPLAY_STUDENT,
	displayDocumentContent,
	displayMailAttachmentContent,
	isDisplayCredentials
} from './displayAccount.js';

describe('display account credentials', () => {
	it('accepts display/display at the Hustler\'s University domain', () => {
		expect(
			isDisplayCredentials({ domain: TEST_DISTRICT.domain, username: 'display', password: 'display' })
		).toBe(true);
	});

	it('is forgiving about username case/whitespace, never about the password', () => {
		expect(
			isDisplayCredentials({ domain: TEST_DISTRICT.domain, username: ' Display ', password: 'display' })
		).toBe(true);
		expect(
			isDisplayCredentials({ domain: TEST_DISTRICT.domain, username: 'display', password: 'DISPLAY' })
		).toBe(false);
	});

	it('does not hijack a real "display" user at a real district', () => {
		expect(
			isDisplayCredentials({ domain: 'ak-matsu-psv.edupoint.com', username: 'display', password: 'display' })
		).toBe(false);
	});
});

describe('DISPLAY_GRADEBOOK', () => {
	it('satisfies the real domain schema', () => {
		expect(() => GradebookSchema.parse(DISPLAY_GRADEBOOK)).not.toThrow();
	});

	it('is a six-course schedule spanning all three grade colors (the landing-page student)', () => {
		expect(DISPLAY_GRADEBOOK.courses).toHaveLength(6);
		const letters = DISPLAY_GRADEBOOK.courses.map((c) => c.marks[0]!.letter);
		// A → green, B → yellow, C → red (src/lib/grades.js gradeBandColor).
		expect(letters.every((l) => l === 'A' || l === 'B' || l === 'C')).toBe(true);
		expect(letters).toContain('A');
		expect(letters).toContain('B');
		expect(letters).toContain('C');
	});

	it('the percentage the portal claims matches what calc/ computes', () => {
		for (const course of DISPLAY_GRADEBOOK.courses) {
			for (const mark of course.marks) {
				const computed = courseGrade(mark.assignments, mark.categories);
				expect(
					gradesMatch(computed, mark.percentage),
					`${course.name} ${mark.name}: portal ${mark.percentage}, computed ${computed}`
				).toBe(true);
			}
		}
	});

	it('spreads graded work across enough distinct dates for a chart series', () => {
		for (const course of DISPLAY_GRADEBOOK.courses) {
			const dates = new Set(
				course.marks[0]!.assignments.filter(
					(a) => a.pointsEarned !== undefined && !a.notForGrade
				).map((a) => a.date)
			);
			expect(dates.size, `${course.name} has ${dates.size} graded dates`).toBeGreaterThanOrEqual(10);
		}
	});

	it('category totals equal the visible assignments (no accidental hidden points)', () => {
		for (const course of DISPLAY_GRADEBOOK.courses) {
			const mark = course.marks[0]!;
			if (!mark.categories) continue;
			for (const category of mark.categories) {
				const rows = mark.assignments.filter(
					(a) => a.category === category.name && a.pointsEarned !== undefined && !a.notForGrade
				);
				const earned = rows.reduce((n, a) => n + a.pointsEarned!, 0);
				const possible = rows.reduce((n, a) => n + (a.extraCredit ? 0 : a.pointsPossible!), 0);
				expect(earned, `${course.name} ${category.name} earned`).toBe(category.pointsEarned);
				expect(possible, `${course.name} ${category.name} possible`).toBe(category.pointsPossible);
			}
		}
	});

	it('assignment ids are unique across the gradebook (they key React rows)', () => {
		const ids = DISPLAY_GRADEBOOK.courses.flatMap((c) =>
			c.marks.flatMap((m) => m.assignments.map((a) => a.id))
		);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('DISPLAY_ATTENDANCE and identity', () => {
	it('attendance satisfies the domain schema with no unexcused absences', () => {
		expect(() => AttendanceSchema.parse(DISPLAY_ATTENDANCE)).not.toThrow();
		const reasons = DISPLAY_ATTENDANCE.absences.flatMap((a) => [
			a.reason,
			...(a.periods || []).map((p) => p.reason)
		]);
		expect(reasons.some((r) => r && r.includes('Unexcused'))).toBe(false);
	});

	it('has a display student identity', () => {
		expect(DISPLAY_STUDENT.name).toBeTruthy();
		expect(DISPLAY_STUDENT.grade).toBeTruthy();
	});
});

describe('DISPLAY_DOCUMENTS', () => {
	it('satisfies the domain schema and holds only the three landing-page categories', () => {
		for (const doc of DISPLAY_DOCUMENTS) {
			expect(() => DocumentMetaSchema.parse(doc)).not.toThrow();
		}
		const categories = new Set(DISPLAY_DOCUMENTS.map((d) => d.category));
		expect([...categories].sort()).toEqual(['MAP Growth Family Report', 'Report Card', 'Transcript']);
	});

	it('every document downloads as a PDF', () => {
		for (const doc of DISPLAY_DOCUMENTS) {
			const { bytes, mimeType, fileName } = displayDocumentContent(doc.docToken);
			expect(mimeType).toBe('application/pdf');
			expect(fileName.endsWith('.pdf')).toBe(true);
			expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
			expect(new TextDecoder().decode(bytes.slice(-5))).toBe('%%EOF');
		}
	});

	it('rejects an unknown document token', () => {
		expect(() => displayDocumentContent('NOPE')).toThrow();
	});
});

describe('DISPLAY_MAIL', () => {
	it('satisfies the domain schema with unique ids', () => {
		for (const message of DISPLAY_MAIL) {
			expect(() => MailMessageSchema.parse(message)).not.toThrow();
		}
		expect(new Set(DISPLAY_MAIL.map((m) => m.id)).size).toBe(DISPLAY_MAIL.length);
	});

	it('covers the states the UI renders: links, attachments, both, and neither', () => {
		expect(DISPLAY_MAIL.some((m) => m.links.length > 0 && m.attachments.length === 0)).toBe(true);
		expect(DISPLAY_MAIL.some((m) => m.links.length === 0 && m.attachments.length > 0)).toBe(true);
		expect(DISPLAY_MAIL.some((m) => m.links.length > 0 && m.attachments.length > 0)).toBe(true);
		expect(DISPLAY_MAIL.some((m) => m.links.length === 0 && m.attachments.length === 0)).toBe(true);
	});

	it('shares no senders with the test mailbox (which mirrors a real district)', () => {
		const testSenders = new Set(TEST_MAIL.map((m) => m.sender.name));
		for (const message of DISPLAY_MAIL) {
			expect(testSenders.has(message.sender.name), message.sender.name).toBe(false);
			expect(message.sender.email.endsWith('@hustler.edu'), message.sender.email).toBe(true);
		}
	});

	it('every attachment downloads as a PDF named after itself', () => {
		for (const message of DISPLAY_MAIL) {
			for (const attachment of message.attachments) {
				const { bytes, mimeType, fileName } = displayMailAttachmentContent(attachment.token);
				expect(mimeType).toBe('application/pdf');
				expect(fileName).toBe(attachment.name);
				expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
			}
		}
	});

	it('rejects an unknown attachment token', () => {
		expect(() => displayMailAttachmentContent('NOPE')).toThrow();
	});
});
