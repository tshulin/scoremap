import type { Assignment } from '../../../domain/index';
import { AssignmentSchema } from '../../../domain/index';
import { decodeEntities, stripTags, toIsoDate } from '../../../extract/index';
import { validate } from '../shared';
import { cellText } from './cells';

const NOT_FOR_GRADING_PREFIX = '(Not For Grading)';

// Empty Point means zero; a missing Point means the assignment is ungraded.
// Empty PointPossible marks extra credit.
const optionalString = (value: unknown): string | undefined =>
	typeof value === 'string' ? value : undefined;

function toNumber(value: string | undefined): number | undefined {
	if (value === undefined || value.trim() === '') return undefined;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function pointsPossibleFromText(text: string | undefined): number | undefined {
	if (text === undefined) return undefined;
	const trimmed = text.trim();
	if (trimmed === '' || trimmed === 'Points Possible') return undefined;

	const possibleOnly = /^([\d.]+)\s+Points\s+Possible$/i.exec(trimmed);
	if (possibleOnly) return toNumber(possibleOnly[1]);

	const fraction = /\/\s*([\d.]+)\s*$/.exec(trimmed);
	return fraction ? toNumber(fraction[1]) : undefined;
}

export function rawAssignmentToDomain(row: Record<string, unknown>): Assignment {
	const point = optionalString(row['Point']);
	const pointPossible = optionalString(row['PointPossible']);
	const scoreCalValue = optionalString(row['ScoreCalValue']);
	const scoreMaxValue = optionalString(row['ScoreMaxValue']);
	const notes = optionalString(row['Notes']) ?? '';
	const description = optionalString(row['MeasureDescription']) ?? '';

	const pointsEarned = point === undefined ? undefined : point === '' ? 0 : toNumber(point);

	const pointsPossible =
		toNumber(pointPossible) ??
		toNumber(scoreMaxValue) ??
		pointsPossibleFromText(optionalString(row['Points']));

	const earnedIsScaled =
		point !== undefined && point !== '' && scoreCalValue !== undefined && point !== scoreCalValue;
	const possibleIsScaled =
		pointPossible !== undefined &&
		pointPossible !== '' &&
		scoreMaxValue !== undefined &&
		pointPossible !== scoreMaxValue;

	let unscaledPoints: Assignment['unscaledPoints'];
	if (earnedIsScaled || possibleIsScaled) {
		const unscaledEarned = toNumber(scoreCalValue);
		const unscaledPossible = toNumber(scoreMaxValue);
		if (unscaledEarned !== undefined && unscaledPossible !== undefined) {
			unscaledPoints = { pointsEarned: unscaledEarned, pointsPossible: unscaledPossible };
		}
	}

	const comments = notes.replace(NOT_FOR_GRADING_PREFIX, '').trim();

	// stripTags also decodes entities and collapses whitespace, so the category
	// matches the weights grid's name however the cell was formatted; a
	// whitespace-only Type means uncategorized, same as an absent one.
	const categoryText = optionalString(row['Type']);
	const category = categoryText === undefined ? undefined : stripTags(categoryText);

	return validate(
		AssignmentSchema,
		{
			id: optionalString(row['GradebookID']) ?? '',
			name: optionalString(row['Measure']) ?? '',
			...(pointsEarned === undefined ? {} : { pointsEarned }),
			...(pointsPossible === undefined ? {} : { pointsPossible }),
			extraCredit: pointPossible === '',
			notForGrade: notes.startsWith(NOT_FOR_GRADING_PREFIX),
			...(unscaledPoints === undefined ? {} : { unscaledPoints }),
			...(category === undefined || category === '' ? {} : { category }),
			date: toIsoDate(optionalString(row['Date']) ?? ''),
			...(optionalString(row['DueDate']) === undefined
				? {}
				: { dueDate: toIsoDate(row['DueDate'] as string) }),
			...(description === '' ? {} : { description }),
			...(comments === '' ? {} : { comments })
		},
		`assignment ${optionalString(row['Measure']) ?? optionalString(row['GradebookID']) ?? '?'}`
	);
}

// The live class-detail fragments (captured 2026-08-14) column their assignment
// grid with GB*-prefixed fields, not the legacy keys above. This adapter
// translates a GB row into the legacy raw shape so rawAssignmentToDomain stays
// the single owner of every score edge case. Live-verified 2026-08-21 against
// real posted grades: flat string cells, a gradeBookId key, GBAssignment and
// GBScore as JSON-stringified LinkColumn cells, GBPoints "7.89/10.0000" (the
// scaled score) beside GBScore "15 out of 19.0000" (raw), 2-digit-year dates.
// Other scrapers' conventions (GBAssignmentID, bare GBPoints + GBScore earned,
// "Missing"/"Not Due") stay handled - see scripts/plans/gradedata.md.
const isGbRow = (row: Record<string, unknown>): boolean =>
	'GBAssignment' in row || 'GBPoints' in row;

const FRACTION = /^([\d.]+)\s*\/\s*([\d.]+)$/;
const RAW_SCORE = /^([\d.]+)\s+out of\s+([\d.]+)$/i;
const BARE_NUMBER = /^[\d.]+$/;

function gbRowToRaw(row: Record<string, unknown>): Record<string, unknown> {
	// A plain id key on the row wins; failing that, the id is mined from the
	// cell's link parameters (data-focus / hrefAttributes) BEFORE unwrapping -
	// the unwrapped value is only the display name. The quote may arrive
	// entity-encoded or JSON-escaped depending on how the cell is wrapped.
	const cell = row['GBAssignment'];
	const cellSource = typeof cell === 'string' ? cell : cell ? JSON.stringify(cell) : '';
	const minedId = /"assignmentID\\?"\s*:\s*"?(-?\d+)/.exec(decodeEntities(cellSource))?.[1];
	const id =
		cellText(row['gradeBookId']) ??
		cellText(row['GBAssignmentID']) ??
		cellText(row['GradebookID']) ??
		cellText(row['AssignmentID']) ??
		minedId;

	const raw: Record<string, unknown> = {
		...(id === undefined ? {} : { GradebookID: id }),
		Measure: stripTags(cellText(cell) ?? ''),
		Date: cellText(row['Date']) ?? '',
		Type: cellText(row['GBAssignmentType']),
		Notes: stripTags(cellText(row['GBNotes']) ?? '')
	};

	const dueDate = cellText(row['DueDate']);
	if (dueDate !== undefined) raw['DueDate'] = dueDate;

	// Two live conventions. Ours: GBPoints is the whole score - "8.00 / 10.0000"
	// graded, "10.00 Points Possible" ungraded. Others: GBPoints is a bare
	// possible ("20") and GBScore carries the earned ("17"), or a non-numeric
	// state ("Missing", "Not Due") when ungraded. Point stays absent for
	// ungraded work, never '': '' would mean an earned zero.
	const points = (cellText(row['GBPoints']) ?? '').trim();
	const scoreText = stripTags(cellText(row['GBScore']) ?? '').trim();
	const fraction = FRACTION.exec(points);
	if (fraction) {
		raw['Point'] = fraction[1];
		raw['PointPossible'] = fraction[2];
	} else if (BARE_NUMBER.test(points)) {
		raw['PointPossible'] = points;
		if (BARE_NUMBER.test(scoreText)) raw['Point'] = scoreText;
	} else if (points !== '') {
		raw['Points'] = points;
	}

	// A raw score differing from the points is the portal's scaled-points
	// signal; ScoreCalValue/ScoreMaxValue carry the unscaled pair. The same
	// numbers rendered differently ("8.00 / 10.0000" vs "8 out of 10") are not
	// a signal, and downstream compares the strings, so equal pairs stay out.
	if (/raw score/i.test(cellText(row['GBScoreType']) ?? '')) {
		const score = RAW_SCORE.exec(stripTags(cellText(row['GBScore']) ?? ''));
		if (score) {
			const differs =
				!fraction ||
				Number.parseFloat(score[1]!) !== Number.parseFloat(fraction[1]!) ||
				Number.parseFloat(score[2]!) !== Number.parseFloat(fraction[2]!);
			if (differs) {
				raw['ScoreCalValue'] = score[1];
				raw['ScoreMaxValue'] = score[2];
			}
		}
	}

	return raw;
}

export const assignmentRowToDomain = (row: Record<string, unknown>): Assignment =>
	rawAssignmentToDomain(isGbRow(row) ? gbRowToRaw(row) : row);
