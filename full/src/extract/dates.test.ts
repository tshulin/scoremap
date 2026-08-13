import { describe, expect, it } from 'vitest';
import { ParseError } from '../portal/errors.js';
import { toIsoDate } from './dates.js';

describe('toIsoDate', () => {
	it("converts the portal's zero-padded US dates", () => {
		expect(toIsoDate('06/12/2026')).toBe('2026-06-12');
	});

	it('converts unpadded US dates', () => {
		expect(toIsoDate('5/18/2026')).toBe('2026-05-18');
		expect(toIsoDate('1/2/2026')).toBe('2026-01-02');
	});

	it('reads month first, not day first', () => {
		expect(toIsoDate('05/18/2026')).toBe('2026-05-18');
		expect(toIsoDate('03/04/2026')).toBe('2026-03-04');
	});

	it('passes ISO dates through and drops any time part', () => {
		expect(toIsoDate('2026-06-12')).toBe('2026-06-12');
		expect(toIsoDate('2026-06-12T08:00:00')).toBe('2026-06-12');
	});

	it('tolerates surrounding whitespace', () => {
		expect(toIsoDate('  06/12/2026 ')).toBe('2026-06-12');
	});

	it.each(['', 'not a date', '13/01/2026', '06/32/2026', '6-12-2026', '06/12/26'])(
		'throws ParseError on %j rather than guessing',
		(value) => {
			expect(() => toIsoDate(value)).toThrow(ParseError);
		}
	);
});
