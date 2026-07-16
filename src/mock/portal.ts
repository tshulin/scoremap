import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { fixture, PDF_BYTES, PNG_BYTES } from './fixtures.js';

const LOGIN_PATH = '/PXP2_Login_Student.aspx';
const HOME_PATH = '/Home_PXP2.aspx';

const AUTH_COOKIE = 'EESPSV';
const SESSION_COOKIE = 'ASP.NET_SessionId';

export interface MockPortalOptions {
	username?: string;
	password?: string;
	gradebookAvailable?: boolean;
	withAbsences?: boolean;
	sessionExpired?: boolean;
}

export const MOCK_CREDENTIALS = {
	domain: 'mock-psv.edupoint.com',
	username: 'student@example.edu',
	password: 'correct-horse'
};

export function createMockPortal(options: MockPortalOptions = {}) {
	const {
		username = MOCK_CREDENTIALS.username,
		password = MOCK_CREDENTIALS.password,
		gradebookAvailable = false,
		withAbsences = false,
		sessionExpired = false
	} = options;

	const app = new Hono();

	app.get(LOGIN_PATH, (c) => {
		setCookie(c, SESSION_COOKIE, 'mock-session-id', { httpOnly: true, path: '/' });
		return c.html(fixture('login.html'));
	});

	app.post(LOGIN_PATH, async (c) => {
		const form = await c.req.parseBody();
		if (typeof form['__VIEWSTATE'] !== 'string') {
			return c.html(fixture('login.html'));
		}
		const ok =
			form['ctl00$MainContent$username'] === username &&
			form['ctl00$MainContent$password'] === password;

		if (!ok) return c.html(fixture('login.html'));

		setCookie(c, AUTH_COOKIE, 'mock-auth-token', { httpOnly: true, path: '/' });
		return c.redirect(HOME_PATH, 302);
	});

	app.use('*', async (c, next) => {
		if (c.req.path === LOGIN_PATH) return next();
		const authed = !sessionExpired && getCookie(c, AUTH_COOKIE) !== undefined;
		if (!authed) return c.redirect(`${LOGIN_PATH}?regenerateSessionId=True`, 302);
		return next();
	});

	app.get(HOME_PATH, (c) => c.html(fixture('home.html')));
	app.get('/PXP2_Student.aspx', (c) => c.html(fixture('student.html')));
	app.get('/PXP2_Documents.aspx', (c) => c.html(fixture('documents.html')));
	app.get('/PXP2_Attendance.aspx', (c) =>
		c.html(fixture(withAbsences ? 'attendance-absences.html' : 'attendance-empty.html'))
	);

	app.get('/PXP2_Gradebook.aspx', (c) => {
		if (!gradebookAvailable) return c.redirect(HOME_PATH, 302);
		return c.html('<html><body>Gradebook fixture unavailable</body></html>');
	});

	const knownDocTokens = new Set(
		[...fixture('documents.html').matchAll(/docToken=([^"&\\]+)/g)].map(([, token]) => token!)
	);

	app.get('/PXP_ShowDocument.aspx', (c) => {
		const token = c.req.query('docToken');
		if (!token || !knownDocTokens.has(token)) {
			return c.html('<html><body>Document not available</body></html>');
		}
		return new Response(PDF_BYTES, {
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': 'attachment; filename="Report Card.pdf"'
			}
		});
	});

	app.get('/Photos/*', () => new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } }));

	app.all('*', (c) => c.html(`<html><body>Not found: ${c.req.path}</body></html>`, 404));

	return app;
}

export const mockPortalFetch =
	(app: ReturnType<typeof createMockPortal>) =>
	async (url: string, init: RequestInit): Promise<Response> =>
		app.fetch(new Request(url, init));
