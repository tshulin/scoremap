import type { Assignment } from '../domain/index';

export interface Points {
	pointsEarned: number;
	pointsPossible: number;
}

// Extra credit never enters the denominator, so it needs no pointsPossible to be usable.
// The source shape carries one total value, which it may omit entirely.
export type CalculableAssignment = Assignment & { pointsEarned: number; notForGrade: false } & (
		{ extraCredit: true } | { extraCredit: false; pointsPossible: number }
	);

export type CategorizedAssignment = CalculableAssignment & { category: string };

// Category names can arrive from two independent tables (the weights table
// and each assignment's Type cell) whose casing and spacing can disagree, so
// every match and every map key goes through this normalization.
export function categoryKey(name: string): string {
	return name.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function isCalculable(assignment: Assignment): assignment is CalculableAssignment {
	if (assignment.notForGrade || assignment.pointsEarned === undefined) return false;
	return assignment.extraCredit || assignment.pointsPossible !== undefined;
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

// `running` is keyed by categoryKey, never the raw name.
export function addToCategory(
	running: Map<string, Points>,
	assignment: CategorizedAssignment
): void {
	const key = categoryKey(assignment.category);
	const current = running.get(key) ?? { pointsEarned: 0, pointsPossible: 0 };
	running.set(key, {
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
