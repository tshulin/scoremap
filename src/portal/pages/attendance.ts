import { AttendanceSchema, type Absence, type Attendance } from '../../domain/index.js';
import {
	assertNotBounced,
	bootstrapValue,
	findDataSourceWithKeys,
	stripTags,
	toIsoDate
} from '../../extract/index.js';
import type { FetchFollowOptions } from '../http.js';
import type { PortalSession } from '../login.js';
import { asString, getPage, validate } from './shared.js';

const PAGE = 'PXP2_Attendance.aspx?AGU=0';

// These names come from the attendance grid's column configuration.
const DATE_KEYS = ['Date', 'AbsenceDate'];
const ROW_KEYS = [...DATE_KEYS, 'AttAllDayReason', 'AttPeriods'];

const firstString = (row: Record<string, unknown>, keys: string[]): string => {
	for (const key of keys) {
		const value = asString(row[key]);
		if (value) return value;
	}
	return '';
};

function toPeriods(value: unknown): Absence['periods'] {
	if (!Array.isArray(value)) return undefined;
	const periods = value
		.filter(
			(entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null
		)
		.map((entry) => {
			const period = stripTags(firstString(entry, ['Period', 'PeriodName']));
			const reason = stripTags(firstString(entry, ['Reason', 'AttReason']));
			const note = stripTags(firstString(entry, ['Note']));
			return {
				period,
				...(reason ? { reason } : {}),
				...(note ? { note } : {})
			};
		})
		.filter((entry) => entry.period !== '');
	return periods.length > 0 ? periods : undefined;
}

function toAbsence(row: Record<string, unknown>): unknown {
	const reason = stripTags(firstString(row, ['AttAllDayReason', 'Reason']));
	const note = stripTags(firstString(row, ['Note']));
	const periods = toPeriods(row['AttPeriods'] ?? row['Periods']);
	return {
		date: toIsoDate(firstString(row, DATE_KEYS)),
		...(reason ? { reason } : {}),
		...(note ? { note } : {}),
		...(periods ? { periods } : {})
	};
}

export async function fetchAttendance(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<Attendance> {
	const page = await getPage(session, PAGE, options);
	assertNotBounced(page, 'Attendance');

	const rows = findDataSourceWithKeys(page.body, ROW_KEYS);

	return validate(
		AttendanceSchema,
		{
			schoolName: bootstrapValue(page.body, 'school') ?? '',
			absences: rows.map(toAbsence)
		},
		'attendance'
	);
}
