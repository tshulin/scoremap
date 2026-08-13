import { describe, expect, it } from 'vitest';
import { assignment, category, graded } from '../../test/helpers/grades.js';
import { courseGrade, gradePercentage, gradesMatch, markGrade } from './grade.js';

describe('gradePercentage', () => {
	it('computes a percentage', () => {
		expect(gradePercentage(3, 4)).toBe(75);
	});

	it('treats "nothing graded yet" as 0 rather than NaN', () => {
		expect(gradePercentage(0, 0)).toBe(0);
	});

	it('does not leak Infinity when there are earned points but no possible ones', () => {
		expect(gradePercentage(5, 0)).toBe(0);
	});
});

describe('courseGrade — unweighted', () => {
	it('adds up points', () => {
		expect(courseGrade([graded(8, 10), graded(9, 10)])).toBe(85);
	});

	it('lets extra credit raise the grade above 100 without adding to the total', () => {
		const grade = courseGrade([graded(10, 10), graded(2, 2, { extraCredit: true })]);
		expect(grade).toBe(120);
	});

	it('ignores ungraded assignments', () => {
		expect(courseGrade([graded(8, 10), assignment({ pointsPossible: 100 })])).toBe(80);
	});

	it('ignores "not for grading" assignments', () => {
		expect(courseGrade([graded(8, 10), graded(0, 100, { notForGrade: true })])).toBe(80);
	});

	it('counts a zero score', () => {
		expect(courseGrade([graded(10, 10), graded(0, 10)])).toBe(50);
	});

	it('is 0 with no assignments', () => {
		expect(courseGrade([])).toBe(0);
	});
});

describe('courseGrade — weighted', () => {
	const categories = [category('Homework', 40), category('Tests', 60)];

	it('weights each category by its share', () => {
		const grade = courseGrade(
			[graded(10, 10, { category: 'Homework' }), graded(80, 100, { category: 'Tests' })],
			categories
		);
		expect(grade).toBeCloseTo(88);
	});

	it('renormalizes over only the categories that have points', () => {
		const grade = courseGrade([graded(9, 10, { category: 'Homework' })], categories);
		expect(grade).toBe(90);
	});

	it('excludes extra credit from the category total, so it can exceed 100', () => {
		const grade = courseGrade(
			[
				graded(10, 10, { category: 'Homework' }),
				graded(2, 2, { category: 'Homework', extraCredit: true })
			],
			categories
		);
		expect(grade).toBe(120);
	});

	it('ignores assignments in categories the portal does not weight', () => {
		const grade = courseGrade(
			[graded(9, 10, { category: 'Homework' }), graded(0, 10, { category: 'Mystery' })],
			categories
		);
		expect(grade).toBe(90);
	});

	it('ignores assignments with no category', () => {
		const grade = courseGrade([graded(9, 10, { category: 'Homework' }), graded(0, 10)], categories);
		expect(grade).toBe(90);
	});

	it('survives a category holding only extra credit', () => {
		const grade = courseGrade(
			[
				graded(9, 10, { category: 'Homework' }),
				graded(5, 5, { category: 'Tests', extraCredit: true })
			],
			categories
		);
		expect(grade).toBe(90);
		expect(Number.isFinite(grade)).toBe(true);
	});

	it('is 0 when nothing is graded', () => {
		expect(courseGrade([], categories)).toBe(0);
	});
});

describe('markGrade', () => {
	it('recomputes a weighted mark from its own data', () => {
		const grade = markGrade({
			name: 'Quarter 1',
			shortName: 'Q1',
			letter: 'B+',
			percentage: 88,
			categories: [category('Homework', 40), category('Tests', 60)],
			assignments: [
				graded(10, 10, { category: 'Homework' }),
				graded(80, 100, { category: 'Tests' })
			]
		});
		expect(grade).toBeCloseTo(88);
	});

	it('falls back to point totals for an unweighted mark', () => {
		const grade = markGrade({
			name: 'Quarter 1',
			shortName: 'Q1',
			letter: 'B',
			percentage: 85,
			assignments: [graded(85, 100)]
		});
		expect(grade).toBe(85);
	});
});

describe('gradesMatch', () => {
	it('matches at the coarser of the two precisions', () => {
		expect(gradesMatch(89.6667, 89.67)).toBe(true);
	});

	it('compares only to the precision the portal actually displays', () => {
		expect(gradesMatch(89.6667, 90)).toBe(true);
		expect(gradesMatch(89.6667, 89)).toBe(true);
		expect(gradesMatch(89.6667, 85)).toBe(false);
	});

	it('accepts a district that truncates instead of rounding', () => {
		expect(gradesMatch(89.99, 89)).toBe(true);
	});

	it('accepts a district that rounds', () => {
		expect(gradesMatch(89.6, 90)).toBe(true);
	});

	it('rejects a genuine mismatch', () => {
		expect(gradesMatch(85, 90)).toBe(false);
	});

	it('matches exact equality', () => {
		expect(gradesMatch(90, 90)).toBe(true);
	});
});
