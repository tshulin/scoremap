import { describe, expect, it } from 'vitest';
import {
	htmlPage,
	redirectTo,
	scriptedFetch,
	testSession
} from '../../../../test/helpers/portal.js';
import { NoActiveGradingPeriodError, ParseError, SessionExpiredError } from '../../errors.js';
import { fetchGradebook } from './index.js';

describe('fetchGradebook', () => {
	it('reports no active grading period when the module bounces to Home', async () => {
		const { impl, calls } = scriptedFetch([
			() => redirectTo('/Home_PXP2.aspx'),
			() => htmlPage('<html>home</html>')
		]);

		await expect(fetchGradebook(testSession(), undefined, { fetchImpl: impl })).rejects.toThrow(
			NoActiveGradingPeriodError
		);
		expect(calls[0]?.url).toBe('https://district-psv.edupoint.com/PXP2_Gradebook.aspx?AGU=0');
	});

	it('distinguishes an expired session from a missing grading period', async () => {
		const { impl } = scriptedFetch([
			() => redirectTo('/PXP2_Login_Student.aspx'),
			() => htmlPage('<html>login</html>')
		]);

		await expect(fetchGradebook(testSession(), undefined, { fetchImpl: impl })).rejects.toThrow(
			SessionExpiredError
		);
	});

	it('fails clearly while parsing is unavailable', async () => {
		const { impl } = scriptedFetch([() => htmlPage('<html>a real gradebook</html>')]);

		await expect(fetchGradebook(testSession(), undefined, { fetchImpl: impl })).rejects.toThrow(
			ParseError
		);
	});
});
