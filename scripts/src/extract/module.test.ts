import { describe, expect, it } from 'vitest';
import { ModuleUnavailableError } from '../portal/errors.js';
import { assertNotBounced } from './module.js';

describe('assertNotBounced', () => {
	it('throws when the module redirected away', () => {
		expect(() =>
			assertNotBounced(
				{ redirected: true, finalUrl: 'https://d-psv.edupoint.com/Home_PXP2.aspx' },
				'Gradebook'
			)
		).toThrow(ModuleUnavailableError);
	});

	it('names the module and the landing path', () => {
		expect(() =>
			assertNotBounced(
				{ redirected: true, finalUrl: 'https://d-psv.edupoint.com/Home_PXP2.aspx' },
				'Gradebook'
			)
		).toThrow(/Gradebook.*\/Home_PXP2\.aspx/);
	});

	it('passes when the module rendered in place', () => {
		expect(() =>
			assertNotBounced(
				{ redirected: false, finalUrl: 'https://d-psv.edupoint.com/PXP2_Gradebook.aspx?AGU=0' },
				'Gradebook'
			)
		).not.toThrow();
	});
});
