import type { Category } from '../../../domain/index';
import { CategorySchema } from '../../../domain/index';
import { findDataSourceWithKeys, stripTags } from '../../../extract/index';
import { ParseError } from '../../errors';
import { validate } from '../shared';
import { cellNumber, cellText } from './cells';

// A Gradebook_ClassDetails fragment carries everything for one class in one
// response: the current mark/percentage (#current-grade), the category-weights
// grid, and the assignments grid - both grids as inline "dataSource" arrays
// (remoteOperations is false and paging is client-side, so no further requests
// ever fetch rows).

export interface ClassDetail {
	letter: string;
	percentage: number;
	categories?: Category[];
	unreadableCategories: number;
	rawAssignments: Array<Record<string, unknown>>;
}

const ASSIGNMENT_KEYS = ['GBAssignment', 'GBPoints', 'GradebookID', 'Measure'];
const CATEGORY_KEYS = [
	'CategoryName',
	'Category',
	'Weight',
	'WeightPercentage',
	'CategoryWeight',
	'WeightedPct',
	'CalculatedMark'
];

const UNGRADED_MARKS = new Set(['', 'N/A']);

// The populated category-row shape is unobserved (the live grid config was
// empty at capture time), so the field names are candidates from the legacy
// XML. Unrecognized rows drop the whole category list - the grade engine then
// falls back to point totals - and are counted, not swallowed.
function toCategory(row: Record<string, unknown>): Category {
	const first = (...keys: string[]): unknown => {
		for (const key of keys) {
			if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
		}
		return undefined;
	};

	const name = cellText(first('CategoryName', 'Category', 'Type'));
	const weight = cellNumber(first('Weight', 'WeightPercentage', 'CategoryWeight'));
	const pointsEarned = cellNumber(first('Points', 'PointsEarned'));
	const pointsPossible = cellNumber(first('PointsPossible', 'PointPossible'));
	const weightedPercentage = cellNumber(first('WeightedPct', 'WeightedPercentage'));

	return validate(
		CategorySchema,
		{
			name: name === undefined ? undefined : stripTags(name),
			weightPercentage: weight,
			pointsEarned: pointsEarned ?? 0,
			pointsPossible: pointsPossible ?? 0,
			weightedPercentage: weightedPercentage ?? 0,
			letter: stripTags(cellText(first('CalculatedMark', 'Mark', 'Letter')) ?? '')
		},
		`category ${name ?? '?'}`
	);
}

export function parseClassDetail(html: string): ClassDetail {
	const gradeAnchor = html.indexOf('current-grade');
	const gradeSection = gradeAnchor === -1 ? '' : html.slice(gradeAnchor, gradeAnchor + 1000);
	const mark = stripTags(/class="mark"[^>]*>([^<]*)</.exec(gradeSection)?.[1] ?? '');
	const score = /class="score"[^>]*>\s*([\d.]+)\s*%/.exec(gradeSection)?.[1];

	// The two grids are located by position, not row keys: the category grid
	// always precedes the assignments grid, and guessing by keys alone could
	// mistake one for the other.
	const split = html.indexOf('AssignmentsGrid');
	const categoryHtml = split === -1 ? '' : html.slice(0, split);
	const assignmentHtml = split === -1 ? html : html.slice(split);

	const categoryRows = findDataSourceWithKeys(categoryHtml, CATEGORY_KEYS);
	const categories: Category[] = [];
	let failedCategories = 0;
	for (const row of categoryRows) {
		try {
			categories.push(toCategory(row));
		} catch (error) {
			if (!(error instanceof ParseError)) throw error;
			failedCategories++;
		}
	}

	// A partial category list would misweight every what-if calculation, so any
	// unreadable row invalidates the lot; all rows then count as unreadable.
	const categoriesOk = categories.length > 0 && failedCategories === 0;
	return {
		letter: UNGRADED_MARKS.has(mark) ? '' : mark,
		percentage: score === undefined ? 0 : Number.parseFloat(score),
		...(categoriesOk ? { categories } : {}),
		unreadableCategories: failedCategories === 0 ? 0 : categoryRows.length,
		rawAssignments: findDataSourceWithKeys(assignmentHtml, ASSIGNMENT_KEYS)
	};
}
