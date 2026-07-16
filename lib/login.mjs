// PXP2 login posts the hidden ASP.NET WebForms fields back with the credentials.

import { createJar, cookieHeader, fetchFollow } from './http.mjs';

export class PortalAuthError extends Error {}

const LOGIN_PAGE = 'PXP2_Login_Student.aspx?regenerateSessionId=True';

const decodeEntities = (s) =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

function formInputs(html) {
	const inputs = new Map();
	for (const [tag] of html.matchAll(/<input\b[^>]*>/gi)) {
		const name = /\bname="([^"]*)"/i.exec(tag)?.[1];
		if (!name) continue;
		const type = /\btype="([^"]*)"/i.exec(tag)?.[1]?.toLowerCase() ?? 'text';
		if ((type === 'checkbox' || type === 'radio') && !/\bchecked\b/i.test(tag)) continue;
		const value = /\bvalue="([^"]*)"/i.exec(tag)?.[1] ?? '';
		inputs.set(decodeEntities(name), decodeEntities(value));
	}
	return inputs;
}

/**
 * @param {{ domain: string, username: string, password: string }} creds
 * @returns {Promise<{ domain: string, jar: Map<string,string>, cookie: string }>}
 * @throws {PortalAuthError} on bad credentials or an unrecognizable login page
 */
export async function login({ domain, username, password }) {
	const jar = createJar();
	const page = await fetchFollow(`https://${domain}/${LOGIN_PAGE}`, { method: 'GET' }, jar);

	const fields = formInputs(page.body);
	if (!fields.has('__VIEWSTATE')) {
		throw new PortalAuthError(
			`Login page did not render a WebForms form (HTTP ${page.status} from ${page.finalUrl}) — check SYNERGY_DOMAIN.`
		);
	}

	let userField, passField;
	for (const name of fields.keys()) {
		if (!userField && /user/i.test(name)) userField = name;
		if (!passField && /pass|pwd/i.test(name)) passField = name;
	}
	if (!userField || !passField) {
		throw new PortalAuthError('Could not locate the username/password fields on the login form.');
	}
	fields.set(userField, username);
	fields.set(passField, password);

	const res = await fetchFollow(
		page.finalUrl,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams([...fields]).toString()
		},
		jar
	);

	if (/type="password"/i.test(res.body)) {
		throw new PortalAuthError('Login failed — the portal re-rendered the login form (check username/password).');
	}
	return { domain, jar, cookie: cookieHeader(jar) };
}
