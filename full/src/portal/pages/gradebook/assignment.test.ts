import { describe, expect, it } from 'vitest';
import {
	EXTRA_CREDIT,
	NORMAL,
	NOT_FOR_GRADING,
	NOT_GRADED,
	NOT_GRADED_NO_MAX,
	NOT_GRADED_NO_POSSIBLE,
	SCALED,
	ZERO_EMPTY_POINT,
	type RawAssignmentRow
} from '../../../../test/fixtures/assignments.js';
import { ParseError } from '../../errors.js';
import { rawAssignmentToDomain } from './assignment.js';

describe('rawAssignmentToDomain — documented edge cases', () => {
	it('Normal: 3 out of 4, counts toward the grade', () => {
		const assignment = rawAssignmentToDomain(NORMAL);

		expect(assignment.pointsEarned).toBe(3);
		expect(assignment.pointsPossible).toBe(4);
		expect(assignment.extraCredit).toBe(false);
		expect(assignment.notForGrade).toBe(false);
		expect(assignment.unscaledPoints).toBeUndefined();
	});

	it('Scaled: reports scaled 6/8 for calculation and keeps the unscaled 3/4', () => {
		expect(rawAssignmentToDomain(SCALED)).toMatchObject({
			pointsEarned: 6,
			pointsPossible: 8,
			unscaledPoints: { pointsEarned: 3, pointsPossible: 4 }
		});
	});

	it('Not Graded: no earned points, total known from ScoreMaxValue', () => {
		const assignment = rawAssignmentToDomain(NOT_GRADED);

		expect(assignment.pointsEarned).toBeUndefined();
		expect(assignment.pointsPossible).toBe(4);
		expect(assignment.extraCredit).toBe(false);
	});

	it('Not Graded without ScoreMaxValue: total recovered from the Points text', () => {
		const assignment = rawAssignmentToDomain(NOT_GRADED_NO_MAX);

		expect(assignment.pointsEarned).toBeUndefined();
		expect(assignment.pointsPossible).toBe(4);
	});

	it('Not Graded with unknown total: both points undefined', () => {
		const assignment = rawAssignmentToDomain(NOT_GRADED_NO_POSSIBLE);

		expect(assignment.pointsEarned).toBeUndefined();
		expect(assignment.pointsPossible).toBeUndefined();
	});

	it('Zero with empty Point: earns 0, not "not graded"', () => {
		expect(rawAssignmentToDomain(ZERO_EMPTY_POINT)).toMatchObject({
			pointsEarned: 0,
			pointsPossible: 4,
			notForGrade: false
		});
	});

	it('Extra Credit: flagged, and still reports its displayed total of 4', () => {
		expect(rawAssignmentToDomain(EXTRA_CREDIT)).toMatchObject({
			pointsEarned: 3,
			pointsPossible: 4,
			extraCredit: true
		});
	});

	it('Not For Grading: scored but excluded, with the prefix stripped from comments', () => {
		expect(rawAssignmentToDomain(NOT_FOR_GRADING)).toMatchObject({
			pointsEarned: 3,
			pointsPossible: 4,
			notForGrade: true,
			comments: 'Practice only'
		});
	});
});

describe('rawAssignmentToDomain — scaling', () => {
	it('does not treat an empty Point as a scaled score', () => {
		expect(rawAssignmentToDomain(ZERO_EMPTY_POINT).unscaledPoints).toBeUndefined();
	});

	it('does not treat an empty PointPossible as a scaled total', () => {
		expect(rawAssignmentToDomain(EXTRA_CREDIT).unscaledPoints).toBeUndefined();
	});

	it('records unscaled points when only the total was scaled', () => {
		expect(rawAssignmentToDomain({ ...NORMAL, PointPossible: '8', Points: '3 / 8' })).toMatchObject(
			{
				pointsPossible: 8,
				unscaledPoints: { pointsEarned: 3, pointsPossible: 4 }
			}
		);
	});

	it('omits unscaledPoints when the unscaled pair is incomplete', () => {
		const { ScoreMaxValue: _omitted, ...noMax } = SCALED;
		expect(rawAssignmentToDomain(noMax).unscaledPoints).toBeUndefined();
	});
});

describe('rawAssignmentToDomain — points possible fallbacks', () => {
	it('never mistakes earned points for the total', () => {
		const row: RawAssignmentRow = { ...NORMAL, Points: '3 / 4' };
		delete row['PointPossible'];
		delete row['ScoreMaxValue'];

		expect(rawAssignmentToDomain(row).pointsPossible).toBe(4);
	});

	it('gives up rather than guessing when the Points text is unrecognizable', () => {
		const row: RawAssignmentRow = { ...NORMAL, Points: 'see rubric' };
		delete row['PointPossible'];
		delete row['ScoreMaxValue'];

		expect(rawAssignmentToDomain(row).pointsPossible).toBeUndefined();
	});

	it('treats unparseable numbers as absent rather than emitting NaN', () => {
		expect(rawAssignmentToDomain({ ...NORMAL, Point: 'n/a' }).pointsEarned).toBeUndefined();
	});
});

describe('rawAssignmentToDomain — fields', () => {
	it('maps identity, category and dates, normalizing to ISO', () => {
		expect(rawAssignmentToDomain(NORMAL)).toMatchObject({
			id: '12345',
			name: 'Chapter 3 Problem Set',
			category: 'Homework',
			date: '2025-08-20',
			dueDate: '2025-08-22',
			description: 'Odd problems only'
		});
	});

	it('omits empty notes and descriptions rather than sending empty strings', () => {
		const assignment = rawAssignmentToDomain(NORMAL);
		expect(assignment.comments).toBeUndefined();
		expect('comments' in assignment).toBe(false);
	});

	it('keeps notes that are not the grading prefix', () => {
		expect(rawAssignmentToDomain({ ...NORMAL, Notes: 'Nice work' })).toMatchObject({
			notForGrade: false,
			comments: 'Nice work'
		});
	});

	it('throws ParseError when the date is missing or unrecognizable', () => {
		const row: RawAssignmentRow = { ...NORMAL };
		delete row['Date'];

		expect(() => rawAssignmentToDomain(row)).toThrow(ParseError);
	});
});
