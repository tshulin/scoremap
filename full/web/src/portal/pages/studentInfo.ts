import { StudentInfoSchema, type StudentInfo } from '../../domain/index';
import { bootstrapValue, parseLabeledFields } from '../../extract/index';
import { ParseError } from '../errors';
import { fetchFollowRaw, type FetchFollowOptions } from '../http';
import type { PortalSession } from '../login';
import { getPage, portalUrl, validate } from './shared';

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

// Browser-portable base64 (no node:buffer). Chunked so a large photo doesn't
// overflow the argument list of String.fromCharCode.
function bytesToBase64(bytes: Uint8Array): string {
	let binary = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

// Photo failures should not prevent the rest of the profile from loading.
async function fetchPhotoBase64(
	session: PortalSession,
	html: string,
	options: FetchFollowOptions
): Promise<string | undefined> {
	const photoPath = bootstrapValue(html, 'photo');
	if (!photoPath) return undefined;
	try {
		const { response } = await fetchFollowRaw(
			portalUrl(session, photoPath),
			{ method: 'GET' },
			session.jar,
			options
		);
		if (!response.ok) return undefined;
		const bytes = new Uint8Array(await response.arrayBuffer());
		return bytes.length > 0 ? bytesToBase64(bytes) : undefined;
	} catch {
		return undefined;
	}
}

export async function fetchStudentInfo(
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<StudentInfo> {
	const page = await getPage(session, PAGE, options);
	const fields = parseLabeledFields(page.body);
	if (page.redirected || Object.keys(fields).length === 0) {
		throw new ParseError('Could not load student information from the portal.');
	}

	const photoBase64 = await fetchPhotoBase64(session, page.body, options);

	return validate(
		StudentInfoSchema,
		{
			name: pick(fields, NAME_LABELS),
			permId: pick(fields, PERM_ID_LABELS),
			gender: fields['Gender'] ?? '',
			grade: fields['Grade'] ?? '',
			...(photoBase64 === undefined ? {} : { photoBase64 })
		},
		'student info'
	);
}

export const checkLogin = (
	session: PortalSession,
	options: FetchFollowOptions = {}
): Promise<StudentInfo> => fetchStudentInfo(session, options);
