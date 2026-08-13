import { describe, expect, it } from 'vitest';
import { category, graded } from '../../test/helpers/grades';
import { gradeBounds } from './bounds';

describe('gradeBounds (unweighted)', () => {
	it('zero remaining work reproduces the current grade exactly', () => {
		const bounds = gradeBounds({
			assignments: [graded(90, 100)],
			remaining: [{ pointsRemaining: 0, minPct: 0, maxPct: 100 }]
		});

		expect(bounds.min).toBe(90);
		expect(bounds.max).toBe(90);
	});

	it('brackets the final grade by best and worst remaining performance', () => {
		const bounds = gradeBounds({
			assignments: [graded(80, 100)],
			remaining: [{ pointsRemaining: 100, minPct: 50, maxPct: 100 }]
		});

		expect(bounds.min).toBeCloseTo(65); // (80 + 50) / 200
		expect(bounds.max).toBeCloseTo(90); // (80 + 100) / 200
		expect(bounds.perCategory).toEqual([
			{ name: 'All', min: expect.closeTo(65), max: expect.closeTo(90) }
		]);
	});

	it('min = max collapses the interval', () => {
		const bounds = gradeBounds({
			assignments: [graded(80, 100)],
			remaining: [{ pointsRemaining: 100, minPct: 70, maxPct: 70 }]
		});

		expect(bounds.min).toBeCloseTo(75);
		expect(bounds.max).toBeCloseTo(75);
	});
});

describe('gradeBounds (weighted)', () => {
	const categories = [category('Homework', 80), category('Finals', 20)];
	const assignments = [graded(90, 100, { category: 'Homework' })];

	it('remaining points in an empty category pull its weight in', () => {
		const bounds = gradeBounds({
			assignments,
			categories,
			remaining: [{ category: 'Finals', pointsRemaining: 100, minPct: 0, maxPct: 100 }]
		});

		// Bombing finals: 0.9·80 + 0·20 = 72. Acing them: 72 + 20 = 92.
		expect(bounds.min).toBeCloseTo(72);
		expect(bounds.max).toBeCloseTo(92);

		const finals = bounds.perCategory.find((c) => c.name === 'Finals')!;
		expect(finals.min).toBeCloseTo(0);
		expect(finals.max).toBeCloseTo(100);
		const homework = bounds.perCategory.find((c) => c.name === 'Homework')!;
		expect(homework.min).toBeCloseTo(90);
		expect(homework.max).toBeCloseTo(90);
	});

	it('no remaining work anywhere reproduces the current renormalized grade', () => {
		const bounds = gradeBounds({ assignments, categories, remaining: [] });

		expect(bounds.min).toBeCloseTo(90);
		expect(bounds.max).toBeCloseTo(90);
	});

	it('min never exceeds max', () => {
		const bounds = gradeBounds({
			assignments,
			categories,
			remaining: [
				{ category: 'Homework', pointsRemaining: 50, minPct: 40, maxPct: 95 },
				{ category: 'Finals', pointsRemaining: 200, minPct: 55, maxPct: 85 }
			]
		});

		expect(bounds.min).toBeLessThanOrEqual(bounds.max);
	});
});

describe('gradeBounds (validation)', () => {
	it('rejects negative remaining points and inverted percent ranges', () => {
		expect(() =>
			gradeBounds({
				assignments: [],
				remaining: [{ pointsRemaining: -1, minPct: 0, maxPct: 100 }]
			})
		).toThrow();
		expect(() =>
			gradeBounds({
				assignments: [],
				remaining: [{ pointsRemaining: 10, minPct: 80, maxPct: 20 }]
			})
		).toThrow();
	});
});
