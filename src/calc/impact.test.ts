import { describe, expect, it } from 'vitest';
import { assignment, category, graded } from '../../test/helpers/grades.js';
import { courseGrade } from './grade.js';
import { assignmentImpacts, hiddenPoints } from './impact.js';

describe('assignmentImpacts — unweighted', () => {
	it('reports how much each assignment moved the grade', () => {
		const first = graded(10, 10, { date: '2025-09-01' });
		const second = graded(0, 10, { date: '2025-09-02' });

		const impacts = assignmentImpacts([first, second]);

		expect(impacts[0]?.gradeImpact).toBe(100);
		expect(impacts[1]?.gradeImpact).toBe(-50);
	});

	it('walks oldest to newest regardless of the order given', () => {
		const older = graded(10, 10, { date: '2025-09-01' });
		const newer = graded(0, 10, { date: '2025-09-02' });

		const asGiven = assignmentImpacts([newer, older]);

		expect(asGiven[0]?.assignment).toBe(newer);
		expect(asGiven[0]?.gradeImpact).toBe(-50);
		expect(asGiven[1]?.gradeImpact).toBe(100);
	});

	it('leaves impact undefined for assignments that do not count', () => {
		const impacts = assignmentImpacts([
			graded(10, 10),
			assignment({ pointsPossible: 10 }),
			graded(5, 10, { notForGrade: true })
		]);

		expect(impacts[0]?.gradeImpact).toBe(100);
		expect(impacts[1]?.gradeImpact).toBeUndefined();
		expect(impacts[2]?.gradeImpact).toBeUndefined();
	});

	it('keeps accumulating across skipped assignments', () => {
		const impacts = assignmentImpacts([
			graded(10, 10, { date: '2025-09-01' }),
			assignment({ date: '2025-09-02', pointsPossible: 10 }),
			graded(0, 10, { date: '2025-09-03' })
		]);

		expect(impacts[2]?.gradeImpact).toBe(-50);
	});

	it('impacts sum to the final grade when everything counts', () => {
		const assignments = [
			graded(8, 10, { date: '2025-09-01' }),
			graded(9, 10, { date: '2025-09-02' }),
			graded(7, 10, { date: '2025-09-03' })
		];

		const total = assignmentImpacts(assignments).reduce(
			(sum, { gradeImpact }) => sum + (gradeImpact ?? 0),
			0
		);

		expect(total).toBeCloseTo(courseGrade(assignments));
	});
});

describe('assignmentImpacts — weighted', () => {
	const categories = [category('Homework', 40), category('Tests', 60)];

	it('measures impact through the category weighting', () => {
		const homework = graded(10, 10, { category: 'Homework', date: '2025-09-01' });
		const test = graded(80, 100, { category: 'Tests', date: '2025-09-02' });

		const impacts = assignmentImpacts([homework, test], categories);

		expect(impacts[0]?.gradeImpact).toBe(100);
		expect(impacts[1]?.gradeImpact).toBeCloseTo(-12);
	});

	it('skips assignments with no category in weighted mode', () => {
		const impacts = assignmentImpacts(
			[graded(10, 10, { category: 'Homework' }), graded(5, 10)],
			categories
		);

		expect(impacts[0]?.gradeImpact).toBe(100);
		expect(impacts[1]?.gradeImpact).toBeUndefined();
	});

	it('impacts sum to the final weighted grade', () => {
		const assignments = [
			graded(9, 10, { category: 'Homework', date: '2025-09-01' }),
			graded(85, 100, { category: 'Tests', date: '2025-09-02' }),
			graded(7, 10, { category: 'Homework', date: '2025-09-03' })
		];

		const total = assignmentImpacts(assignments, categories).reduce(
			(sum, { gradeImpact }) => sum + (gradeImpact ?? 0),
			0
		);

		expect(total).toBeCloseTo(courseGrade(assignments, categories));
	});
});

describe('hiddenPoints', () => {
	it('finds points the portal counts but does not itemize', () => {
		const categories = [category('Homework', 100, { pointsEarned: 45, pointsPossible: 50 })];
		const assignments = [graded(40, 45, { category: 'Homework' })];

		const [discrepancy] = hiddenPoints(categories, assignments);

		expect(discrepancy).toMatchObject({ category: 'Homework', pointsEarned: 5, pointsPossible: 5 });
		expect(discrepancy?.gradeImpact).toBeCloseTo(courseGrade(assignments, categories) * -1 + 90);
	});

	it('reports nothing when the visible work explains the totals', () => {
		const categories = [category('Homework', 100, { pointsEarned: 40, pointsPossible: 45 })];

		expect(hiddenPoints(categories, [graded(40, 45, { category: 'Homework' })])).toEqual([]);
	});

	it('ignores discrepancies too small to matter', () => {
		const categories = [
			category('Homework', 100, { pointsEarned: 40.000000001, pointsPossible: 45 })
		];

		expect(hiddenPoints(categories, [graded(40, 45, { category: 'Homework' })])).toEqual([]);
	});

	it('skips categories with no visible assignments at all', () => {
		const categories = [category('Tests', 100, { pointsEarned: 90, pointsPossible: 100 })];

		expect(hiddenPoints(categories, [graded(9, 10, { category: 'Homework' })])).toEqual([]);
	});

	it('reports negative hidden points when visible work exceeds the total', () => {
		const categories = [category('Homework', 100, { pointsEarned: 35, pointsPossible: 45 })];

		const [discrepancy] = hiddenPoints(categories, [graded(40, 45, { category: 'Homework' })]);

		expect(discrepancy?.pointsEarned).toBe(-5);
	});
});
