import { describe, expect, it } from 'vitest';
import { userRegion } from './region.js';

describe('userRegion', () => {
	it('routes Pacific and Mountain zones west by name, DST-proof', () => {
		expect(userRegion({ timeZone: 'America/Los_Angeles', offsetMinutes: 420 })).toBe('west');
		// Denver in summer sits at UTC-6 - the offset alone would say east.
		expect(userRegion({ timeZone: 'America/Denver', offsetMinutes: 360 })).toBe('west');
		expect(userRegion({ timeZone: 'America/Phoenix', offsetMinutes: 420 })).toBe('west');
		expect(userRegion({ timeZone: 'Pacific/Honolulu', offsetMinutes: 600 })).toBe('west');
	});

	it('routes Central and Eastern zones east', () => {
		expect(userRegion({ timeZone: 'America/New_York', offsetMinutes: 300 })).toBe('east');
		expect(userRegion({ timeZone: 'America/Chicago', offsetMinutes: 360 })).toBe('east');
	});

	it('falls back to the UTC offset for unknown zones, split at UTC-6:30', () => {
		expect(userRegion({ timeZone: 'Etc/Unknown', offsetMinutes: 480 })).toBe('west');
		expect(userRegion({ timeZone: null, offsetMinutes: 300 })).toBe('east');
		expect(userRegion({ timeZone: null, offsetMinutes: 390 })).toBe('west');
		expect(userRegion({ timeZone: null, offsetMinutes: 389 })).toBe('east');
	});

	it('answers from the real environment without arguments', () => {
		expect(['west', 'east']).toContain(userRegion());
	});
});
