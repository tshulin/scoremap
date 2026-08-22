import { describe, expect, it } from 'vitest';
import { ParseError } from '../portal/errors';
import { toIsoDate } from './dates';

describe('toIsoDate', () => {
	it('passes ISO dates through, dropping any time', () => {
		expect(toIsoDate('2026-08-14')).toBe('2026-08-14');
		expect(toIsoDate('2026-08-14T09:30:00')).toBe('2026-08-14');
	});

	it('converts US dates with 4-digit years', () => {
		expect(toIsoDate('8/14/2026')).toBe('2026-08-14');
		expect(toIsoDate('08/14/2026 9:30 AM')).toBe('2026-08-14');
	});

	// The gradebook assignment grid dates its rows "8/14/26" (live 2026-08-21).
	it('converts US dates with 2-digit years', () => {
		expect(toIsoDate('8/14/26')).toBe('2026-08-14');
		expect(toIsoDate('12/1/26')).toBe('2026-12-01');
	});

	it('rejects anything else', () => {
		expect(() => toIsoDate('8/14/265')).toThrow(ParseError);
		expect(() => toIsoDate('14/8/26')).toThrow(ParseError);
		expect(() => toIsoDate('')).toThrow(ParseError);
	});
});
