import type { Assignment } from '../../../domain/index.js';
import { AssignmentSchema } from '../../../domain/index.js';
import { toIsoDate } from '../../../extract/index.js';
import { validate } from '../shared.js';

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
			...(optionalString(row['Type']) === undefined ? {} : { category: row['Type'] }),
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
