import type { Assignment, Category, Course, Gradebook } from '../../../domain/index';
import { GradebookSchema } from '../../../domain/index';
import { NoActiveGradingPeriodError, ParseError } from '../../errors';
import type { FetchFollowOptions } from '../../http';
import type { PortalSession } from '../../login';
import { getPage, validate } from '../shared';
import { assignmentRowToDomain } from './assignment';
import { parseClassDetail, type ClassDetail } from './classDetail';
import {
	parseGradebookLanding,
	parseLandingClasses,
	type GradingPeriod,
	type LandingClass
} from './landing';
import { loadControl } from './loadControl';

export { rawAssignmentToDomain } from './assignment';

// The full portal contract (endpoints, fragments, grid columns, request
// budget) is documented in scripts/plans/gradedata.md - verified live 2026-08-14, and the
// populated assignment-row shape against real posted grades on 2026-08-21
// (see GB_ROW_LIVE in gradebook.test.ts).
const LANDING = 'PXP2_Gradebook.aspx?AGU=0';
const CLASS_DETAILS = 'Gradebook_ClassDetails';
const SCHOOL_CLASSES = 'Gradebook_SchoolClasses';

// Matches the transport's per-relay connection pool (MAX_CONNECTIONS in
// fetchShim.js); more workers would only queue behind the pool.
const DETAIL_CONCURRENCY = 3;

// Progress hooks for the sync layer. `onPartial` receives a complete, valid
// Gradebook after the landing page parses (every class with its current mark,
// no assignments yet) and again as each class detail lands (that class now
// carrying its assignments) - so the app can paint grades the moment they
// exist and stream assignments in behind them. The object passed is built
// fresh each call; the final return value supersedes them all.
export interface GradebookHooks {
	onPartial?: (gradebook: Gradebook) => void;
}

// Every request is charged against a shared per-IP budget at the portal, so
// the sync fetches as little as it can prove it needs:
//   - the landing page alone carries the class list, marks, and period map;
//   - a class detail is fetched only when the landing row shows any sign of
//     posted work (mayHaveWork) - early in a term the whole sync is 1 request;
//   - all assignment rows arrive inline in the one detail response;
//   - a non-default period costs exactly one extra class-list request.
export async function fetchGradebook(
	session: PortalSession,
	periodIndex?: number,
	options: FetchFollowOptions = {},
	hooks: GradebookHooks = {}
): Promise<Gradebook> {
	const page = await getPage(session, LANDING, options);

	// Out of term, the portal bounces the gradebook module to Home. This is
	// expected, not a fault - the UI shows a friendly "grades appear once the
	// term starts" message.
	if (page.redirected) {
		throw new NoActiveGradingPeriodError('The portal has no active grading period.');
	}

	const landing = parseGradebookLanding(page.body);

	let classes = landing.classes;
	let currentIndex = landing.currentPeriodIndex;
	if (periodIndex !== undefined && periodIndex !== landing.currentPeriodIndex) {
		const target = landing.periods[periodIndex];
		if (!target) {
			throw new ParseError(`The portal has no grading period at index ${periodIndex}.`);
		}
		classes = parseLandingClasses(
			await loadControl(
				session,
				SCHOOL_CLASSES,
				{
					schoolID: target.schoolId,
					OrgYearGU: target.orgYearGu,
					gradePeriodGU: target.gu,
					GradingPeriodGroup: target.groupName,
					AGU: landing.agu
				},
				options
			)
		);
		currentIndex = periodIndex;
	}

	const details = new Array<ClassDetail | 'unreadable' | undefined>(classes.length);
	const build = () => buildGradebook(landing.periods, currentIndex, classes, details);

	// Grades-first: the landing page alone is a complete gradebook (marks, no
	// assignments) - hand it out before spending a single detail request.
	if (hooks.onPartial) hooks.onPartial(build());

	await fetchDetails(session, classes, options, details, () => {
		if (hooks.onPartial) hooks.onPartial(build());
	});

	return build();
}

function buildGradebook(
	periods: GradingPeriod[],
	currentIndex: number,
	classes: LandingClass[],
	details: Array<ClassDetail | 'unreadable' | undefined>
): Gradebook {
	let unreadableCourses = 0;
	let unreadableAssignments = 0;
	let unreadableCategories = 0;
	const period = periods[currentIndex];
	const courses: Course[] = classes.map((cls, i) => {
		const detail = details[i];
		// Some districts render the landing mark as "A- 91.8%"; split it so the
		// no-detail fallback still carries both letter and percentage.
		let letter = cls.mark === 'N/A' ? '' : cls.mark;
		let percentage = 0;
		const combined = /\s*([\d.]+)%$/.exec(letter);
		if (combined) {
			percentage = Number.parseFloat(combined[1]!);
			letter = letter.slice(0, combined.index).trim();
		}
		let categories: Category[] | undefined;
		const assignments: Assignment[] = [];

		if (detail === 'unreadable') {
			// The course still appears with what the landing row showed; only
			// its detail view was unreadable.
			unreadableCourses++;
		} else if (detail) {
			letter = detail.letter;
			percentage = detail.percentage;
			categories = detail.categories;
			unreadableCategories += detail.unreadableCategories;
			for (const [rowIndex, raw] of detail.rawAssignments.entries()) {
				try {
					const assignment = assignmentRowToDomain(raw);
					assignments.push(
						assignment.id === '' ? { ...assignment, id: `${cls.classId}-${rowIndex}` } : assignment
					);
				} catch (error) {
					if (!(error instanceof ParseError)) throw error;
					unreadableAssignments++;
				}
			}
		}

		return {
			courseId: cls.classId,
			name: cls.name,
			title: cls.name,
			period: cls.period,
			room: cls.room,
			staff: { name: cls.teacher },
			marks: [
				{
					name: period ? period.name : '',
					shortName: markShortName(cls, period),
					letter,
					percentage,
					...(categories ? { categories } : {}),
					assignments
				}
			]
		};
	});

	return validate(
		GradebookSchema,
		{
			reportingPeriods: periods.map((p, index) => ({ index, name: p.name })),
			currentPeriodIndex: currentIndex,
			courses,
			unreadableCourses,
			unreadableAssignments,
			unreadableCategories
		},
		'gradebook'
	);
}

const markShortName = (cls: LandingClass, period: GradingPeriod | undefined): string =>
	cls.markPeriodName || period?.markPeriods[0]?.name || (period ? period.name : '');

// One detail request per class that may have work, none for the rest, filled
// into `details` in place with `onDetail` fired after each one lands. An
// unreadable detail (ParseError only) degrades that course; anything else -
// session expiry, portal errors - fails the sync and must surface.
async function fetchDetails(
	session: PortalSession,
	classes: LandingClass[],
	options: FetchFollowOptions,
	details: Array<ClassDetail | 'unreadable' | undefined>,
	onDetail: () => void
): Promise<void> {
	const queue = classes.map((cls, index) => ({ cls, index })).filter(({ cls }) => cls.mayHaveWork);

	const worker = async (): Promise<void> => {
		for (;;) {
			const next = queue.shift();
			if (!next) return;
			try {
				details[next.index] = parseClassDetail(
					await loadControl(session, CLASS_DETAILS, next.cls.focusArgs, options)
				);
			} catch (error) {
				if (!(error instanceof ParseError)) throw error;
				details[next.index] = 'unreadable';
			}
			onDetail();
		}
	};
	await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
}
