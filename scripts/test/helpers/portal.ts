import { CookieJar } from '../../src/portal/http.js';
import type { PortalSession } from '../../src/portal/login.js';

export const testSession = (): PortalSession => ({
	domain: 'district-psv.edupoint.com',
	jar: new CookieJar()
});

export interface RecordedCall {
	url: string;
	init: RequestInit;
}

export function scriptedFetch(script: Array<() => Response>) {
	const calls: RecordedCall[] = [];
	const impl = async (url: string, init: RequestInit): Promise<Response> => {
		calls.push({ url, init });
		const step = script[calls.length - 1];
		if (!step) throw new Error(`unexpected request #${calls.length} to ${url}`);
		return step();
	};
	return { impl, calls };
}

export const htmlPage = (body: string): Response =>
	new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });

export const redirectTo = (location: string): Response =>
	new Response(null, { status: 302, headers: { location } });
