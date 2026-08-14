import { describe, expect, it } from 'vitest';
import { extractPortalDomain } from '../portal/domainInput';
import { validatePortalDomain } from '../portal/login';
import { DISTRICTS } from './districts.js';

// Integrity of the generated district list behind the login dropdown.
describe('DISTRICTS', () => {
	it('has a real amount of data', () => {
		expect(DISTRICTS.length).toBeGreaterThan(700);
	});

	it('every entry has a state, a name, and a valid portal domain', () => {
		for (const d of DISTRICTS) {
			expect(d.name).toBeTruthy();
			expect(d.state.length).toBeGreaterThan(2); // full state names, not codes
			expect(() => validatePortalDomain(d.domain)).not.toThrow();
		}
	});

	it('domains are already normalized (what the paste parser would produce)', () => {
		for (const d of DISTRICTS) {
			expect(extractPortalDomain(d.domain)).toBe(d.domain);
		}
	});

	it('has no duplicate name+domain entries', () => {
		const keys = new Set(DISTRICTS.map((d) => `${d.domain}||${d.name}`));
		expect(keys.size).toBe(DISTRICTS.length);
	});

	it('is sorted by state, then name, so the dropdown can group sequentially', () => {
		for (let i = 1; i < DISTRICTS.length; i++) {
			const prev = DISTRICTS[i - 1]!;
			const cur = DISTRICTS[i]!;
			const order =
				prev.state.localeCompare(cur.state) || prev.name.localeCompare(cur.name) || prev.domain.localeCompare(cur.domain);
			expect(order).toBeLessThanOrEqual(0);
		}
	});

	it('contains a known canary district', () => {
		expect(DISTRICTS).toContainEqual({
			state: 'California',
			name: 'San Francisco Unified School District',
			domain: 'ca-sfu-psv.edupoint.com',
		});
	});
});
