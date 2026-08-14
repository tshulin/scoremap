import { describe, expect, it } from 'vitest';
import { assignment, category, graded } from '../../test/helpers/grades';
import { courseGrade } from './grade';
import { gradeSeries } from './series';

describe('gradeSeries', () => {
	it('replays an unweighted class date by date', () => {
		const assignments = [
			graded(8, 10, { date: '2026-09-01' }),
			graded(9, 10, { date: '2026-09-08' }),
			graded(10, 10, { date: '2026-09-08' }),
			graded(5, 10, { date: '2026-09-15' })
		];

		const series = gradeSeries(assignments);

		expect(series.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
		expect(series.map((p) => p.grade)).toEqual([80, 90, 80]);
		expect(series.map((p) => p.assignments.length)).toEqual([1, 2, 1]);
	});

	it('renormalizes weighted classes as categories come online', () => {
		const categories = [category('Homework', 50), category('Tests', 50)];
		const assignments = [
			graded(10, 10, { category: 'Homework', date: '2026-09-01' }),
			graded(80, 100, { category: 'Tests', date: '2026-09-10' })
		];

		const series = gradeSeries(assignments, categories);

		// Day 1 only Homework is graded, so the grade IS the homework grade.
		expect(series.map((p) => p.grade)).toEqual([100, 90]);
	});

	it('excludes not-for-grade and ungraded assignments from the series', () => {
		const assignments = [
			graded(0, 10, { notForGrade: true, date: '2026-08-30' }),
			assignment({ pointsPossible: 10, date: '2026-08-31' }),
			graded(9, 10, { date: '2026-09-01' })
		];

		const series = gradeSeries(assignments);

		expect(series.map((p) => p.date)).toEqual(['2026-09-01']);
	});

	it('extra credit lands on its date and lifts the grade', () => {
		const assignments = [
			graded(80, 100, { date: '2026-09-01' }),
			graded(5, 5, { extraCredit: true, date: '2026-09-08' })
		];

		const series = gradeSeries(assignments);

		expect(series.map((p) => p.grade)).toEqual([80, 85]);
	});

	it('always ends at the current computed grade', () => {
		const categories = [category('Homework', 30), category('Tests', 70)];
		const assignments = [
			graded(18, 20, { category: 'Homework', date: '2026-09-01' }),
			graded(88, 100, { category: 'Tests', date: '2026-09-10' }),
			graded(4, 4, { extraCredit: true, category: 'Homework', date: '2026-09-12' })
		];

		const series = gradeSeries(assignments, categories);

		expect(series.at(-1)!.grade).toBeCloseTo(courseGrade(assignments, categories));
	});

	it('handles empty and single-point series', () => {
		expect(gradeSeries([])).toEqual([]);
		expect(gradeSeries([graded(7, 10, { date: '2026-09-01' })])).toHaveLength(1);
	});
});
