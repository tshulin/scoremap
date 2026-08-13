import { bootstrapValue, parseLabeledFields } from '../../src/extract/index.js';

export interface Replacement {
	what: string;
	from: string;
	to: string;
	count: number;
}

export interface SanitizeResult {
	html: string;
	replacements: Replacement[];
	residuals: string[];
	warnings: string[];
}

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const DOC_TOKEN_RE = /docToken=([^"&\\<]+)/g;

const countOf = (haystack: string, needle: string): number =>
	needle ? haystack.split(needle).length - 1 : 0;

const fakeGuid = (index: number): string => {
	const n = String(index + 1).padStart(4, '0');
	return `ABCDEF12-3456-7890-ABCD-${n}0000000${(index % 10).toString()}`.slice(0, 36);
};

const byLengthDesc = (a: string, b: string): number => b.length - a.length;

export function sanitizeCapture(html: string): SanitizeResult {
	const fields = parseLabeledFields(html);
	const replacements: Replacement[] = [];
	const known: string[] = [];

	const plan = new Map<string, { to: string; what: string }>();
	const add = (what: string, from: string | undefined, to: string): void => {
		if (!from || plan.has(from)) return;
		plan.set(from, { to, what });
		known.push(from);
	};

	const name = fields['Student Name'] ?? fields['Name'];
	if (name) {
		add('student name', name, 'Sample Student');
		const parts = name.split(/\s+/).filter(Boolean);
		if (parts.length >= 2) {
			add('student name (reversed)', `${parts.at(-1)}, ${parts[0]}`, 'Student, Sample');
		}
		const fakeParts = ['Sample', 'Student'];
		parts.forEach((part, i) => {
			if (part.length >= 4) add(`name part`, part, fakeParts[i] ?? 'Sample');
		});
	}
	add('perm id', fields['Perm ID'] ?? fields['Student ID'], '999001');
	add('photo path', bootstrapValue(html, 'photo'), 'Photos/AB/ABCDEF12-3456-7890-ABCD-EF1234567890_Photo.PNG');
	add('school', bootstrapValue(html, 'school'), 'Example High School');
	add('district', bootstrapValue(html, 'SchoolName'), 'Example Unified School District');

	[...new Set(html.match(EMAIL_RE) ?? [])].forEach((email, i) => {
		add('email', email, `teacher${i + 1}@example.edu`);
	});
	[...new Set(html.match(GUID_RE) ?? [])].forEach((guid, i) => {
		add('guid', guid, fakeGuid(i));
	});
	[...new Set([...html.matchAll(DOC_TOKEN_RE)].map((m) => m[1]!))].forEach((token, i) => {
		add('docToken', token, `bW9ja0RvY1Rva2Vu${i + 1}`);
	});

	let output = html;
	for (const from of [...plan.keys()].sort(byLengthDesc)) {
		const { to, what } = plan.get(from)!;
		const count = countOf(output, from);
		if (count === 0) continue;
		output = output.replaceAll(from, to);
		replacements.push({ what, from, to, count });
	}

	const residuals = known.filter((value) => output.includes(value));

	const warnings: string[] = [];
	const leftoverEmails = [...new Set(output.match(EMAIL_RE) ?? [])].filter(
		(email) => !email.endsWith('@example.edu')
	);
	const leftoverGuids = [...new Set(output.match(GUID_RE) ?? [])].filter(
		(guid) => !guid.startsWith('ABCDEF12')
	);
	if (leftoverEmails.length) warnings.push(`emails still present: ${leftoverEmails.join(', ')}`);
	if (leftoverGuids.length) warnings.push(`GUIDs still present: ${leftoverGuids.length} value(s)`);

	return { html: output, replacements, residuals, warnings };
}

export function formatReport(result: SanitizeResult): string {
	const lines = ['Replacements:'];
	if (result.replacements.length === 0) lines.push('  (none — is this really a portal capture?)');
	for (const { what, to, count } of result.replacements) {
		lines.push(`  ${what.padEnd(22)} -> ${to.padEnd(46)} (${count}x)`);
	}
	if (result.warnings.length) {
		lines.push('', 'Warnings — review these by hand:');
		result.warnings.forEach((warning) => lines.push(`  ! ${warning}`));
	}
	return lines.join('\n');
}
