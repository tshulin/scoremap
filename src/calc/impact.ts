import type { Assignment, Category } from '../domain/index.js';
import { courseGradeFromCategories, gradePercentage } from './grade.js';
import {
	addToCategory,
	isCalculable,
	isCategorized,
	pointsByCategory,
	type Points
} from './points.js';

const EPSILON = 0.0001;

export interface AssignmentImpact {
	assignment: Assignment;
	gradeImpact: number | undefined;
}

const byDate = (a: Assignment, b: Assignment): number => a.date.localeCompare(b.date);

export function assignmentImpacts(
	assignments: Assignment[],
	categories?: Category[]
): AssignmentImpact[] {
	const chronological = assignments
		.map((assignment, index) => ({ assignment, index }))
		.sort((a, b) => byDate(a.assignment, b.assignment));

	const impacts = new Map<number, number>();

	if (categories === undefined) {
		let earned = 0;
		let possible = 0;
		for (const { assignment, index } of chronological) {
			if (!isCalculable(assignment)) continue;
			const before = gradePercentage(earned, possible);
			earned += assignment.pointsEarned;
			if (!assignment.extraCredit) possible += assignment.pointsPossible;
			impacts.set(index, gradePercentage(earned, possible) - before);
		}
	} else {
		const running = new Map<string, Points>();
		for (const { assignment, index } of chronological) {
			if (!isCategorized(assignment)) continue;
			const before = courseGradeFromCategories(running, categories);
			addToCategory(running, assignment);
			impacts.set(index, courseGradeFromCategories(running, categories) - before);
		}
	}

	return assignments.map((assignment, index) => ({
		assignment,
		gradeImpact: impacts.get(index)
	}));
}

export interface PointDiscrepancy {
	category: string;
	pointsEarned: number;
	pointsPossible: number;
	gradeImpact: number;
}

export function hiddenPoints(
	categories: Category[],
	assignments: Assignment[]
): PointDiscrepancy[] {
	const visible = pointsByCategory(assignments);
	const running = new Map(visible);
	const discrepancies: PointDiscrepancy[] = [];

	for (const category of categories) {
		const seen = visible.get(category.name);
		if (seen === undefined) continue;

		const pointsEarned = category.pointsEarned - seen.pointsEarned;
		const pointsPossible = category.pointsPossible - seen.pointsPossible;
		if (pointsEarned === 0 && pointsPossible === 0) continue;

		const before = courseGradeFromCategories(running, categories);
		running.set(category.name, {
			pointsEarned: category.pointsEarned,
			pointsPossible: category.pointsPossible
		});
		const gradeImpact = courseGradeFromCategories(running, categories) - before;

		if (Math.abs(gradeImpact) < EPSILON) continue;
		discrepancies.push({ category: category.name, pointsEarned, pointsPossible, gradeImpact });
	}

	return discrepancies;
}
