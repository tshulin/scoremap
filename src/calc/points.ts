import type { Assignment } from '../domain/index.js';

export interface Points {
	pointsEarned: number;
	pointsPossible: number;
}

export type CalculableAssignment = Assignment & {
	pointsEarned: number;
	pointsPossible: number;
	notForGrade: false;
};

export type CategorizedAssignment = CalculableAssignment & { category: string };

export function isCalculable(assignment: Assignment): assignment is CalculableAssignment {
	return (
		assignment.pointsEarned !== undefined &&
		assignment.pointsPossible !== undefined &&
		!assignment.notForGrade
	);
}

export function isCategorized(assignment: Assignment): assignment is CategorizedAssignment {
	return isCalculable(assignment) && assignment.category !== undefined;
}

export function pointTotals(assignments: CalculableAssignment[]): Points {
	let pointsEarned = 0;
	let pointsPossible = 0;
	for (const assignment of assignments) {
		pointsEarned += assignment.pointsEarned;
		// Extra credit adds earned points without increasing the denominator.
		if (!assignment.extraCredit) pointsPossible += assignment.pointsPossible;
	}
	return { pointsEarned, pointsPossible };
}

export function addToCategory(
	running: Map<string, Points>,
	assignment: CategorizedAssignment
): void {
	const current = running.get(assignment.category) ?? { pointsEarned: 0, pointsPossible: 0 };
	running.set(assignment.category, {
		pointsEarned: current.pointsEarned + assignment.pointsEarned,
		pointsPossible:
			current.pointsPossible + (assignment.extraCredit ? 0 : assignment.pointsPossible)
	});
}

export function pointsByCategory(assignments: Assignment[]): Map<string, Points> {
	const running = new Map<string, Points>();
	for (const assignment of assignments) {
		if (isCategorized(assignment)) addToCategory(running, assignment);
	}
	return running;
}
