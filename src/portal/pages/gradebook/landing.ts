import { decodeEntities, extractJsonAfter, stripTags } from '../../../extract/index';
import { ParseError } from '../../errors';

// PXP2_Gradebook.aspx server-renders the class list for the default grading
// period and seeds PXP.GBFocusData with every grading period's GUIDs. Each
// class row carries a data-focus attribute holding the complete, verbatim
// parameter set for its Gradebook_ClassDetails call - always reuse it rather
// than reassembling the arguments.

export interface MarkPeriodRef {
	name: string;
	gu: string;
}

export interface GradingPeriod {
	name: string;
	gu: string;
	groupName: string;
	orgYearGu: string;
	schoolId: number;
	markPeriods: MarkPeriodRef[];
	defaultFocus: boolean;
}

export interface LandingClass {
	classId: string;
	name: string;
	period: string;
	teacher: string;
	room: string;
	mark: string;
	missingCount: number;
	// Skip signal: an untouched class (no mark, no missing work, no score
	// history, never updated by the teacher) has nothing behind its detail view.
	mayHaveWork: boolean;
	markPeriodName: string;
	focusArgs: Record<string, unknown>;
}

export interface GradebookLanding {
	periods: GradingPeriod[];
	currentPeriodIndex: number;
	agu: string;
	classes: LandingClass[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const str = (value: unknown): string =>
	typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';

// data-focus is single-quoted raw JSON on some elements and entity-encoded
// double-quoted JSON on others; only the latter needs decoding before parsing.
function parseFocusAttr(raw: string, wasDoubleQuoted: boolean): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(wasDoubleQuoted ? decodeEntities(raw) : raw);
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function attr(source: string, name: string): { value: string; doubleQuoted: boolean } | undefined {
	const match = new RegExp(`${name}\\s*=\\s*(?:'([^']*)'|"([^"]*)")`).exec(source);
	if (!match) return undefined;
	return match[1] !== undefined
		? { value: match[1], doubleQuoted: false }
		: { value: match[2] ?? '', doubleQuoted: true };
}

function toPeriods(focusData: Record<string, unknown>): GradingPeriod[] {
	const periods: GradingPeriod[] = [];
	for (const school of asArray(focusData['Schools'])) {
		if (!isRecord(school)) continue;
		const schoolId = typeof school['SchoolID'] === 'number' ? school['SchoolID'] : -1;
		for (const gp of asArray(school['GradingPeriods'])) {
			if (!isRecord(gp)) continue;
			periods.push({
				name: str(gp['Name']),
				gu: str(gp['GU']),
				groupName: str(gp['GroupName']),
				orgYearGu: str(gp['OrgYearGU']),
				schoolId,
				markPeriods: asArray(gp['MarkPeriods'])
					.filter(isRecord)
					.map((mp) => ({ name: str(mp['Name']), gu: str(mp['GU']) })),
				defaultFocus: gp['defaultFocus'] === true
			});
		}
	}
	return periods;
}

// Works on the full landing page and on Gradebook_SchoolClasses fragments -
// both render the same two-row-per-class markup.
export function parseLandingClasses(html: string): LandingClass[] {
	const marker = 'gb-class-header';
	const starts: number[] = [];
	let from = 0;
	for (;;) {
		const i = html.indexOf(marker, from);
		if (i === -1) break;
		starts.push(i);
		from = i + marker.length;
	}

	const classes: LandingClass[] = [];
	for (const [k, start] of starts.entries()) {
		const block = html.slice(start, starts[k + 1] ?? html.length);

		const titleButton = /class="[^"]*course-title[^"]*"[^>]*>([^<]*)</.exec(block);
		// Some districts put data-focus only on the mark-period button; both
		// buttons carry the same FocusArgs where both exist.
		const focusRaw =
			/course-title[^>]*data-focus\s*=\s*(?:'([^']*)'|"([^"]*)")/.exec(block) ??
			/course-markperiod[^>]*data-focus\s*=\s*(?:'([^']*)'|"([^"]*)")/.exec(block);
		if (!titleButton || !focusRaw) continue;
		const focus = parseFocusAttr(
			focusRaw[1] ?? focusRaw[2] ?? '',
			focusRaw[1] === undefined
		);
		const focusArgs = focus && isRecord(focus['FocusArgs']) ? focus['FocusArgs'] : undefined;
		if (!focusArgs) continue;

		const title = decodeEntities(titleButton[1] ?? '').trim();
		const numbered = /^(\d+)\s*:\s*(.*)$/.exec(title);

		const mark = stripTags(/<span class="mark">([^<]*)<\/span>/.exec(block)?.[1] ?? '');
		const missing = Number.parseInt(
			/(\d+)\s+Missing Assignments/.exec(block)?.[1] ?? '0',
			10
		);
		const lastUpdate = (/Last Update:\s*([^<]*)</.exec(block)?.[1] ?? '').trim();
		const history = /<ul class="score-history[^"]*">([\s\S]*?)<\/ul>/.exec(block)?.[1] ?? '';
		const markPeriodName = stripTags(
			/class="[^"]*course-markperiod[^"]*"[^>]*>([^<]*)</.exec(block)?.[1] ?? ''
		);

		classes.push({
			classId: str(focusArgs['classID']) || (attr(block, 'data-guid')?.value ?? ''),
			name: numbered?.[2]?.trim() || title,
			period: numbered?.[1] ?? '',
			teacher: stripTags(/class="teacher hide-for-screen"[^>]*>([^<]*)</.exec(block)?.[1] ?? ''),
			room: (/class="teacher-room[^"]*"[^>]*>\s*Room:\s*([^<]*)</.exec(block)?.[1] ?? '').trim(),
			mark,
			missingCount: Number.isNaN(missing) ? 0 : missing,
			mayHaveWork:
				(mark !== '' && mark !== 'N/A') ||
				missing > 0 ||
				lastUpdate !== '' ||
				history.includes('<li'),
			markPeriodName,
			focusArgs
		});
	}
	return classes;
}

export function parseGradebookLanding(html: string): GradebookLanding {
	const focusData = extractJsonAfter(html, 'PXP.GBFocusData');
	if (!isRecord(focusData)) {
		throw new ParseError('The gradebook page had no PXP.GBFocusData block.');
	}
	const periods = toPeriods(focusData);
	if (periods.length === 0) {
		throw new ParseError('The gradebook page listed no grading periods.');
	}

	const currentFocus = extractJsonAfter(html, 'PXP.GBCurrentFocus');
	const focusArgs =
		isRecord(currentFocus) && isRecord(currentFocus['FocusArgs'])
			? currentFocus['FocusArgs']
			: undefined;

	const defaultIndex = periods.findIndex((p) => p.defaultFocus);
	return {
		periods,
		currentPeriodIndex: defaultIndex === -1 ? 0 : defaultIndex,
		agu: str(focusArgs?.['AGU']) || '0',
		classes: parseLandingClasses(html)
	};
}
