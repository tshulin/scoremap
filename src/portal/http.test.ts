import { describe, expect, it } from 'vitest';
import { PortalHttpError } from './errors.js';
import { CookieJar, fetchFollow, fetchFollowRaw } from './http.js';

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

const headersOf = (call: RecordedCall) => call.init.headers as Record<string, string>;

const redirect = (location: string, setCookies: string[] = []) =>
	new Response(null, {
		status: 302,
		headers: [
			['location', location],
			...setCookies.map((line): [string, string] => ['set-cookie', line])
		]
	});

const page = (body: string, setCookies: string[] = [], status = 200) =>
	new Response(body, {
		status,
		headers: setCookies.map((line): [string, string] => ['set-cookie', line])
	});

describe('CookieJar', () => {
	it('round-trips a browser-copied cookie string', () => {
		const jar = CookieJar.fromCookieString('ASP.NET_SessionId=abc; EESPSV=x=y');
		expect(jar.size).toBe(2);
		expect(jar.get('ASP.NET_SessionId')).toBe('abc');
		expect(jar.get('EESPSV')).toBe('x=y');
		expect(jar.header()).toBe('ASP.NET_SessionId=abc; EESPSV=x=y');
	});

	it('ignores malformed cookie pairs', () => {
		const jar = CookieJar.fromCookieString('; =nameless; good=1');
		expect(jar.size).toBe(1);
		expect(jar.get('good')).toBe('1');
	});

	it('absorbs cookies and strips their attributes', () => {
		const jar = new CookieJar();
		jar.absorb(page('', ['A=1; Path=/; HttpOnly', 'B=2; Secure']));
		expect(jar.get('A')).toBe('1');
		expect(jar.get('B')).toBe('2');
	});

	it('falls back to the single set-cookie header when getSetCookie is unavailable', () => {
		const jar = new CookieJar();
		const legacyResponse = {
			headers: {
				get: (name: string) => (name.toLowerCase() === 'set-cookie' ? 'A=1; Path=/' : null)
			}
		} as unknown as Response;
		jar.absorb(legacyResponse);
		expect(jar.get('A')).toBe('1');
	});
});

describe('fetchFollow', () => {
	it('accumulates cookies across 302 hops and sends them on later requests', async () => {
		const { impl, calls } = scriptedFetch([
			() => redirect('/step2', ['ASP.NET_SessionId=abc; Path=/']),
			() => redirect('https://portal.example/home', ['EESPSV=xyz; HttpOnly']),
			() => page('<html>home</html>')
		]);
		const jar = new CookieJar();

		const result = await fetchFollow('https://portal.example/start', { method: 'GET' }, jar, {
			fetchImpl: impl
		});

		expect(result).toMatchObject({
			body: '<html>home</html>',
			finalUrl: 'https://portal.example/home',
			redirected: true,
			status: 200
		});
		expect(calls[1]?.url).toBe('https://portal.example/step2');
		expect(headersOf(calls[2]!)['Cookie']).toBe('ASP.NET_SessionId=abc; EESPSV=xyz');
		expect(jar.get('ASP.NET_SessionId')).toBe('abc');
		expect(jar.get('EESPSV')).toBe('xyz');
	});

	it('reports redirected=false and keeps the original URL on a direct response', async () => {
		const { impl } = scriptedFetch([() => page('direct')]);

		const result = await fetchFollow('https://portal.example/p', {}, new CookieJar(), {
			fetchImpl: impl
		});

		expect(result).toMatchObject({
			body: 'direct',
			finalUrl: 'https://portal.example/p',
			redirected: false
		});
	});

	it('downgrades to a bare GET after a redirected POST', async () => {
		const { impl, calls } = scriptedFetch([() => redirect('/landing'), () => page('landed')]);

		await fetchFollow(
			'https://portal.example/login',
			{
				method: 'POST',
				body: 'user=x',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
			},
			new CookieJar(),
			{ fetchImpl: impl }
		);

		expect(calls[1]?.init.method).toBe('GET');
		expect(calls[1]?.init.body).toBeUndefined();
		expect(headersOf(calls[1]!)['Content-Type']).toBeUndefined();
	});

	it('sends a browser-like User-Agent and omits Cookie when the jar is empty', async () => {
		const { impl, calls } = scriptedFetch([() => page('ok')]);

		await fetchFollow('https://portal.example/p', {}, new CookieJar(), { fetchImpl: impl });

		expect(headersOf(calls[0]!)['User-Agent']).toMatch(/^Mozilla\//);
		expect(headersOf(calls[0]!)['Cookie']).toBeUndefined();
	});

	it('uses manual redirect mode on every hop', async () => {
		const { impl, calls } = scriptedFetch([() => redirect('/x'), () => page('ok')]);

		await fetchFollow('https://portal.example/p', {}, new CookieJar(), { fetchImpl: impl });

		expect(calls.every((call) => call.init.redirect === 'manual')).toBe(true);
	});

	it('throws PortalHttpError on a redirect loop', async () => {
		const impl = async () => redirect('/loop');

		const attempt = fetchFollow('https://portal.example/p', {}, new CookieJar(), {
			fetchImpl: impl,
			maxHops: 3
		});

		await expect(attempt).rejects.toThrow(PortalHttpError);
		await expect(attempt).rejects.toThrow(/Too many redirects/);
	});

	it('surfaces timeouts as PortalHttpError', async () => {
		const impl = (_url: string, init: RequestInit) =>
			new Promise<Response>((_resolve, reject) => {
				init.signal?.addEventListener('abort', () => reject(init.signal?.reason));
			});

		const attempt = fetchFollow('https://portal.example/slow', {}, new CookieJar(), {
			fetchImpl: impl,
			timeoutMs: 20
		});

		await expect(attempt).rejects.toThrow(PortalHttpError);
		await expect(attempt).rejects.toThrow(/timed out after 20 ms/);
	});

	it('wraps network failures with the failing URL', async () => {
		const impl = async () => {
			throw new TypeError('fetch failed');
		};

		const attempt = fetchFollow('https://portal.example/down', {}, new CookieJar(), {
			fetchImpl: impl
		});

		await expect(attempt).rejects.toThrow(PortalHttpError);
		await expect(attempt).rejects.toThrow('Request to https://portal.example/down failed');
	});
});

describe('fetchFollowRaw', () => {
	it('returns the final response unread, with cookies absorbed', async () => {
		const { impl } = scriptedFetch([() => redirect('/file', ['S=1']), () => page('%PDF-1.7 …')]);
		const jar = new CookieJar();

		const { response, finalUrl, redirected } = await fetchFollowRaw(
			'https://portal.example/doc',
			{},
			jar,
			{ fetchImpl: impl }
		);

		expect(redirected).toBe(true);
		expect(finalUrl).toBe('https://portal.example/file');
		expect(jar.get('S')).toBe('1');
		expect(await response.text()).toBe('%PDF-1.7 …');
	});
});
