import { describe, expect, it } from 'vitest';
import {
	AssignmentSchema,
	AttendanceSchema,
	DocumentMetaSchema,
	GradebookSchema,
	PortalErrorCodeSchema,
	StudentInfoSchema,
	type Gradebook
} from './index.js';
import { IsoDateString } from './common.js';

describe('IsoDateString', () => {
	it.each(['2026-07-15', '2026-07-15T09:30:00', '2026-07-15T09:30:00.000Z'])(
		'accepts %s',
		(value) => {
			expect(IsoDateString.parse(value)).toBe(value);
		}
	);

	it.each(['7/15/2026', '15-07-2026', 'yesterday', ''])('rejects %j', (value) => {
		expect(IsoDateString.safeParse(value).success).toBe(false);
	});
});

describe('StudentInfoSchema', () => {
	it('round-trips a full record and one without a photo', () => {
		const full = {
			name: 'Jamie Rivera',
			permId: '000001',
			gender: 'Female',
			grade: '11',
			photoBase64: 'AAA='
		};
		expect(StudentInfoSchema.parse(full)).toEqual(full);

		const noPhoto = { name: 'Jamie Rivera', permId: '000001', gender: '', grade: '9' };
		expect(StudentInfoSchema.parse(noPhoto)).toEqual(noPhoto);
	});

	it('rejects a missing required field', () => {
		expect(StudentInfoSchema.safeParse({ name: 'A', permId: '1', gender: 'F' }).success).toBe(
			false
		);
	});
});

describe('DocumentMetaSchema', () => {
	it('round-trips a document row', () => {
		const doc = {
			docToken: 'cVVQ',
			title: 'Report Card',
			category: 'Report Card',
			uploadDate: '2026-01-02'
		};
		expect(DocumentMetaSchema.parse(doc)).toEqual(doc);
	});

	it('rejects a non-ISO upload date', () => {
		expect(
			DocumentMetaSchema.safeParse({
				docToken: 'x',
				title: 't',
				category: 'c',
				uploadDate: '1/2/2026'
			}).success
		).toBe(false);
	});
});

describe('AttendanceSchema', () => {
	it('accepts the common empty-absences shape', () => {
		expect(AttendanceSchema.parse({ schoolName: 'Foothill', absences: [] })).toEqual({
			schoolName: 'Foothill',
			absences: [],
			unreadableAbsences: 0
		});
	});

	it('accepts absences with optional periods', () => {
		const att = {
			schoolName: 'Foothill',
			absences: [
				{ date: '2026-03-01', reason: 'Excused', periods: [{ period: '1', reason: 'Excused' }] }
			]
		};
		expect(AttendanceSchema.parse(att)).toEqual({ ...att, unreadableAbsences: 0 });
	});

	it('always tells the client how many rows were unreadable, even when none were', () => {
		// Defaulted rather than optional, so the client never has to treat "absent" and
		// "zero" differently.
		expect(
			AttendanceSchema.parse({ schoolName: 'Foothill', absences: [] }).unreadableAbsences
		).toBe(0);
	});

	it('rejects a negative or fractional count', () => {
		const base = { schoolName: 'Foothill', absences: [] };
		expect(AttendanceSchema.safeParse({ ...base, unreadableAbsences: -1 }).success).toBe(false);
		expect(AttendanceSchema.safeParse({ ...base, unreadableAbsences: 1.5 }).success).toBe(false);
	});
});

describe('AssignmentSchema', () => {
	const base = {
		id: '1',
		name: 'HW 1',
		extraCredit: false,
		notForGrade: false,
		date: '2026-03-01'
	};

	it('accepts a normal graded assignment', () => {
		const a = { ...base, pointsEarned: 3, pointsPossible: 4, category: 'Homework' };
		expect(AssignmentSchema.parse(a)).toEqual(a);
	});

	it('accepts a not-graded assignment (points omitted)', () => {
		expect(AssignmentSchema.parse(base)).toMatchObject({ id: '1' });
	});

	it('accepts a scaled assignment with unscaledPoints', () => {
		const a = {
			...base,
			pointsEarned: 6,
			pointsPossible: 8,
			unscaledPoints: { pointsEarned: 3, pointsPossible: 4 }
		};
		expect(AssignmentSchema.parse(a)).toEqual(a);
	});

	it('accepts an extra-credit assignment flag', () => {
		expect(
			AssignmentSchema.parse({ ...base, pointsEarned: 3, pointsPossible: 4, extraCredit: true })
				.extraCredit
		).toBe(true);
	});

	it('rejects a non-boolean extraCredit', () => {
		expect(AssignmentSchema.safeParse({ ...base, extraCredit: 'yes' }).success).toBe(false);
	});
});

describe('GradebookSchema', () => {
	const gradebook: Gradebook = {
		reportingPeriods: [
			{ index: 0, name: 'Semester 1', startDate: '2025-08-14', endDate: '2025-12-19' }
		],
		currentPeriodIndex: 0,
		courses: [
			{
				courseId: '123',
				name: 'AP Calculus',
				title: 'AP Calculus (123)',
				period: '1',
				room: 'B12',
				staff: { name: 'Ms. Teacher', email: 't@school.net' },
				imageType: 'math',
				marks: [
					{
						name: 'Quarter 1',
						shortName: 'Q1',
						letter: 'A',
						percentage: 95.5,
						categories: [
							{
								name: 'Homework',
								weightPercentage: 40,
								pointsEarned: 38,
								pointsPossible: 40,
								weightedPercentage: 38,
								letter: 'A'
							}
						],
						assignments: [
							{
								id: 'g1',
								name: 'HW 1',
								pointsEarned: 3,
								pointsPossible: 4,
								extraCredit: false,
								notForGrade: false,
								category: 'Homework',
								date: '2025-08-20'
							}
						]
					}
				]
			}
		]
	};

	it('round-trips a full gradebook tree', () => {
		expect(GradebookSchema.parse(gradebook)).toEqual(gradebook);
	});

	it('accepts an unweighted course (no categories)', () => {
		const copy = structuredClone(gradebook);
		delete copy.courses[0]!.marks[0]!.categories;
		expect(GradebookSchema.safeParse(copy).success).toBe(true);
	});

	it('rejects a course whose marks are missing', () => {
		const copy = structuredClone(gradebook) as unknown as { courses: { marks?: unknown }[] };
		delete copy.courses[0]!.marks;
		expect(GradebookSchema.safeParse(copy).success).toBe(false);
	});
});

describe('PortalErrorCodeSchema', () => {
	it('accepts known codes and rejects unknown ones', () => {
		expect(PortalErrorCodeSchema.parse('NO_ACTIVE_GRADING_PERIOD')).toBe(
			'NO_ACTIVE_GRADING_PERIOD'
		);
		expect(PortalErrorCodeSchema.safeParse('WAT').success).toBe(false);
	});
});
