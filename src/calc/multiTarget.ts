import type { Assignment, Category } from '../domain/index';
import { courseGrade } from './grade';

export interface TargetSelection {
	assignment: Assignment;
	// Present = the student typed a score for this row; it is held fixed and
	// excluded from the uniform average.
	lockedEarned?: number;
}

export interface UniformTargetOptions {
	targetPercentage: number;
	selections: TargetSelection[];
	// The rest of the effective assignment list (must not include selections).
	otherAssignments: Assignment[];
	categories?: Category[];
}

export type UniformTargetResult =
	| { uniformPct: number; perAssignment: { id: string; pointsNeeded: number }[] }
	| { allLocked: true; resultingGrade: number }
	| { infeasible: true; reason: string };

const withEarned = (a: Assignment, pointsEarned: number): Assignment => ({ ...a, pointsEarned });

// Solve for the single percentage p applied to every unlocked selection such
// that the course grade hits the target. In both grading modes the course
// grade is linear in p (denominators are fixed once the selections' possible
// points are in), so two evaluations of the real courseGrade determine the
// line — no mode-specific closed forms to keep in sync with the engine.
export function solveUniformTarget(options: UniformTargetOptions): UniformTargetResult {
	const { targetPercentage, selections, otherAssignments, categories } = options;

	const locked = selections.filter((s) => s.lockedEarned !== undefined);
	const unlocked = selections.filter((s) => s.lockedEarned === undefined);

	for (const s of unlocked) {
		if (s.assignment.extraCredit) {
			return {
				infeasible: true,
				reason: `"${s.assignment.name}" is extra credit — it has no points possible to average over. Enter a score for it instead.`
			};
		}
		if (s.assignment.pointsPossible === undefined || s.assignment.pointsPossible <= 0) {
			return {
				infeasible: true,
				reason: `"${s.assignment.name}" has no points possible, so no score can move the grade.`
			};
		}
	}

	const fixed = [...otherAssignments, ...locked.map((s) => withEarned(s.assignment, s.lockedEarned!))];

	if (unlocked.length === 0) {
		return { allLocked: true, resultingGrade: courseGrade(fixed, categories) };
	}

	const gradeAt = (p: number) =>
		courseGrade(
			[...fixed, ...unlocked.map((s) => withEarned(s.assignment, p * s.assignment.pointsPossible!))],
			categories
		);

	const g0 = gradeAt(0);
	const slope = gradeAt(1) - g0;
	if (Math.abs(slope) < 1e-9) {
		return {
			infeasible: true,
			reason: 'The selected assignments cannot move the grade (they carry no weight).'
		};
	}

	const p = (targetPercentage - g0) / slope;
	return {
		uniformPct: p * 100,
		perAssignment: unlocked.map((s) => ({
			id: s.assignment.id,
			pointsNeeded: p * s.assignment.pointsPossible!
		}))
	};
}
