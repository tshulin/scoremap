export {
	courseGrade,
	courseGradeFromCategories,
	courseGradeFromTotals,
	gradePercentage,
	gradesMatch,
	markGrade
} from './grade.js';

export { assignmentImpacts, hiddenPoints } from './impact.js';
export type { AssignmentImpact, PointDiscrepancy } from './impact.js';

export {
	addToCategory,
	isCalculable,
	isCategorized,
	pointsByCategory,
	pointTotals
} from './points.js';
export type { CalculableAssignment, CategorizedAssignment, Points } from './points.js';

export { pointsNeededForTargetGrade } from './target.js';
export type { TargetGradeOptions } from './target.js';
