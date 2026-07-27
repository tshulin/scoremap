import { StudentInfoSchema, type StudentInfo } from '../../domain/index';
import { parseLabeledFields } from '../../extract/index';
import { ParseError } from '../errors';
import type { FetchFollowOptions } from '../http';
import type { PortalSession } from '../login';
import { getPage, validate } from './shared';

const PAGE = 'PXP2_Student.aspx?AGU=0';

const NAME_LABELS = ['Student Name', 'Name'];
const PERM_ID_LABELS = ['Perm ID', 'Student ID'];

const pick = (fields: Record<string, string>, labels: string[]): string => {
	for (const label of labels) {
		const value = fields[label];
		if (value !== undefined) return value;
	}
	return '';
};

// One page, nothing else. The portal also serves a student portrait linked from
// this page's bootstrap data, but the app renders the name and grade only — so
// downloading the image spent a request (and the bytes) on something no screen
// ever showed. If a portrait is ever displayed, fetch it there, not here.
export async function fetchStudentInfo(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<StudentInfo> {
	const page = await getPage(session, PAGE, options);
	const fields = parseLabeledFields(page.body);
	if (page.redirected || Object.keys(fields).length === 0) {
		throw new ParseError('Could not load student information from the portal.');
	}

	return validate(
		StudentInfoSchema,
		{
			name: pick(fields, NAME_LABELS),
			permId: pick(fields, PERM_ID_LABELS),
			gender: fields['Gender'] ?? '',
			grade: fields['Grade'] ?? ''
		},
		'student info'
	);
}

export const checkLogin = (
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<StudentInfo> => fetchStudentInfo(session, options);
