/**
 * Translate the modern PXP2 web portal's responses (server-rendered HTML +
 * embedded JSON) into the legacy Synergy XML shapes that the rest of GradeCompass
 * already parses. Each function returns an inner XML string (e.g. `<StudentInfo…>`)
 * that the proxy wraps in a SOAP envelope via `wrapEnvelope`, so the client-side
 * parser (`parseResult` / `parseGradebookXML`) and every `src/lib/types` interface
 * keep working unchanged.
 */

import { XMLBuilder } from 'fast-xml-parser';

const builder = new XMLBuilder({
	ignoreAttributes: false,
	attributeNamePrefix: '_',
	suppressEmptyNode: true
});

const XMLNS = {
	'_xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
	'_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
};

/** Build a single-rooted inner XML string from a plain object. */
const buildInner = (rootName: string, node: Record<string, unknown>): string =>
	builder.build({ [rootName]: node });

const stripTags = (html: string): string =>
	html
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.trim();

/**
 * Extract a balanced JSON array/object literal that immediately follows `needle`
 * inside a larger blob (used to pull DevExpress grid `dataSource` arrays out of the
 * server-rendered page HTML). Returns the parsed value, or undefined if not found.
 */
export function extractJsonAfter(source: string, needle: string): unknown {
	const start = source.indexOf(needle);
	if (start === -1) return undefined;

	let i = start + needle.length;
	while (i < source.length && source[i] !== '[' && source[i] !== '{') i++;
	if (i >= source.length) return undefined;

	const open = source[i];
	const close = open === '[' ? ']' : '}';
	let depth = 0;
	let inString = false;
	let escaped = false;

	for (let j = i; j < source.length; j++) {
		const ch = source[j];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (ch === '\\') {
			escaped = true;
			continue;
		}
		if (ch === '"') inString = !inString;
		if (inString) continue;
		if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) {
				try {
					return JSON.parse(source.slice(i, j + 1));
				} catch {
					return undefined;
				}
			}
		}
	}
	return undefined;
}

// ---------------------------------------------------------------------------
// Student Info
// ---------------------------------------------------------------------------

export interface StudentInfoInput {
	/** label -> value pairs scraped from the student info table. */
	fields: Record<string, string>;
	/** base64-encoded portrait, or '' if unavailable. */
	photoBase64: string;
}

export function studentInfoXml({ fields, photoBase64 }: StudentInfoInput): string {
	return buildInner('StudentInfo', {
		...XMLNS,
		_Type: 'StudentInfo',
		FormattedName: fields['Student Name'] ?? fields['Name'] ?? '',
		PermID: fields['Perm ID'] ?? fields['Student ID'] ?? '',
		Gender: fields['Gender'] ?? '',
		Grade: fields['Grade'] ?? '',
		Photo: photoBase64
	});
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

interface DocumentRow {
	DocumentUploadDate?: string;
	DocumentTitle?: string;
	DocumentCategory?: string;
}

const docTokenOf = (titleHtml: string): string =>
	titleHtml.match(/docToken=([^"&\\]+)/)?.[1] ?? '';

export function documentsXml(rows: unknown[], studentGU = ''): string {
	const StudentDocumentData = rows.map((raw) => {
		const row = (raw ?? {}) as DocumentRow;
		const title = row.DocumentTitle ?? '';
		const comment = stripTags(title);
		return {
			_DocumentGU: docTokenOf(title),
			_DocumentFileName: comment,
			_DocumentDate: row.DocumentUploadDate ?? '',
			_DocumentType: row.DocumentCategory ?? '',
			_StudentGU: studentGU,
			_DocumentComment: comment
		};
	});

	return buildInner('StudentDocuments', {
		...XMLNS,
		_StudentGU: studentGU,
		StudentDocumentDatas: StudentDocumentData.length ? { StudentDocumentData } : {}
	});
}

// ---------------------------------------------------------------------------
// Report card / document contents (opened by docToken)
// ---------------------------------------------------------------------------

export function reportCardXml(
	documentGU: string,
	base64: string,
	fileName = 'document.pdf'
): string {
	if (!base64) {
		return buildInner('DocumentData', { ...XMLNS });
	}
	return buildInner('DocumentData', {
		...XMLNS,
		_DocumentGU: documentGU,
		_FileName: fileName,
		_DocFileName: fileName,
		_DocType: 'Document',
		Base64Code: base64
	});
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

interface AbsenceRow {
	AbsenceDate?: string;
	Date?: string;
	Reason?: string;
	Note?: string;
}

/**
 * Build an Attendance document. When the account has no absences (common), this
 * yields a valid empty structure. Rows, when present, are mapped best-effort; the
 * per-period breakdown is refined once a populated sample is captured.
 */
export function attendanceXml(schoolName: string, rows: unknown[] = []): string {
	const Absence = rows.map((raw) => {
		const row = (raw ?? {}) as AbsenceRow;
		return {
			_AbsenceDate: row.AbsenceDate ?? row.Date ?? '',
			_Reason: row.Reason ?? '',
			_Note: row.Note ?? '',
			_DailyIconName: '',
			_CodeAllDayReasonType: '',
			_CodeAllDayDescription: row.Reason ?? '',
			Periods: {}
		};
	});

	return buildInner('Attendance', {
		...XMLNS,
		_Type: 'Attendance',
		_SchoolName: schoolName,
		Absences: Absence.length ? { Absence } : {},
		TotalExcused: {},
		TotalTardies: {},
		TotalUnexcused: {},
		TotalActivities: {},
		TotalUnexcusedTardies: {}
	});
}
