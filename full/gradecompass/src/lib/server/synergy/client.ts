/**
 * High-level Synergy web-portal client. Each method fetches from the authenticated
 * session and returns a legacy Synergy *inner XML string* (the content the old SOAP
 * API used to return inside its Result element). The proxy wraps this in a SOAP
 * envelope so the existing client-side parser is untouched.
 */

import { Buffer } from 'node:buffer';
import { fetchFollow, fetchFollowRaw } from './http';
import type { SynergySession } from './login';
import {
	attendanceXml,
	documentsXml,
	extractJsonAfter,
	reportCardXml,
	studentInfoXml
} from './translate';

export class SynergyDataError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SynergyDataError';
	}
}

const pageUrl = (session: SynergySession, path: string) => `https://${session.domain}/${path}`;

const getPage = (session: SynergySession, path: string) =>
	fetchFollow(pageUrl(session, path), { method: 'GET' }, session.jar);

// ---------------------------------------------------------------------------
// Student Info (also used to validate a login)
// ---------------------------------------------------------------------------

/** Scrape the "Student Name / Perm ID / Gender / Grade" table into label->value. */
function parseStudentFields(html: string): Record<string, string> {
	const fields: Record<string, string> = {};
	const cellRe =
		/<span class="tbl_label">([^<]+)<\/span>\s*<br\s*\/?>\s*([^<]*)/gi;
	let match: RegExpExecArray | null;
	while ((match = cellRe.exec(html)) !== null) {
		const label = match[1]?.trim();
		if (label) fields[label] = match[2]?.trim() ?? '';
	}
	return fields;
}

/** The nav bootstrap JSON on every page lists the current student's photo path. */
const parsePhotoPath = (html: string): string | undefined =>
	html.match(/"photo"\s*:\s*"([^"]+)"/)?.[1];

async function fetchPhotoBase64(session: SynergySession, html: string): Promise<string> {
	const photoPath = parsePhotoPath(html);
	if (!photoPath) return '';
	try {
		const { response } = await fetchFollowRaw(
			pageUrl(session, photoPath),
			{ method: 'GET' },
			session.jar
		);
		if (!response.ok) return '';
		const bytes = Buffer.from(await response.arrayBuffer());
		return bytes.toString('base64');
	} catch {
		return '';
	}
}

export async function studentInfo(session: SynergySession): Promise<string> {
	const { body, redirected } = await getPage(session, 'PXP2_Student.aspx?AGU=0');
	const fields = parseStudentFields(body);

	if (redirected || Object.keys(fields).length === 0) {
		throw new SynergyDataError('Could not load student information from the portal.');
	}

	const photoBase64 = await fetchPhotoBase64(session, body);
	return studentInfoXml({ fields, photoBase64 });
}

/** Lightweight login validation: loads a known authenticated page. */
export async function checkLogin(session: SynergySession): Promise<string> {
	return studentInfo(session);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * The page has several `dataSource` arrays (column filters, category lookup, and
 * the actual document grid). Pick the one whose rows are documents.
 */
function findRowsWithKey(html: string, ...keys: string[]): unknown[] {
	let from = 0;
	for (;;) {
		const idx = html.indexOf('"dataSource":', from);
		if (idx === -1) return [];
		const arr = extractJsonAfter(html.slice(idx), '"dataSource":');
		if (
			Array.isArray(arr) &&
			arr.length > 0 &&
			typeof arr[0] === 'object' &&
			arr[0] !== null &&
			keys.some((key) => key in (arr[0] as object))
		) {
			return arr;
		}
		from = idx + '"dataSource":'.length;
	}
}

export async function documents(session: SynergySession): Promise<string> {
	const { body } = await getPage(session, 'PXP2_Documents.aspx?AGU=0');
	const rows = findRowsWithKey(body, 'DocumentUploadDate', 'DocumentTitle');
	const studentGU = body.match(/"studentGU"\s*:\s*"([^"]+)"/i)?.[1] ?? '';
	return documentsXml(rows, studentGU);
}

/** Fetch a document's bytes by its docToken and return them base64-encoded. */
export async function reportCard(
	session: SynergySession,
	documentGU: string
): Promise<string> {
	const token = encodeURIComponent(documentGU);
	const { response } = await fetchFollowRaw(
		pageUrl(session, `PXP_ShowDocument.aspx?AGU=&docToken=${token}`),
		{ method: 'GET' },
		session.jar
	);

	const contentType = response.headers.get('content-type') ?? '';
	if (!response.ok || contentType.includes('text/html')) {
		// Not a real document (expired token or an error page).
		return reportCardXml(documentGU, '');
	}

	const bytes = Buffer.from(await response.arrayBuffer());
	return reportCardXml(documentGU, bytes.toString('base64'));
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function attendance(session: SynergySession): Promise<string> {
	const { body } = await getPage(session, 'PXP2_Attendance.aspx?AGU=0');
	const schoolName = body.match(/"school"\s*:\s*"([^"]+)"/i)?.[1] ?? '';
	const rows = extractJsonAfter(body, '"dataSource":');
	return attendanceXml(schoolName, Array.isArray(rows) ? rows : []);
}

// ---------------------------------------------------------------------------
// Gradebook (requires an active grading period; see capture note in the plan)
// ---------------------------------------------------------------------------

export async function gradebook(
	session: SynergySession,
	_reportPeriod?: number
): Promise<string> {
	const { redirected } = await getPage(session, 'PXP2_Gradebook.aspx?AGU=0');

	// In between terms the gradebook module bounces to Home — there is nothing to show.
	if (redirected) {
		throw new SynergyDataError(
			'No gradebook is available for the current grading period yet.'
		);
	}

	// An active-term gradebook renders here; translating its HTML/JSON to the legacy
	// shape requires a captured live payload (see plan). Fail clearly until then.
	throw new SynergyDataError(
		'Gradebook translation is pending a captured active-term payload.'
	);
}

// ---------------------------------------------------------------------------
// Mail (pending capture — Messages module)
// ---------------------------------------------------------------------------

export async function mailData(_session: SynergySession): Promise<string> {
	throw new SynergyDataError('Mail is not available yet on the new StudentVUE integration.');
}

export async function attachment(
	_session: SynergySession,
	_attachmentGU: string
): Promise<string> {
	throw new SynergyDataError('Mail attachments are not available yet.');
}
