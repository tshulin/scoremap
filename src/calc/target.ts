import type { Assignment, Category } from '../domain/index';
import {
	categoryKey,
	isCalculable,
	isCategorized,
	pointTotals,
	type CategorizedAssignment,
	type Points
} from './points';

interface CommonOptions {
	targetPercentage: number;
	assignmentPointsPossible: number;
	otherAssignments: Assignment[];
}

interface WeightedOptions extends CommonOptions {
	categories: Category[];
	assignmentCategory: string;
}

interface UnweightedOptions extends CommonOptions {
	categories?: undefined;
	assignmentCategory?: undefined;
}

export type TargetGradeOptions = WeightedOptions | UnweightedOptions;

export function pointsNeededForTargetGrade(options: TargetGradeOptions): number | undefined {
	const targetProportion = options.targetPercentage / 100;

	// An empty category list is total-points grading, same as courseGrade.
	if (options.categories === undefined || options.categories.length === 0) {
		const { pointsEarned, pointsPossible } = pointTotals(
			options.otherAssignments.filter(isCalculable)
		);
		const totalPossible = pointsPossible + options.assignmentPointsPossible;
		return targetProportion * totalPossible - pointsEarned;
	}

	const { categories, assignmentCategory, otherAssignments, assignmentPointsPossible } = options;

	const targetKey = categoryKey(assignmentCategory);
	const targetWeight = categories.find(
		(category) => categoryKey(category.name) === targetKey
	)?.weightPercentage;
	if (targetWeight === undefined || targetWeight === 0) return undefined;

	const otherPoints = new Map<string, Points>();
	for (const assignment of otherAssignments) {
		if (!isCategorized(assignment)) continue;
		const key = categoryKey(assignment.category);
		const current = otherPoints.get(key) ?? { pointsEarned: 0, pointsPossible: 0 };
		otherPoints.set(key, {
			pointsEarned: current.pointsEarned + assignment.pointsEarned,
			pointsPossible:
				current.pointsPossible + (assignment.extraCredit ? 0 : assignment.pointsPossible)
		});
	}

	// Empty categories do not contribute weight to the current grade.
	let otherWeight = 0;
	let otherWeightedProportion = 0;
	for (const category of categories) {
		if (categoryKey(category.name) === targetKey) continue;
		const points = otherPoints.get(categoryKey(category.name));
		if (!points || points.pointsPossible === 0) continue;
		otherWeight += category.weightPercentage;
		otherWeightedProportion +=
			(points.pointsEarned / points.pointsPossible) * category.weightPercentage;
	}

	const countedWeight = otherWeight + targetWeight;

	const neededWeightedProportion = targetProportion * countedWeight - otherWeightedProportion;
	const neededCategoryProportion = neededWeightedProportion / targetWeight;

	const categoryOther = pointTotals(
		otherAssignments.filter(
			(assignment): assignment is CategorizedAssignment =>
				isCategorized(assignment) && categoryKey(assignment.category) === targetKey
		)
	);
	const categoryTotalPossible = categoryOther.pointsPossible + assignmentPointsPossible;

	return neededCategoryProportion * categoryTotalPossible - categoryOther.pointsEarned;
}
