import type { Assignment, Category } from '../../src/domain/index';

let counter = 0;

export function assignment(overrides: Partial<Assignment> = {}): Assignment {
	counter++;
	return {
		id: `a${counter}`,
		name: `Assignment ${counter}`,
		extraCredit: false,
		notForGrade: false,
		date: '2025-09-01',
		...overrides
	};
}

export const graded = (
	pointsEarned: number,
	pointsPossible: number,
	overrides: Partial<Assignment> = {}
): Assignment => assignment({ pointsEarned, pointsPossible, ...overrides });

export function category(
	name: string,
	weightPercentage: number,
	overrides: Partial<Category> = {}
): Category {
	return {
		name,
		weightPercentage,
		pointsEarned: 0,
		pointsPossible: 0,
		weightedPercentage: 0,
		letter: '',
		...overrides
	};
}
