import { describe, expect, it } from 'vitest';
import { portalFixture } from '../../../test/helpers/fixtures.js';
import { htmlPage, redirectTo, scriptedFetch, testSession } from '../../../test/helpers/portal.js';
import { ParseError, SessionExpiredError } from '../errors.js';
import { fetchStudentInfo } from './studentInfo.js';

const STUDENT_HTML = portalFixture('student.html');

const photoResponse = (bytes: Uint8Array) =>
	new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });

describe('fetchStudentInfo', () => {
	it('parses the student fields and the portrait', async () => {
		const { impl, calls } = scriptedFetch([
			() => htmlPage(STUDENT_HTML),
			() => photoResponse(new Uint8Array([1, 2, 3]))
		]);

		const info = await fetchStudentInfo(testSession(), { fetchImpl: impl });

		expect(info).toEqual({
			name: 'Sample Student',
			permId: '999001',
			gender: 'Female',
			grade: '11',
			photoBase64: 'AQID'
		});
		expect(calls[0]?.url).toBe('https://district-psv.edupoint.com/PXP2_Student.aspx?AGU=0');
		expect(calls[1]?.url).toBe(
			'https://district-psv.edupoint.com/Photos/AB/ABCDEF12-3456-7890-ABCD-EF1234567890_Photo.PNG'
		);
	});

	it('omits the photo when the portal has no portrait path', async () => {
		const { impl, calls } = scriptedFetch([
			() => htmlPage(STUDENT_HTML.replace(/"photo":[^,]+,/, ''))
		]);

		const info = await fetchStudentInfo(testSession(), { fetchImpl: impl });

		expect(info.photoBase64).toBeUndefined();
		expect(calls).toHaveLength(1);
	});

	it('degrades to no photo when the portrait fails to load', async () => {
		const { impl } = scriptedFetch([
			() => htmlPage(STUDENT_HTML),
			() => new Response('nope', { status: 404 })
		]);

		const info = await fetchStudentInfo(testSession(), { fetchImpl: impl });

		expect(info.photoBase64).toBeUndefined();
		expect(info.name).toBe('Sample Student');
	});

	it('accepts the alternate district label spellings', async () => {
		const alt =
			'<span class="tbl_label">Name</span><br>Alt Student' +
			'<span class="tbl_label">Student ID</span><br>4242' +
			'<span class="tbl_label">Gender</span><br>Male' +
			'<span class="tbl_label">Grade</span><br>9';
		const { impl } = scriptedFetch([() => htmlPage(alt)]);

		const info = await fetchStudentInfo(testSession(), { fetchImpl: impl });

		expect(info).toMatchObject({ name: 'Alt Student', permId: '4242' });
	});

	it('throws ParseError when the page has no student fields', async () => {
		const { impl } = scriptedFetch([() => htmlPage('<html>unexpected</html>')]);

		await expect(fetchStudentInfo(testSession(), { fetchImpl: impl })).rejects.toThrow(ParseError);
	});

	it('throws SessionExpiredError when the portal bounces to the login page', async () => {
		const { impl } = scriptedFetch([
			() => redirectTo('/PXP2_Login_Student.aspx'),
			() => htmlPage('<html>login form</html>')
		]);

		await expect(fetchStudentInfo(testSession(), { fetchImpl: impl })).rejects.toThrow(
			SessionExpiredError
		);
	});
});
