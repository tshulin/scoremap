import { describe, expect, it } from 'vitest';
import { assignment, category, graded } from '../../test/helpers/grades';
import { courseGrade } from './grade';
import { solveUniformTarget, type UniformTargetResult } from './multiTarget';

const solved = (result: UniformTargetResult) => {
	if (!('uniformPct' in result)) throw new Error(`expected a solution, got ${JSON.stringify(result)}`);
	return result;
};

// The pattern the old target.ts suite used: every answer must survive being
// substituted back into courseGrade.
const substituteBack = (
	result: ReturnType<typeof solved>,
	selections: { assignment: ReturnType<typeof assignment> }[],
	others: ReturnType<typeof assignment>[],
	categories?: ReturnType<typeof category>[]
) => {
	const byId = new Map(result.perAssignment.map((p) => [p.id, p.pointsNeeded]));
	const filled = selections.map((s) =>
		byId.has(s.assignment.id)
			? { ...s.assignment, pointsEarned: byId.get(s.assignment.id)! }
			: s.assignment
	);
	return courseGrade([...others, ...filled], categories);
};

describe('solveUniformTarget (unweighted)', () => {
	it('solves a uniform percentage across two ungraded assignments', () => {
		const others = [graded(80, 100)];
		const selections = [
			{ assignment: assignment({ pointsPossible: 50 }) },
			{ assignment: assignment({ pointsPossible: 100 }) }
		];

		const result = solved(
			solveUniformTarget({ targetPercentage: 90, selections, otherAssignments: others })
		);

		// p = (0.9·(100+150) − 80) / 150 = 96.667%
		expect(result.uniformPct).toBeCloseTo(96.667, 2);
		expect(substituteBack(result, selections, others)).toBeCloseTo(90);
	});

	it('re-solves around a locked row so the target still holds', () => {
		const others = [graded(80, 100)];
		const small = assignment({ pointsPossible: 50 });
		const big = assignment({ pointsPossible: 100 });

		const result = solved(
			solveUniformTarget({
				targetPercentage: 90,
				selections: [{ assignment: small, lockedEarned: 40 }, { assignment: big }],
				otherAssignments: others
			})
		);

		// Locking the small one at 80% pushes the rest above 100 — shown, not clamped.
		expect(result.uniformPct).toBeCloseTo(105);
		expect(result.perAssignment).toEqual([{ id: big.id, pointsNeeded: expect.closeTo(105) }]);
		expect(
			courseGrade(
				[...others, { ...small, pointsEarned: 40 }, { ...big, pointsEarned: 105 }],
				undefined
			)
		).toBeCloseTo(90);
	});

	it('locking a row at the solved value leaves the remaining solution unchanged', () => {
		const others = [graded(70, 100)];
		const a = assignment({ pointsPossible: 40 });
		const b = assignment({ pointsPossible: 60 });

		const first = solved(
			solveUniformTarget({
				targetPercentage: 85,
				selections: [{ assignment: a }, { assignment: b }],
				otherAssignments: others
			})
		);
		const aSolved = first.perAssignment.find((p) => p.id === a.id)!.pointsNeeded;
		const second = solved(
			solveUniformTarget({
				targetPercentage: 85,
				selections: [{ assignment: a, lockedEarned: aSolved }, { assignment: b }],
				otherAssignments: others
			})
		);

		expect(second.uniformPct).toBeCloseTo(first.uniformPct);
	});
});

describe('solveUniformTarget (weighted)', () => {
	it('a selection in an empty category pulls its weight into the grade', () => {
		const categories = [category('Homework', 80), category('Finals', 20)];
		const others = [graded(90, 100, { category: 'Homework' })];
		const finals = assignment({ pointsPossible: 100, category: 'Finals' });

		const result = solved(
			solveUniformTarget({
				targetPercentage: 88,
				selections: [{ assignment: finals }],
				otherAssignments: others,
				categories
			})
		);

		// grade(p) = 0.9·80 + p·20 = 88 ⟹ p = 80%
		expect(result.uniformPct).toBeCloseTo(80);
		expect(substituteBack(result, [{ assignment: finals }], others, categories)).toBeCloseTo(88);
	});
});

describe('solveUniformTarget (edges)', () => {
	it('all rows locked reports the resulting grade instead of solving', () => {
		const others = [graded(80, 100)];
		const result = solveUniformTarget({
			targetPercentage: 90,
			selections: [{ assignment: assignment({ pointsPossible: 100 }), lockedEarned: 95 }],
			otherAssignments: others
		});

		expect(result).toEqual({ allLocked: true, resultingGrade: 87.5 });
	});

	it('extra credit cannot join the uniform average unlocked', () => {
		const result = solveUniformTarget({
			targetPercentage: 90,
			selections: [{ assignment: assignment({ extraCredit: true }) }],
			otherAssignments: [graded(80, 100)]
		});

		expect(result).toMatchObject({ infeasible: true });
		expect((result as { reason: string }).reason).toContain('extra credit');
	});

	it('locked extra credit contributes its points', () => {
		const result = solveUniformTarget({
			targetPercentage: 90,
			selections: [{ assignment: assignment({ extraCredit: true }), lockedEarned: 10 }],
			otherAssignments: [graded(80, 100)]
		});

		expect(result).toEqual({ allLocked: true, resultingGrade: 90 });
	});

	it('selections that cannot move the grade are infeasible', () => {
		const result = solveUniformTarget({
			targetPercentage: 90,
			selections: [{ assignment: assignment({ pointsPossible: 10, notForGrade: true }) }],
			otherAssignments: [graded(80, 100)]
		});

		expect(result).toMatchObject({ infeasible: true });
	});
});
