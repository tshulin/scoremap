import { describe, expect, it } from 'vitest';
import { portalFixture } from '../../../test/helpers/fixtures.js';
import { htmlPage, redirectTo, scriptedFetch, testSession } from '../../../test/helpers/portal.js';
import { ModuleUnavailableError } from '../errors.js';
import { fetchAttendance } from './attendance.js';

const EMPTY_HTML = portalFixture('attendance-empty.html');
const ABSENCES_HTML = portalFixture('attendance-absences.html');

describe('fetchAttendance', () => {
	it('returns an empty absence list for an account with perfect attendance', async () => {
		const { impl, calls } = scriptedFetch([() => htmlPage(EMPTY_HTML)]);

		const attendance = await fetchAttendance(testSession(), { fetchImpl: impl });

		expect(calls[0]?.url).toBe('https://district-psv.edupoint.com/PXP2_Attendance.aspx?AGU=0');
		expect(attendance).toEqual({
			schoolName: 'Example High School',
			absences: [],
			unreadableAbsences: 0
		});
	});

	it('maps absence rows, normalizing dates and stripping cell markup', async () => {
		const { impl } = scriptedFetch([() => htmlPage(ABSENCES_HTML)]);

		const attendance = await fetchAttendance(testSession(), { fetchImpl: impl });

		expect(attendance.schoolName).toBe('Example High School');
		expect(attendance.absences).toEqual([
			{
				date: '2026-03-02',
				reason: 'Excused Absence',
				periods: [
					{ period: '1', reason: 'Excused Absence' },
					{ period: '2', reason: 'Excused Absence' }
				]
			},
			{
				date: '2026-04-15',
				reason: 'Tardy',
				note: 'Late bus'
			}
		]);
	});

	it('throws ModuleUnavailableError when the module bounces away', async () => {
		const { impl } = scriptedFetch([
			() => redirectTo('/Home_PXP2.aspx'),
			() => htmlPage('<html>home</html>')
		]);

		await expect(fetchAttendance(testSession(), { fetchImpl: impl })).rejects.toThrow(
			ModuleUnavailableError
		);
	});

	it('still reports absences when the school name is missing', async () => {
		const { impl } = scriptedFetch([() => htmlPage(EMPTY_HTML.replace(/"school":[^,]+,/, ''))]);

		await expect(fetchAttendance(testSession(), { fetchImpl: impl })).resolves.toEqual({
			schoolName: '',
			absences: [],
			unreadableAbsences: 0
		});
	});

	it('counts no unreadable rows when every row parses', async () => {
		const { impl } = scriptedFetch([() => htmlPage(ABSENCES_HTML)]);

		const attendance = await fetchAttendance(testSession(), { fetchImpl: impl });

		expect(attendance.unreadableAbsences).toBe(0);
	});

	it('skips a row it cannot read rather than losing the whole page', async () => {
		// The row shape is a reconstruction (see note.md), so an unexpected one is likely.
		// One bad date must not hide the absences we can read.
		const html = ABSENCES_HTML.replace('"Date":"4/15/2026"', '"Date":"sometime last spring"');
		const { impl } = scriptedFetch([() => htmlPage(html)]);

		const attendance = await fetchAttendance(testSession(), { fetchImpl: impl });

		expect(attendance.absences).toHaveLength(1);
		expect(attendance.absences[0]?.date).toBe('2026-03-02');
		expect(attendance.unreadableAbsences).toBe(1);
	});

	it('reports the count so a short list is never mistaken for a complete one', async () => {
		const html = ABSENCES_HTML.replace(/"Date":"[^"]+"/g, '"Date":"???"');
		const { impl } = scriptedFetch([() => htmlPage(html)]);

		const attendance = await fetchAttendance(testSession(), { fetchImpl: impl });

		expect(attendance.absences).toEqual([]);
		expect(attendance.unreadableAbsences).toBe(2);
	});

	it('still fails loudly when the fault is ours, not the row shape', async () => {
		// A ParseError means "this row is not what we expected"; anything else is a bug and
		// must not be silently counted as an unreadable row.
		const { impl } = scriptedFetch([
			() => {
				throw new TypeError('fetch exploded');
			}
		]);

		await expect(fetchAttendance(testSession(), { fetchImpl: impl })).rejects.toThrow();
	});
});
