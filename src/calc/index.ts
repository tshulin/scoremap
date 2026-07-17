export {
	courseGrade,
	courseGradeFromCategories,
	courseGradeFromTotals,
	gradePercentage,
	gradesMatch,
	markGrade
} from './grade';

export { assignmentImpacts, hiddenPoints } from './impact';
export type { AssignmentImpact, PointDiscrepancy } from './impact';

export {
	addToCategory,
	isCalculable,
	isCategorized,
	pointsByCategory,
	pointTotals
} from './points';
export type { CalculableAssignment, CategorizedAssignment, Points } from './points';

export { pointsNeededForTargetGrade } from './target';
export type { TargetGradeOptions } from './target';
