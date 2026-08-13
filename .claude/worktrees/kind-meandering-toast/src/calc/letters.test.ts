import { describe, expect, it } from 'vitest';
import { inferScale, mergeObservations, resolveLetter } from './letters';

describe('inferScale / resolveLetter', () => {
	it('resolves against the default scale with no observations', () => {
		const scale = inferScale([]);

		expect(resolveLetter(98, scale)).toBe('A+');
		expect(resolveLetter(95, scale)).toBe('A');
		expect(resolveLetter(84.9, scale)).toBe('B');
		expect(resolveLetter(59, scale)).toBe('F');
	});

	it('a single low observation drags that letter’s bound down', () => {
		const scale = inferScale([{ pct: 84, letter: 'A' }]);
		const a = scale.find((r) => r.letter === 'A')!;

		expect(a).toMatchObject({ lowerBound: 84, source: 'observed' });
		expect(resolveLetter(85, scale)).toBe('A');
	});

	it('enforces monotonicity below an observed bound', () => {
		const scale = inferScale([{ pct: 84, letter: 'A' }]);

		// A- and B+ default above 84 — they must be clamped under A's bound.
		for (let i = 1; i < scale.length; i++) {
			expect(scale[i]!.lowerBound).toBeLessThanOrEqual(scale[i - 1]!.lowerBound);
		}
		expect(resolveLetter(83.5, scale)).toBe('B');
	});

	it('observations above the default bound change nothing', () => {
		const scale = inferScale([{ pct: 96, letter: 'A' }]);

		expect(scale.find((r) => r.letter === 'A')).toMatchObject({
			lowerBound: 93,
			source: 'default'
		});
	});

	it('overrides win over observations and defaults', () => {
		const scale = inferScale([{ pct: 84, letter: 'A' }], { A: 92 });

		expect(scale.find((r) => r.letter === 'A')).toMatchObject({
			lowerBound: 92,
			source: 'custom'
		});
	});

	it('ignores junk observations', () => {
		const scale = inferScale([
			{ pct: NaN, letter: 'A' },
			{ pct: 80, letter: '' },
			{ pct: 85, letter: 'Z+' }
		]);

		expect(scale.every((r) => r.source === 'default')).toBe(true);
	});
});

describe('mergeObservations', () => {
	it('keeps one observation per letter — the lowest percentage seen', () => {
		const merged = mergeObservations(
			[{ pct: 90, letter: 'A' }],
			[
				{ pct: 84, letter: 'A' },
				{ pct: 96, letter: 'A' },
				{ pct: 85, letter: 'B' },
				{ pct: 70, letter: 'not-a-letter' }
			]
		);

		expect(merged).toEqual([
			{ pct: 84, letter: 'A' },
			{ pct: 85, letter: 'B' }
		]);
	});
});
