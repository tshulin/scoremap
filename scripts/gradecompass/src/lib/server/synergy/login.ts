/**
 * Log in to a Synergy (StudentVUE) web portal and return an authenticated cookie
 * jar. The portal login is a standard ASP.NET WebForms postback:
 *   1. GET /PXP2_Login_Student.aspx (302 -> ?regenerateSessionId=true) seeds the
 *      ASP.NET_SessionId + EESPSV cookies and returns the login form.
 *   2. POST username/password plus the __VIEWSTATE / __EVENTVALIDATION hidden
 *      fields; a successful login 302-redirects to Home_PXP2.aspx.
 */

import { cookieHeader, createJar, fetchFollow, type CookieJar } from './http';

export class SynergyAuthError extends Error {
	constructor(message = 'Invalid username or password') {
		super(message);
		this.name = 'SynergyAuthError';
	}
}

export interface SynergySession {
	domain: string;
	jar: CookieJar;
	/** The `Cookie` header string for authenticated requests. */
	cookie: string;
}

export interface Credentials {
	domain: string;
	username: string;
	password: string;
}

/** Read a WebForms hidden input value out of the raw login HTML. */
function hiddenField(html: string, name: string): string {
	const escaped = name.replace(/[.*+?^${}()|[\]\\$]/g, '\\$&');
	const match = html.match(
		new RegExp(`<input[^>]*name="${escaped}"[^>]*value="([^"]*)"`, 'i')
	);
	return match?.[1] ?? '';
}

/** The login page still shows the username field / Submit button; use to detect failure. */
const looksLikeLoginPage = (html: string): boolean =>
	/name="ctl00\$MainContent\$username"/i.test(html) &&
	/id="ctl00_MainContent_Submit1"/i.test(html);

/** Pull the visible error message (e.g. bad password) out of the re-rendered login page. */
function extractLoginError(html: string): string | undefined {
	// The server renders the message into a span#ctl00_MainContent_ERROR (class="ERROR");
	// the USER_ERROR div is populated client-side and is empty in the raw HTML.
	const match =
		html.match(/id="ctl00_MainContent_ERROR"[^>]*>([\s\S]*?)<\/span>/i) ??
		html.match(/<span[^>]*class="ERROR"[^>]*>([\s\S]*?)<\/span>/i);
	const text = match?.[1]?.replace(/<[^>]+>/g, '').trim();
	return text || undefined;
}

export async function login({ domain, username, password }: Credentials): Promise<SynergySession> {
	const base = `https://${domain}`;
	const jar = createJar();

	// 1. Load the login form (following the session-id regeneration redirect).
	const loginPage = await fetchFollow(`${base}/PXP2_Login_Student.aspx`, { method: 'GET' }, jar);
	const formHtml = loginPage.body;

	if (!looksLikeLoginPage(formHtml)) {
		throw new Error(`Unexpected login page at ${domain}; the district portal may have moved.`);
	}

	// 2. Post the credentials with the required hidden fields.
	const form = new URLSearchParams({
		__VIEWSTATE: hiddenField(formHtml, '__VIEWSTATE'),
		__VIEWSTATEGENERATOR: hiddenField(formHtml, '__VIEWSTATEGENERATOR'),
		__EVENTVALIDATION: hiddenField(formHtml, '__EVENTVALIDATION'),
		'ctl00$MainContent$username': username,
		'ctl00$MainContent$password': password,
		'ctl00$MainContent$Submit1': 'Login'
	});

	const actionUrl = new URL('./PXP2_Login_Student.aspx?regenerateSessionId=true', loginPage.finalUrl)
		.toString();

	const result = await fetchFollow(
		actionUrl,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: form.toString()
		},
		jar
	);

	// A successful login lands on a portal page; a failed one re-renders the login form.
	if (looksLikeLoginPage(result.body)) {
		throw new SynergyAuthError(extractLoginError(result.body));
	}

	return { domain, jar, cookie: cookieHeader(jar) };
}
