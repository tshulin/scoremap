export {
	courseGrade,
	courseGradeFromCategories,
	courseGradeFromTotals,
	gradePercentage,
	gradesMatch,
	markGrade
} from './grade';

export { assignmentImpacts, hiddenPoints, withHiddenAssignments } from './impact';
export type { AssignmentImpact, PointDiscrepancy } from './impact';

export {
	addToCategory,
	categoryKey,
	isCalculable,
	isCategorized,
	pointsByCategory,
	pointTotals
} from './points';
export type { CalculableAssignment, CategorizedAssignment, Points } from './points';

export { pointsNeededForTargetGrade } from './target';
export type { TargetGradeOptions } from './target';

export { gradeSeries } from './series';
export type { GradePoint } from './series';

export { categoryOverview } from './overview';
export type { CategoryOverviewRow } from './overview';

export { solveUniformTarget } from './multiTarget';
export type { TargetSelection, UniformTargetOptions, UniformTargetResult } from './multiTarget';

export { gradeBounds } from './bounds';
export type { GradeBounds, GradeBoundsOptions, RemainingWork } from './bounds';

export { DEFAULT_SCALE, LETTER_ORDER, inferScale, mergeObservations, resolveLetter } from './letters';
export type { Letter, Observation, ScaleRow } from './letters';

export { GPA_GRADES, gpaPoints, isWeightedCourseName, semesterGpa, toGpaGrade } from './gpa';
export type { GpaCourse, GpaGrade, SemesterGpa } from './gpa';
