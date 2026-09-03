import type { Assignment, Category, Mark } from '../domain/index';
import { categoryKey, isCalculable, pointsByCategory, pointTotals, type Points } from './points';

export function gradePercentage(pointsEarned: number, pointsPossible: number): number {
	const percentage = (pointsEarned / pointsPossible) * 100;
	return Number.isFinite(percentage) ? percentage : 0;
}

export function courseGradeFromTotals(assignments: Assignment[]): number {
	const { pointsEarned, pointsPossible } = pointTotals(assignments.filter(isCalculable));
	return gradePercentage(pointsEarned, pointsPossible);
}

export function courseGradeFromCategories(
	points: Map<string, Points>,
	categories: Category[]
): number {
	let weightedTotal = 0;
	let includedWeight = 0;

	for (const [key, categoryPoints] of points) {
		const category = categories.find((candidate) => categoryKey(candidate.name) === key);
		if (!category) continue;
		if (categoryPoints.pointsPossible === 0) continue;

		weightedTotal +=
			(categoryPoints.pointsEarned / categoryPoints.pointsPossible) * category.weightPercentage;
		includedWeight += category.weightPercentage;
	}

	if (includedWeight === 0) return 0;
	const percentage = (weightedTotal / includedWeight) * 100;
	return Number.isFinite(percentage) ? percentage : 0;
}

export function courseGrade(assignments: Assignment[], categories?: Category[]): number {
	// An empty category list means the same as none - straight points. Weighted
	// math over zero categories would zero the grade, and the overview already
	// treats the two alike.
	return categories === undefined || categories.length === 0
		? courseGradeFromTotals(assignments)
		: courseGradeFromCategories(pointsByCategory(assignments), categories);
}

export function markGrade(mark: Mark): number {
	return courseGrade(mark.assignments, mark.categories);
}

const decimalPlaces = (value: number): number => {
	const text = value.toString();
	const point = text.indexOf('.');
	return point === -1 ? 0 : text.length - point - 1;
};

const roundTo = (value: number, precision: number): number => {
	const factor = 10 ** precision;
	return Math.round(value * factor) / factor;
};

const floorTo = (value: number, precision: number): number => {
	const factor = 10 ** precision;
	return Math.floor(value * factor) / factor;
};

export function gradesMatch(computed: number, expected: number): boolean {
	const precision = Math.min(decimalPlaces(computed), decimalPlaces(expected));
	return (
		roundTo(computed, precision) === roundTo(expected, precision) ||
		floorTo(computed, precision) === floorTo(expected, precision)
	);
}
