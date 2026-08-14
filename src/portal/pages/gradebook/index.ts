import type { Gradebook } from '../../../domain/index';
import { NoActiveGradingPeriodError, ParseError } from '../../errors';
import type { FetchFollowOptions } from '../../http';
import type { PortalSession } from '../../login';
import { getPage } from '../shared';

export { rawAssignmentToDomain } from './assignment';

// Period selection cannot be implemented until an active gradebook response is observed.
const gradebookPath = (_periodIndex?: number): string => 'PXP2_Gradebook.aspx?AGU=0';

export async function fetchGradebook(
	session: PortalSession,
	periodIndex?: number,
	options: FetchFollowOptions = {}
): Promise<Gradebook> {
	const page = await getPage(session, gradebookPath(periodIndex), options);

	// Out of term, the portal bounces the gradebook module to Home. This is expected,
	// not a fault - the UI shows a friendly "grades appear once the term starts" message,
	// and (with VITE_PLACEHOLDER_DATA on) the sample gradebook stands in.
	if (page.redirected) {
		throw new NoActiveGradingPeriodError('The portal has no active grading period.');
	}

	return parseGradebook(page.body);
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PARSER SLOT - implement this once a real active-term gradebook is captured.
// Everything around it is done: the domain schema, the assignment normalizer
// (rawAssignmentToDomain, which already encodes every score edge case), the sample
// data, the UI, and the grade engine. This function is the only missing piece.
//
// HOW TO GET HERE:
//   1. When grades are back, capture the real page (see web/capture-portal.ts and
//      ADDING_REAL_DATA.md): it dumps PXP2_Gradebook.aspx (and PXP2_ClassGrades.aspx)
//      HTML to a gitignored captures/ folder.
//   2. Find the embedded DevExpress grids - search the HTML for `"dataSource":[`.
//      The courses, marks, categories, and per-assignment rows live in those arrays.
//
// TOOLS ALREADY AVAILABLE (import from '../../../extract/index' and './assignment'):
//   • findDataSourceWithKeys(html, [keyA, keyB]) -> rows[]  - pulls a grid whose rows
//       contain the given keys (use it to locate each grid by its columns).
//   • extractJsonAfter(html, '"dataSource":') -> the balanced JSON literal that follows.
//   • rawAssignmentToDomain(row) -> Assignment - DO NOT re-derive score logic; feed it a
//       raw row with the portal's assignment keys and it handles extra credit
//       (PointPossible=''), earned zeros (Point=''), "(Not For Grading)" Notes, and
//       scaled vs. unscaled points. Confirm the raw key names against the capture; it
//       reads: Point, PointPossible, ScoreCalValue, ScoreMaxValue, Points, Notes,
//       Measure, MeasureDescription, GradebookID, Type, Date, DueDate.
//   • toIsoDate(mmddyyyy), stripTags(html), validate(schema, value, what).
//
// TARGET SHAPE (validate the result with GradebookSchema before returning):
//   Gradebook {
//     reportingPeriods: ReportPeriod[] { index, name, startDate, endDate }
//     currentPeriodIndex: number        // which period THIS payload is for
//     courses: Course[] {
//       courseId, name, title, period, room, staff{name,email?}, marks: Mark[] {
//         name, shortName, letter, percentage,
//         categories?: Category[] {      // from the GradeCalculationSummary grid, if weighted
//           name, weightPercentage, pointsEarned, pointsPossible, weightedPercentage, letter
//         },
//         assignments: Assignment[]      // each via rawAssignmentToDomain(rawRow)
//       }
//     }
//   }
//
// GOTCHAS (already handled by rawAssignmentToDomain, but verify against real rows):
//   • A course with no categories is unweighted -> the engine uses point totals.
//   • A category with weight but no graded work must stay (weightedPercentage 0); the
//     engine renormalizes over graded categories so an ungraded Finals doesn't zero the grade.
//   • Some districts render per-class assignment detail on PXP2_ClassGrades.aspx instead -
//     if the gradebook grid lacks assignment rows, fetch that page per course too.
//
// VERIFY: turn the sample off (VITE_PLACEHOLDER_DATA unset), and check a few courses'
// weighted and unweighted grades against the numbers the portal itself shows.
// ─────────────────────────────────────────────────────────────────────────────
function parseGradebook(_html: string): Gradebook {
	throw new ParseError(
		'Gradebook parsing is not implemented yet. Capture a live active-term page and fill in parseGradebook (see the guide above this function).'
	);
}
