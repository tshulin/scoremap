import { describe, expect, it } from 'vitest';
import { AuthError, InvalidDomainError, PortalShapeError } from './errors.js';
import { formInputs, login, validatePortalDomain } from './login.js';

const LOGIN_FORM_HTML = `
<html><body>
<form method="post" action="./PXP2_Login_Student.aspx">
	<input type="hidden" name="__VIEWSTATE" value="dDwtMTIz&quot;state&quot;" />
	<input type="hidden" name="__VIEWSTATEGENERATOR" value="CA0B0334" />
	<input type="hidden" name="__EVENTVALIDATION" value="/wEWBAK" />
	<input type="text" name="ctl00$MainContent$username" value="" />
	<input type="password" name="ctl00$MainContent$password" value="" />
	<input type="checkbox" name="ctl00$MainContent$remember" value="on" />
	<input type="submit" name="ctl00$MainContent$Submit1" value="Login" />
</form>
</body></html>`;

interface RecordedCall {
	url: string;
	init: RequestInit;
}

function scriptedFetch(script: Array<() => Response>) {
	const calls: RecordedCall[] = [];
	const impl = async (url: string, init: RequestInit): Promise<Response> => {
		calls.push({ url, init });
		const step = script[calls.length - 1];
		if (!step) throw new Error(`unexpected request #${calls.length} to ${url}`);
		return step();
	};
	return { impl, calls };
}

const redirect = (location: string, setCookies: string[] = []) =>
	new Response(null, {
		status: 302,
		headers: [
			['location', location],
			...setCookies.map((line): [string, string] => ['set-cookie', line])
		]
	});

const page = (body: string) => new Response(body, { status: 200 });

const CREDS = {
	domain: 'district-psv.edupoint.com',
	username: 'student@school.net',
	password: 'hunter2'
};

describe('validatePortalDomain', () => {
	it('accepts bare hostnames', () => {
		expect(validatePortalDomain('ca-pleas-psv.edupoint.com')).toBe('ca-pleas-psv.edupoint.com');
	});

	it.each(['https://evil.example', 'host/path', 'host:8443', 'host name', '', 'no-dots'])(
		'rejects %j',
		(domain) => {
			expect(() => validatePortalDomain(domain)).toThrow(InvalidDomainError);
		}
	);
});

describe('formInputs', () => {
	it('collects named inputs and decodes entities', () => {
		const inputs = formInputs(LOGIN_FORM_HTML);
		expect(inputs.get('__VIEWSTATE')).toBe('dDwtMTIz"state"');
		expect(inputs.get('__VIEWSTATEGENERATOR')).toBe('CA0B0334');
		expect(inputs.get('ctl00$MainContent$username')).toBe('');
	});

	it('skips unchecked checkboxes and radios, keeps checked ones', () => {
		const inputs = formInputs(
			'<input type="checkbox" name="off" value="1"><input type="radio" name="on" value="2" checked>'
		);
		expect(inputs.has('off')).toBe(false);
		expect(inputs.get('on')).toBe('2');
	});
});

describe('login', () => {
	it('echoes hidden fields and credentials in the POST, and keeps seeded cookies', async () => {
		const { impl, calls } = scriptedFetch([
			() => redirect('/PXP2_Login_Student.aspx', ['ASP.NET_SessionId=seed1; HttpOnly']),
			() => page(LOGIN_FORM_HTML),
			() => redirect('/Home_PXP2.aspx', ['EESPSV=tok2']),
			() => page('<html>welcome</html>')
		]);

		const session = await login(CREDS, { fetchImpl: impl });

		expect(calls[2]?.url).toBe('https://district-psv.edupoint.com/PXP2_Login_Student.aspx');
		expect(calls[2]?.init.method).toBe('POST');
		const body = new URLSearchParams(calls[2]?.init.body as string);
		expect(body.get('__VIEWSTATE')).toBe('dDwtMTIz"state"');
		expect(body.get('ctl00$MainContent$username')).toBe(CREDS.username);
		expect(body.get('ctl00$MainContent$password')).toBe(CREDS.password);
		expect(body.has('ctl00$MainContent$remember')).toBe(false);

		expect(session.domain).toBe(CREDS.domain);
		expect(session.jar.get('ASP.NET_SessionId')).toBe('seed1');
		expect(session.jar.get('EESPSV')).toBe('tok2');
	});

	it('throws AuthError when the portal re-renders the login form', async () => {
		const { impl } = scriptedFetch([() => page(LOGIN_FORM_HTML), () => page(LOGIN_FORM_HTML)]);

		await expect(login(CREDS, { fetchImpl: impl })).rejects.toThrow(AuthError);
	});

	it('throws PortalShapeError when the page has no WebForms state', async () => {
		const { impl } = scriptedFetch([() => page('<html>not a portal</html>')]);

		await expect(login(CREDS, { fetchImpl: impl })).rejects.toThrow(PortalShapeError);
	});

	it('throws PortalShapeError when user/password fields cannot be found', async () => {
		const { impl } = scriptedFetch([
			() => page('<form><input type="hidden" name="__VIEWSTATE" value="x"></form>')
		]);

		await expect(login(CREDS, { fetchImpl: impl })).rejects.toThrow(/username\/password fields/);
	});

	it('rejects a non-hostname domain before any request is made', async () => {
		const { impl, calls } = scriptedFetch([]);

		await expect(
			login({ ...CREDS, domain: 'https://district-psv.edupoint.com' }, { fetchImpl: impl })
		).rejects.toThrow(InvalidDomainError);
		expect(calls.length).toBe(0);
	});
});
