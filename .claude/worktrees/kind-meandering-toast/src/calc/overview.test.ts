import { describe, expect, it } from 'vitest';
import { category, graded } from '../../test/helpers/grades';
import { courseGrade } from './grade';
import { categoryOverview } from './overview';

const rowNamed = (rows: ReturnType<typeof categoryOverview>, name: string) => {
	const row = rows.find((r) => r.name === name);
	if (!row) throw new Error(`no row ${name}`);
	return row;
};

describe('categoryOverview (weighted)', () => {
	const categories = [
		category('Homework', 30, { pointsEarned: 65, pointsPossible: 75 }),
		category('Tests', 50, { pointsEarned: 252, pointsPossible: 300 }),
		category('Finals', 20, { pointsEarned: 0, pointsPossible: 0 })
	];
	const assignments = [
		graded(65, 75, { category: 'Homework' }),
		graded(252, 300, { category: 'Tests' })
	];

	it('renormalizes effective weights over graded categories', () => {
		const rows = categoryOverview(assignments, categories);

		// Finals' 20% is on paper only; Homework's 30% is really 30/80 = 37.5%.
		expect(rowNamed(rows, 'Homework').effectiveWeightPct).toBeCloseTo(37.5);
		expect(rowNamed(rows, 'Tests').effectiveWeightPct).toBeCloseTo(62.5);
		expect(rowNamed(rows, 'Finals').effectiveWeightPct).toBe(0);
		expect(rowNamed(rows, 'Finals').currentPct).toBeNull();
		expect(rowNamed(rows, 'Finals').nominalWeightPct).toBe(20);
	});

	it('contributions sum to the course grade', () => {
		const rows = categoryOverview(assignments, categories);
		const total = rows.reduce((n, r) => n + r.contributionPct, 0);

		expect(total).toBeCloseTo(courseGrade(assignments, categories));
	});

	it('surfaces hidden points when declared totals exceed visible assignments', () => {
		const withHidden = [
			category('Homework', 30, { pointsEarned: 65, pointsPossible: 75 }),
			category('Tests', 50, { pointsEarned: 260, pointsPossible: 320 })
		];
		const rows = categoryOverview(assignments, withHidden);

		expect(rowNamed(rows, 'Tests').hidden).toEqual({ pointsEarned: 8, pointsPossible: 20 });
		expect(rowNamed(rows, 'Homework').hidden).toBeUndefined();
	});

	it('an all-empty weighted class contributes zero everywhere', () => {
		const rows = categoryOverview([], categories.map((c) => ({ ...c, pointsEarned: 0, pointsPossible: 0 })));

		for (const row of rows) {
			expect(row.effectiveWeightPct).toBe(0);
			expect(row.contributionPct).toBe(0);
		}
	});
});

describe('categoryOverview (unweighted)', () => {
	it('effective weight is the share of total points', () => {
		const assignments = [
			graded(47, 50, { category: 'Labs' }),
			graded(45, 50, { category: 'Quizzes' })
		];

		const rows = categoryOverview(assignments);

		expect(rowNamed(rows, 'Labs').effectiveWeightPct).toBeCloseTo(50);
		expect(rowNamed(rows, 'Labs').nominalWeightPct).toBeNull();
		expect(rows.reduce((n, r) => n + r.contributionPct, 0)).toBeCloseTo(
			courseGrade(assignments)
		);
	});

	it('buckets uncategorized work under All and handles extra credit', () => {
		const assignments = [
			graded(47, 50),
			graded(4, 4, { extraCredit: true, category: 'Labs' }),
			graded(45, 50, { category: 'Labs' })
		];

		const rows = categoryOverview(assignments);

		expect(rowNamed(rows, 'All').pointsPossible).toBe(50);
		// Extra credit raises earned without possible: 49/50 in Labs.
		expect(rowNamed(rows, 'Labs').pointsEarned).toBe(49);
		expect(rowNamed(rows, 'Labs').pointsPossible).toBe(50);
		expect(rows.reduce((n, r) => n + r.contributionPct, 0)).toBeCloseTo(
			courseGrade(assignments)
		);
	});

	it('an empty class yields no rows', () => {
		expect(categoryOverview([])).toEqual([]);
	});
});
