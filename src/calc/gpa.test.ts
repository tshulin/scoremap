import { describe, expect, it } from 'vitest';
import { gpaPoints, isWeightedCourseName, semesterGpa, toGpaGrade } from './gpa';

describe('gpaPoints', () => {
	it('uses the standard four-point scale for unweighted courses', () => {
		expect(gpaPoints('A')).toBe(4);
		expect(gpaPoints('B')).toBe(3);
		expect(gpaPoints('C')).toBe(2);
		expect(gpaPoints('D')).toBe(1);
		expect(gpaPoints('F')).toBe(0);
	});

	it('adds one point to passing weighted courses', () => {
		expect(gpaPoints('A', true)).toBe(5);
		expect(gpaPoints('B', true)).toBe(4);
		expect(gpaPoints('C', true)).toBe(3);
		expect(gpaPoints('D', true)).toBe(2);
	});

	it('does not add weight to a failing grade', () => {
		expect(gpaPoints('F', true)).toBe(0);
	});
});

describe('semesterGpa', () => {
	it('returns both the unweighted and weighted semester GPA', () => {
		const result = semesterGpa([
			{ grade: 'B', weighted: true },
			{ grade: 'A', weighted: true },
			{ grade: 'A', weighted: true },
			{ grade: 'A', weighted: true },
			{ grade: 'A', weighted: false },
			{ grade: 'A', weighted: false }
		]);

		expect(result?.unweighted).toBeCloseTo(3.8333, 4);
		expect(result?.weighted).toBe(4.5);
	});

	it('weights every course equally', () => {
		expect(
			semesterGpa([
				{ grade: 'A', weighted: false },
				{ grade: 'C', weighted: false }
			])
		).toEqual({ unweighted: 3, weighted: 3 });
	});

	it('returns null when there are no courses', () => {
		expect(semesterGpa([])).toBeNull();
	});
});

describe('toGpaGrade', () => {
	it('drops +/- modifiers from portal letters', () => {
		expect(toGpaGrade('A+')).toBe('A');
		expect(toGpaGrade('A-')).toBe('A');
		expect(toGpaGrade('B+')).toBe('B');
		expect(toGpaGrade('C')).toBe('C');
		expect(toGpaGrade('D-')).toBe('D');
		expect(toGpaGrade('F')).toBe('F');
	});

	it('treats E as failing', () => {
		expect(toGpaGrade('E')).toBe('F');
	});

	it('rejects ungraded and unrecognized marks', () => {
		expect(toGpaGrade('—')).toBeNull();
		expect(toGpaGrade('')).toBeNull();
		expect(toGpaGrade('P')).toBeNull();
		expect(toGpaGrade('N/A')).toBeNull();
	});
});

describe('isWeightedCourseName', () => {
	it('flags AP, IB, HN, and honors titles', () => {
		expect(isWeightedCourseName('AP Biology')).toBe(true);
		expect(isWeightedCourseName('IB Math SL')).toBe(true);
		expect(isWeightedCourseName('English 10 HN')).toBe(true);
		expect(isWeightedCourseName('Honors Chemistry')).toBe(true);
	});

	it('does not flag regular titles or embedded fragments', () => {
		expect(isWeightedCourseName('Geometry')).toBe(false);
		expect(isWeightedCourseName('Graphic Design')).toBe(false);
		expect(isWeightedCourseName('Japanese 2')).toBe(false);
	});
});
