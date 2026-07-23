import { portalBase } from './base';
import { isPortalDomain } from './domainInput';
import { AuthError, InvalidDomainError, PortalShapeError } from './errors';
import { CookieJar, fetchFollow, type FetchFollowOptions } from './http';

// StudentVUE uses an ASP.NET WebForms postback for login.
const LOGIN_PAGE = 'PXP2_Login_Student.aspx?regenerateSessionId=True';

export interface Credentials {
	domain: string;
	username: string;
	password: string;
}

export interface PortalSession {
	domain: string;
	jar: CookieJar;
}

// A portal domain is a hostname plus an optional base path — some districts
// share a server under a path ("studentvue.geneseeisd.org/wpa").
export function validatePortalDomain(domain: string): string {
	if (!isPortalDomain(domain)) {
		throw new InvalidDomainError(
			`Invalid portal domain ${JSON.stringify(domain)}. Enter a hostname such as "yourdistrict-psv.edupoint.com" (a base path like "host.org/district" is allowed) without a scheme, query, or port.`
		);
	}
	return domain;
}

const decodeEntities = (s: string): string =>
	s
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&amp;/g, '&');

export function formInputs(html: string): Map<string, string> {
	const inputs = new Map<string, string>();
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

export async function login(
	{ domain, username, password }: Credentials,
	options: FetchFollowOptions = {}
): Promise<PortalSession> {
	validatePortalDomain(domain);
	const jar = new CookieJar();
	const page = await fetchFollow(
		`${portalBase(domain)}/${LOGIN_PAGE}`,
		{ method: 'GET' },
		jar,
		options
	);

	const fields = formInputs(page.body);
	if (!fields.has('__VIEWSTATE')) {
		throw new PortalShapeError(
			`Login page did not render a WebForms form (HTTP ${page.status} from ${page.finalUrl}) — check the domain.`
		);
	}

	let userField: string | undefined;
	let passField: string | undefined;
	for (const name of fields.keys()) {
		if (!userField && /user/i.test(name)) userField = name;
		if (!passField && /pass|pwd/i.test(name)) passField = name;
	}
	if (!userField || !passField) {
		throw new PortalShapeError('Could not locate the username/password fields on the login form.');
	}
	fields.set(userField, username);
	fields.set(passField, password);

	const result = await fetchFollow(
		page.finalUrl,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams([...fields]).toString()
		},
		jar,
		options
	);

	// Failed logins stay on the login page.
	if (/PXP2_Login/i.test(new URL(result.finalUrl).pathname)) {
		throw new AuthError('Login failed. Check the username and password.');
	}

	return { domain, jar };
}
