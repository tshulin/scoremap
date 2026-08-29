import { describe, expect, it } from 'vitest';
import {
	EXTRA_CREDIT,
	EXTRA_CREDIT_NO_MAX,
	NORMAL,
	NOT_GRADED_NO_POSSIBLE
} from '../../test/fixtures/assignments';
import { assignment, graded } from '../../test/helpers/grades';
import type { Assignment } from '../domain/index';
import { rawAssignmentToDomain } from '../portal/pages/gradebook/index';
import { courseGrade } from './grade';
import { categoryKey, isCalculable, pointsByCategory, pointTotals } from './points';

describe('isCalculable', () => {
	it('accepts a graded assignment', () => {
		expect(isCalculable(graded(3, 4))).toBe(true);
	});

	it('rejects an ungraded assignment', () => {
		expect(isCalculable(assignment({ pointsPossible: 4 }))).toBe(false);
	});

	it('rejects a not-for-grading assignment', () => {
		expect(isCalculable(graded(3, 4, { notForGrade: true }))).toBe(false);
	});

	it('rejects a normal assignment with no points possible', () => {
		expect(isCalculable(assignment({ pointsEarned: 3 }))).toBe(false);
	});

	it('accepts extra credit with no points possible', () => {
		// Nothing reads pointsPossible for extra credit - it never enters the denominator -
		// so requiring it would drop the student's bonus points for no reason.
		expect(isCalculable(assignment({ pointsEarned: 3, extraCredit: true }))).toBe(true);
	});
});

describe('categoryKey', () => {
	it('normalizes case and collapses whitespace', () => {
		expect(categoryKey('  Lab   Reports ')).toBe('lab reports');
		expect(categoryKey('TESTS')).toBe(categoryKey('tests'));
	});

	it('merges differently-written spellings of one category into one bucket', () => {
		const points = pointsByCategory([
			graded(8, 10, { category: 'Tests' }),
			graded(9, 10, { category: 'tests ' })
		]);

		expect(points.get('tests')).toEqual({ pointsEarned: 17, pointsPossible: 20 });
	});
});

describe('pointTotals', () => {
	// Filtered exactly as grade.ts does it, so the gate is part of what is under test.
	const totalsOf = (assignments: Assignment[]) => pointTotals(assignments.filter(isCalculable));

	it('adds extra credit to earned but not to possible', () => {
		expect(totalsOf([graded(80, 100), graded(5, 5, { extraCredit: true })])).toEqual({
			pointsEarned: 85,
			pointsPossible: 100
		});
	});

	it('adds extra credit that has no points possible at all', () => {
		const bonus = assignment({ pointsEarned: 5, extraCredit: true });

		expect(totalsOf([graded(80, 100), bonus])).toEqual({ pointsEarned: 85, pointsPossible: 100 });
	});
});

describe('extra credit from the portal', () => {
	it('counts when the row omits ScoreMaxValue', () => {
		// Regression: PointPossible='' with no ScoreMaxValue and no total in Points leaves
		// pointsPossible undefined. isCalculable used to reject that, so the bonus points
		// silently vanished and the grade came out lower than the portal's.
		const bonus = rawAssignmentToDomain(EXTRA_CREDIT_NO_MAX);

		expect(bonus.extraCredit).toBe(true);
		expect(bonus.pointsEarned).toBe(3);
		expect(bonus.pointsPossible).toBeUndefined();
		expect(isCalculable(bonus)).toBe(true);
		expect(courseGrade([rawAssignmentToDomain(NORMAL), bonus])).toBe(150);
	});

	it('counts when the row does supply ScoreMaxValue', () => {
		const bonus = rawAssignmentToDomain(EXTRA_CREDIT);

		expect(bonus.pointsPossible).toBe(4);
		expect(courseGrade([rawAssignmentToDomain(NORMAL), bonus])).toBe(150);
	});

	it('still ignores an ungraded row with no points possible', () => {
		// The same undefined pointsPossible, but no score - this one must stay out.
		expect(isCalculable(rawAssignmentToDomain(NOT_GRADED_NO_POSSIBLE))).toBe(false);
	});
});

describe('extra credit in a weighted category', () => {
	it('raises the category above 100 without a points-possible value', () => {
		const grade = courseGrade(
			[
				graded(90, 100, { category: 'Homework' }),
				assignment({ pointsEarned: 5, extraCredit: true, category: 'Homework' })
			],
			[
				{
					name: 'Homework',
					weightPercentage: 100,
					pointsEarned: 95,
					pointsPossible: 100,
					weightedPercentage: 95,
					letter: 'A'
				}
			]
		);

		expect(grade).toBe(95);
	});
});
