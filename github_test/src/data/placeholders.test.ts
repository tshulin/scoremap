import { describe, expect, it } from 'vitest';
import { courseGrade, gradesMatch, pointsNeededForTargetGrade } from '../calc/index';
import { GradebookSchema } from '../domain/index';
import { SAMPLE_GRADEBOOK } from './placeholders.js';

const courseNamed = (name: string) => {
	const course = SAMPLE_GRADEBOOK.courses.find((c) => c.name === name);
	if (!course) throw new Error(`no sample course ${name}`);
	return course.marks[0]!;
};

describe('SAMPLE_GRADEBOOK', () => {
	it('satisfies the real domain schema', () => {
		expect(() => GradebookSchema.parse(SAMPLE_GRADEBOOK)).not.toThrow();
	});

	it('covers the assignment states the UI has to render', () => {
		const assignments = SAMPLE_GRADEBOOK.courses.flatMap((c) =>
			c.marks.flatMap((m) => m.assignments)
		);

		expect(assignments.some((a) => a.extraCredit)).toBe(true);
		expect(assignments.some((a) => a.notForGrade)).toBe(true);
		expect(assignments.some((a) => a.pointsEarned === undefined)).toBe(true);
		expect(assignments.some((a) => a.pointsEarned === 0 && a.pointsPossible !== 0)).toBe(true);
		expect(assignments.some((a) => a.unscaledPoints !== undefined)).toBe(true);
		expect(assignments.some((a) => a.resources !== undefined)).toBe(true);
	});

	it('covers weighted, unweighted, and empty courses', () => {
		expect(courseNamed('Algebra II').categories).toBeDefined();
		expect(courseNamed('Biology').categories).toBeUndefined();
		expect(courseNamed('Ceramics').assignments).toHaveLength(0);
	});

	it('has a weighted category with no graded work, so renormalization is exercised', () => {
		const finals = courseNamed('Algebra II').categories?.find((c) => c.name === 'Finals');

		expect(finals?.weightPercentage).toBeGreaterThan(0);
		expect(finals?.pointsPossible).toBe(0);
	});

	it('spreads graded work across enough distinct dates for a chart series', () => {
		for (const name of ['Algebra II', 'Biology', 'AP Biology']) {
			const dates = new Set(
				courseNamed(name)
					.assignments.filter((a) => a.pointsEarned !== undefined && !a.notForGrade)
					.map((a) => a.date)
			);
			expect(dates.size, `${name} has ${dates.size} graded dates`).toBeGreaterThanOrEqual(5);
		}
	});

	it('category totals equal the visible assignments (no accidental hidden points)', () => {
		for (const category of courseNamed('Algebra II').categories!) {
			const rows = courseNamed('Algebra II').assignments.filter(
				(a) => a.category === category.name && a.pointsEarned !== undefined && !a.notForGrade
			);
			const earned = rows.reduce((n, a) => n + a.pointsEarned!, 0);
			const possible = rows.reduce((n, a) => n + (a.extraCredit ? 0 : a.pointsPossible!), 0);
			expect(earned, `${category.name} earned`).toBe(category.pointsEarned);
			expect(possible, `${category.name} possible`).toBe(category.pointsPossible);
		}
	});
});

describe('SAMPLE_GRADEBOOK feeds the grade engine', () => {
	it('the percentage the portal claims matches what calc/ computes', () => {
		// If these drift apart the frontend would show two different grades for one course.
		for (const course of SAMPLE_GRADEBOOK.courses) {
			for (const mark of course.marks) {
				if (mark.assignments.length === 0) continue;
				const computed = courseGrade(mark.assignments, mark.categories);
				expect(
					gradesMatch(computed, mark.percentage),
					`${course.name} ${mark.name}: portal ${mark.percentage}, computed ${computed}`
				).toBe(true);
			}
		}
	});

	it('renormalizes past the ungraded Finals category', () => {
		const mark = courseNamed('Algebra II');
		const grade = courseGrade(mark.assignments, mark.categories);

		// Finals holds 20% but has no work, so the grade divides by 80, not 100. Counting it
		// as a zero instead would give 68 — the bug this sample is shaped to catch.
		expect(grade).toBeCloseTo(85);
	});

	it('supports a hypothetical, which is what the frontend does with it', () => {
		const mark = courseNamed('Biology');
		const needed = pointsNeededForTargetGrade({
			targetPercentage: 95,
			assignmentPointsPossible: 40,
			otherAssignments: mark.assignments
		});

		expect(needed).toBeDefined();
		expect(Number.isFinite(needed!)).toBe(true);
	});

	it('does not render the empty course as 0%', () => {
		// courseGrade returns 0 for no work; the UI must use the empty assignment list, not
		// the number, to decide there is nothing to show.
		expect(courseNamed('Ceramics').assignments).toHaveLength(0);
	});

	it('AP Biology models a non-standard scale: an observed A at 84%', () => {
		const mark = courseNamed('AP Biology');

		expect(mark.letter).toBe('A');
		expect(gradesMatch(courseGrade(mark.assignments, mark.categories), 84)).toBe(true);
	});
});
