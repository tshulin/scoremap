import { beforeEach, describe, expect, it } from 'vitest';
import { assertNotBounced } from '../../src/extract/index.js';
import { createMockPortal, MOCK_CREDENTIALS, mockPortalFetch } from '../../src/mock/portal.js';
import { AuthError, ModuleUnavailableError, SessionExpiredError } from '../../src/portal/errors.js';
import { fetchFollow } from '../../src/portal/http.js';
import { login, type PortalSession } from '../../src/portal/login.js';
import {
	downloadDocument,
	fetchAttendance,
	fetchDocuments,
	fetchStudentInfo
} from '../../src/portal/pages/index.js';
import { SessionStore } from '../../src/portal/session.js';

const portalOptions = (options?: Parameters<typeof createMockPortal>[0]) => ({
	fetchImpl: mockPortalFetch(createMockPortal(options))
});

const signIn = async (options?: Parameters<typeof createMockPortal>[0]) => {
	const opts = portalOptions(options);
	const session = await login(MOCK_CREDENTIALS, opts);
	return { session, opts };
};

describe('login against the mock portal', () => {
	it('completes the WebForms flow and collects both cookies', async () => {
		const { session } = await signIn();

		expect(session.domain).toBe(MOCK_CREDENTIALS.domain);
		expect(session.jar.get('ASP.NET_SessionId')).toBe('mock-session-id');
		expect(session.jar.get('EESPSV')).toBe('mock-auth-token');
	});

	it('rejects a wrong password', async () => {
		await expect(
			login({ ...MOCK_CREDENTIALS, password: 'wrong' }, portalOptions())
		).rejects.toThrow(AuthError);
	});

	it('is not fooled by the password input on the landing page', async () => {
		await expect(login(MOCK_CREDENTIALS, portalOptions())).resolves.toBeDefined();
	});
});

describe('page clients against the mock portal', () => {
	let session: PortalSession;
	let opts: { fetchImpl: ReturnType<typeof mockPortalFetch> };

	beforeEach(async () => {
		({ session, opts } = await signIn());
	});

	it('reads student info end to end, including the portrait', async () => {
		const info = await fetchStudentInfo(session, opts);

		expect(info).toMatchObject({ name: 'Sample Student', permId: '999001', grade: '11' });
		expect(info.photoBase64).toMatch(/^iVBORw0KGgo/);
	});

	it('lists documents and downloads one', async () => {
		const docs = await fetchDocuments(session, opts);
		expect(docs).toHaveLength(2);

		const file = await downloadDocument(session, docs[0]!.docToken, opts);
		expect(file.mimeType).toBe('application/pdf');
		expect(file.fileName).toBe('Report Card.pdf');
		expect(new TextDecoder().decode(file.bytes)).toContain('%PDF');
	});

	it('reads attendance for an account with no absences', async () => {
		await expect(fetchAttendance(session, opts)).resolves.toEqual({
			schoolName: 'Example High School',
			absences: []
		});
	});

	it('reads attendance rows when the account has absences', async () => {
		const { session: s, opts: o } = await signIn({ withAbsences: true });

		const attendance = await fetchAttendance(s, o);

		expect(attendance.absences).toHaveLength(2);
		expect(attendance.absences[0]).toMatchObject({ date: '2026-03-02', reason: 'Excused Absence' });
	});

	it('reports the gradebook as unavailable out of term', async () => {
		const page = await fetchFollow(
			`https://${session.domain}/PXP2_Gradebook.aspx?AGU=0`,
			{ method: 'GET' },
			session.jar,
			opts
		);
		expect(page.redirected).toBe(true);
		expect(new URL(page.finalUrl).pathname).toBe('/Home_PXP2.aspx');
	});

	it('surfaces a dead portal session as SessionExpiredError', async () => {
		const expired = portalOptions({ sessionExpired: true });

		await expect(fetchStudentInfo(session, expired)).rejects.toThrow(SessionExpiredError);
	});

	it('reports a bounced module distinctly from an expired session', async () => {
		const page = await fetchFollow(
			`https://${session.domain}/PXP2_Gradebook.aspx?AGU=0`,
			{ method: 'GET' },
			session.jar,
			opts
		);

		expect(() => assertNotBounced(page, 'Gradebook')).toThrow(ModuleUnavailableError);
	});
});

describe('SessionStore against the mock portal', () => {
	it('logs in, stores the session, and serves page requests through it', async () => {
		const store = new SessionStore({ fetchOptions: portalOptions() });

		const token = await store.create(MOCK_CREDENTIALS);
		const info = await store.withSession(token, (session) =>
			fetchStudentInfo(session, portalOptions())
		);

		expect(info.name).toBe('Sample Student');
	});

	it('re-logins when the portal session dies mid-request', async () => {
		const store = new SessionStore({ fetchOptions: portalOptions() });
		const token = await store.create(MOCK_CREDENTIALS);

		let attempt = 0;
		const info = await store.withSession(token, (session) => {
			attempt++;
			return fetchStudentInfo(session, portalOptions({ sessionExpired: attempt === 1 }));
		});

		expect(attempt).toBe(2);
		expect(info.name).toBe('Sample Student');
	});
});

describe('mock portal itself', () => {
	it('bounces unauthenticated requests to the login page', async () => {
		const app = createMockPortal();

		const res = await app.fetch(new Request('https://mock/PXP2_Student.aspx?AGU=0'));

		expect(res.status).toBe(302);
		expect(res.headers.get('location')).toContain('PXP2_Login_Student.aspx');
	});

	it('serves an error page for a document request with no token', async () => {
		const { session, opts } = await signIn();

		await expect(downloadDocument(session, '', opts)).rejects.toThrow(ModuleUnavailableError);
	});
});
