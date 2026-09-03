import type { Assignment, Category } from '../domain/index';
import { courseGradeFromCategories, gradePercentage } from './grade';
import {
	addToCategory,
	categoryKey,
	isCalculable,
	isCategorized,
	pointsByCategory,
	type Points
} from './points';

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

	// An empty category list is total-points grading, same as courseGrade.
	if (categories === undefined || categories.length === 0) {
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
		const key = categoryKey(category.name);
		// A category with totals but no visible assignments is entirely hidden
		// work, not "nothing to report" - it still gets a discrepancy row.
		const seen = visible.get(key) ?? { pointsEarned: 0, pointsPossible: 0 };

		const pointsEarned = category.pointsEarned - seen.pointsEarned;
		const pointsPossible = category.pointsPossible - seen.pointsPossible;
		if (pointsEarned === 0 && pointsPossible === 0) continue;

		const before = courseGradeFromCategories(running, categories);
		running.set(key, {
			pointsEarned: category.pointsEarned,
			pointsPossible: category.pointsPossible
		});
		const gradeImpact = courseGradeFromCategories(running, categories) - before;

		if (Math.abs(gradeImpact) < EPSILON) continue;
		discrepancies.push({ category: category.name, pointsEarned, pointsPossible, gradeImpact });
	}

	return discrepancies;
}

// Category totals render at two decimals, so a sub-0.005-point gap is
// display rounding, not hidden work.
const POINT_EPSILON = 0.005;

// The stored category totals are authoritative - they include assignments the
// hides from the list. Reconcile by appending one synthetic assignment per
// category carrying the unaccounted points, so every downstream computation
// (grade, chart, impacts, target, bounds) works from the same totals the
// sample itself grades on. The synthetic rows are dated last: the chart
// absorbs the gap at its endpoint and earlier impacts stay untouched. Deltas
// can be negative (visible work exceeding the totals) - the arithmetic still
// lands each category exactly on its declared totals.
export function withHiddenAssignments(
	assignments: Assignment[],
	categories?: Category[]
): Assignment[] {
	if (categories === undefined || categories.length === 0) return assignments;

	const visible = pointsByCategory(assignments);
	let lastDate = '';
	for (const a of assignments) {
		if (isCalculable(a) && a.date > lastDate) lastDate = a.date;
	}

	const synthetic: Assignment[] = [];
	for (const category of categories) {
		const key = categoryKey(category.name);
		const seen = visible.get(key) ?? { pointsEarned: 0, pointsPossible: 0 };
		const pointsEarned = category.pointsEarned - seen.pointsEarned;
		const pointsPossible = category.pointsPossible - seen.pointsPossible;
		if (Math.abs(pointsEarned) < POINT_EPSILON && Math.abs(pointsPossible) < POINT_EPSILON) {
			continue;
		}
		synthetic.push({
			id: `hidden-${key}`,
			name: `Hidden assignments (${category.name})`,
			pointsEarned,
			pointsPossible,
			extraCredit: false,
			notForGrade: false,
			category: category.name,
			date: lastDate || new Date().toISOString().slice(0, 10)
		});
	}

	return synthetic.length === 0 ? assignments : [...assignments, ...synthetic];
}
