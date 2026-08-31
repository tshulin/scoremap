import type { Assignment, Category, Course, Gradebook } from '../../domain/index';
import { GradebookSchema } from '../../domain/index';
import { NoActiveGradingPeriodError, ParseError } from '../errors';
import type { FetchFollowOptions } from '../http';
import { rawAssignmentToDomain } from '../pages/gradebook/assignment';
import type { GradebookHooks } from '../pages/gradebook/index';
import { validate } from '../pages/shared';
import { mobileCall, type MobileSession } from './client';

// The mobile Gradebook returns everything the web scrape needed - marks, weighted
// categories, and every assignment - in one response, shaped as
// data.traditionalGradebook.courses[].marks[0].{gradeCalculationSummary,assignments}.
// This maps that JSON onto the SAME Gradebook domain the web parser produces, so the
// app and grade engine consume it unchanged; the one thing it adds is real category
// weights (gradeCalculationSummary), which the web fragment hides on some districts.

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): Record<string, unknown>[] =>
	Array.isArray(value) ? value.filter(isRecord) : [];

const str = (value: unknown): string =>
	typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

// Weights and percentages arrive as "50%" / "82.10"; drop the percent sign.
function num(value: unknown): number {
	if (typeof value === 'number') return value;
	if (typeof value !== 'string') return 0;
	const parsed = Number.parseFloat(value.replace(/[%,]/g, '').trim());
	return Number.isFinite(parsed) ? parsed : 0;
}

// The course title carries a trailing " (courseID)" the web name never had.
const cleanTitle = (title: string): string => title.replace(/\s*\(\d+\)\s*$/, '').trim();

const UNGRADED_MARKS = new Set(['', 'N/A']);

// gradeCalculationSummary rows are the categories, plus a synthetic "TOTAL" rollup.
// Drop TOTAL; an otherwise empty list means the class is total-points (no weighting),
// exactly the `categories: undefined` the grade engine treats as straight points.
function toCategories(summary: Record<string, unknown>[]): Category[] | undefined {
	const categories = summary
		.filter((row) => str(row['type']).toUpperCase() !== 'TOTAL')
		.map((row) => ({
			name: str(row['type']),
			weightPercentage: num(row['weight']),
			pointsEarned: num(row['points']),
			pointsPossible: num(row['pointsPossible']),
			weightedPercentage: num(row['weightedPct']),
			letter: str(row['calculatedMark'])
		}));
	return categories.length > 0 ? categories : undefined;
}

// The mobile assignment keys are the legacy names in camelCase, so a shallow rename
// hands them to rawAssignmentToDomain - the single owner of every score edge case
// (empty vs absent point, extra credit, not-for-grading, scaled points) - keeping
// mobile grades byte-identical to the web path. `null` marks an absent field the
// same way the legacy XML omitted it, so ungraded work stays ungraded.
function mobileAssignmentToRaw(a: Record<string, unknown>): Record<string, unknown> {
	const raw: Record<string, unknown> = {
		Measure: str(a['measure']),
		Type: str(a['type']),
		Date: str(a['date']),
		Notes: str(a['notes']),
		MeasureDescription: str(a['measureDescription'])
	};
	if (a['gradebookID'] != null) raw['GradebookID'] = String(a['gradebookID']);
	if (a['dueDate'] != null && a['dueDate'] !== '') raw['DueDate'] = String(a['dueDate']);
	if (a['points'] != null) raw['Points'] = String(a['points']);
	// Preserve '' (an earned zero / extra credit) distinct from null (ungraded / not
	// extra credit) - rawAssignmentToDomain reads that distinction.
	if (a['point'] != null) raw['Point'] = String(a['point']);
	if (a['pointPossible'] != null) raw['PointPossible'] = String(a['pointPossible']);
	if (a['scoreCalValue'] != null) raw['ScoreCalValue'] = String(a['scoreCalValue']);
	if (a['scoreMaxValue'] != null) raw['ScoreMaxValue'] = String(a['scoreMaxValue']);
	return raw;
}

interface ParsedCourse {
	course: Course;
	unreadableAssignments: number;
}

function toCourse(node: Record<string, unknown>, periodName: string): ParsedCourse {
	const mark = asArray(node['marks'])[0] ?? {};
	const rawMark = str(mark['calculatedScoreString']);
	const letter = UNGRADED_MARKS.has(rawMark) ? '' : rawMark;
	const categories = toCategories(asArray(mark['gradeCalculationSummary']));

	const classId = str(node['courseID']);
	const assignments: Assignment[] = [];
	let unreadableAssignments = 0;
	for (const [index, row] of asArray(mark['assignments']).entries()) {
		try {
			const assignment = rawAssignmentToDomain(mobileAssignmentToRaw(row));
			assignments.push(
				assignment.id === '' ? { ...assignment, id: `${classId}-${index}` } : assignment
			);
		} catch (error) {
			if (!(error instanceof ParseError)) throw error;
			unreadableAssignments++;
		}
	}

	const title = cleanTitle(str(node['title'])) || str(node['courseName']);
	const shortName = str(mark['markName']) || str(mark['shortMarkName']) || periodName;

	return {
		course: {
			courseId: classId,
			name: title,
			title,
			period: str(node['period']),
			room: str(node['room']),
			staff: { name: str(node['staff']), ...(str(node['staffEMail']) ? { email: str(node['staffEMail']) } : {}) },
			marks: [
				{
					name: periodName,
					shortName,
					letter,
					percentage: num(mark['calculatedScoreRaw']),
					...(categories ? { categories } : {}),
					assignments
				}
			]
		},
		unreadableAssignments
	};
}

export function parseMobileGradebook(data: Record<string, unknown>): Gradebook {
	const book = isRecord(data['traditionalGradebook']) ? data['traditionalGradebook'] : data;

	const periods = asArray(book['reportingPeriods']).map((p) => ({
		index: num(p['index']),
		name: str(p['gradePeriod'])
	}));
	const current = isRecord(book['reportingPeriod']) ? book['reportingPeriod'] : {};
	const currentIndex = periods.length > 0 ? num(current['index']) : 0;
	const currentName =
		str(current['gradePeriod']) || periods.find((p) => p.index === currentIndex)?.name || '';

	const courseNodes = asArray(book['courses']);
	// Out of term the mobile API returns no courses; treat it exactly like the web
	// redirect so the caller can show the friendly out-of-term message (or fall back).
	if (courseNodes.length === 0) {
		throw new NoActiveGradingPeriodError('The mobile API returned no courses.');
	}

	let unreadableAssignments = 0;
	const courses: Course[] = courseNodes.map((node) => {
		const parsed = toCourse(node, currentName);
		unreadableAssignments += parsed.unreadableAssignments;
		return parsed.course;
	});

	return validate(
		GradebookSchema,
		{
			reportingPeriods: periods.length > 0 ? periods : [{ index: 0, name: currentName }],
			currentPeriodIndex: currentIndex,
			courses,
			unreadableCourses: 0,
			unreadableAssignments,
			unreadableCategories: 0
		},
		'mobile gradebook'
	);
}

export async function fetchMobileGradebook(
	session: MobileSession,
	options: FetchFollowOptions = {},
	hooks: GradebookHooks = {},
	periodIndex?: number
): Promise<Gradebook> {
	const request: Record<string, unknown> = {
		concurrentSchOrgYearGU: '',
		childIntID: 0,
		languageCode: '98'
	};
	if (periodIndex !== undefined) {
		request['reportPeriod'] = String(periodIndex);
		request['reportPeriodIndex'] = String(periodIndex);
	}
	const data = await mobileCall(session, 'Gradebook', request, options);
	const gradebook = parseMobileGradebook(data);
	// One request already carries grades + assignments; fire the grades-first hook
	// once so the sync layer paints at the same moment the web path's partial would.
	if (hooks.onPartial) hooks.onPartial(gradebook);
	return gradebook;
}
