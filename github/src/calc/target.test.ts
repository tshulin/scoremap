import { describe, expect, it } from 'vitest';
import { category, graded } from '../../test/helpers/grades';
import { courseGrade } from './grade';
import { pointsNeededForTargetGrade } from './target';

describe('pointsNeededForTargetGrade - unweighted', () => {
	it('solves for the points that hit the target', () => {
		const otherAssignments = [graded(80, 100)];

		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 100,
			otherAssignments
		});

		expect(needed).toBe(100);
		expect(courseGrade([...otherAssignments, graded(needed!, 100)])).toBeCloseTo(90);
	});

	it('returns more than the assignment is worth when the target is out of reach', () => {
		const needed = pointsNeededForTargetGrade({
			targetPercentage: 95,
			assignmentPointsPossible: 10,
			otherAssignments: [graded(50, 100)]
		});

		expect(needed).toBeCloseTo(54.5);
	});

	it('returns a negative when the target is already secured', () => {
		const needed = pointsNeededForTargetGrade({
			targetPercentage: 60,
			assignmentPointsPossible: 10,
			otherAssignments: [graded(100, 100)]
		});

		expect(needed).toBeLessThan(0);
	});

	it('solves against an empty gradebook', () => {
		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 50,
			otherAssignments: []
		});

		expect(needed).toBe(45);
		expect(courseGrade([graded(45, 50)])).toBe(90);
	});

	it('ignores work that does not count toward the grade', () => {
		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 100,
			otherAssignments: [graded(80, 100), graded(0, 100, { notForGrade: true })]
		});

		expect(needed).toBe(100);
	});
});

describe('pointsNeededForTargetGrade - weighted', () => {
	const categories = [category('Homework', 40), category('Tests', 60)];

	it('solves within the assignment’s category', () => {
		const otherAssignments = [
			graded(38, 40, { category: 'Homework' }),
			graded(50, 60, { category: 'Tests' })
		];

		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 10,
			otherAssignments,
			categories,
			assignmentCategory: 'Homework'
		});

		expect(needed).toBeCloseTo(12);
		expect(
			courseGrade([...otherAssignments, graded(needed!, 10, { category: 'Homework' })], categories)
		).toBeCloseTo(90);
	});

	it('redistributes weight from categories with no graded work', () => {
		const otherAssignments = [graded(38, 40, { category: 'Homework' })];

		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 10,
			otherAssignments,
			categories,
			assignmentCategory: 'Homework'
		});

		expect(needed).toBeCloseTo(7);
		expect(
			courseGrade([...otherAssignments, graded(needed!, 10, { category: 'Homework' })], categories)
		).toBeCloseTo(90);
	});

	it('solves for a category that has no work yet', () => {
		const otherAssignments = [graded(40, 40, { category: 'Homework' })];

		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 100,
			otherAssignments,
			categories,
			assignmentCategory: 'Tests'
		});

		expect(
			courseGrade([...otherAssignments, graded(needed!, 100, { category: 'Tests' })], categories)
		).toBeCloseTo(90);
	});

	it('gives up when the category carries no weight', () => {
		expect(
			pointsNeededForTargetGrade({
				targetPercentage: 90,
				assignmentPointsPossible: 10,
				otherAssignments: [],
				categories: [category('Homework', 0)],
				assignmentCategory: 'Homework'
			})
		).toBeUndefined();
	});

	it('gives up when the category is not one the portal weights', () => {
		expect(
			pointsNeededForTargetGrade({
				targetPercentage: 90,
				assignmentPointsPossible: 10,
				otherAssignments: [],
				categories,
				assignmentCategory: 'Mystery'
			})
		).toBeUndefined();
	});

	it('ignores extra credit when sizing the category total', () => {
		const otherAssignments = [
			graded(38, 40, { category: 'Homework' }),
			graded(3, 3, { category: 'Homework', extraCredit: true }),
			graded(50, 60, { category: 'Tests' })
		];

		const needed = pointsNeededForTargetGrade({
			targetPercentage: 90,
			assignmentPointsPossible: 10,
			otherAssignments,
			categories,
			assignmentCategory: 'Homework'
		});

		expect(
			courseGrade([...otherAssignments, graded(needed!, 10, { category: 'Homework' })], categories)
		).toBeCloseTo(90);
	});
});
