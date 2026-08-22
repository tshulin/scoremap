import { ParseError } from '../portal/errors';

const pad = (value: string): string => value.padStart(2, '0');

// The portal's own dates are all in the 2000s (2-digit years appear on the
// gradebook assignment grid, e.g. "8/14/26" - live-observed 2026-08-21).
const fullYear = (year: string): string => (year.length === 2 ? `20${year}` : year);

export function toIsoDate(raw: string): string {
	const value = raw.trim();

	// Reject an extra date digit while allowing a following time.
	const iso = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(value);
	if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

	const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/.exec(value);
	if (us) {
		const [month, day, year] = [Number(us[1]), Number(us[2]), fullYear(us[3]!)];
		if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
			return `${year}-${pad(String(month))}-${pad(String(day))}`;
		}
	}

	throw new ParseError(`Unrecognized portal date format: ${JSON.stringify(raw)}`);
}
