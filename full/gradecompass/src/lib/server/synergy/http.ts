/**
 * Minimal cookie-aware fetch helpers for talking to a Synergy (StudentVUE) web
 * portal server-side. The portal is a classic ASP.NET WebForms app that relies
 * on session cookies (`ASP.NET_SessionId` + `EESPSV`), so we keep a small cookie
 * jar and follow redirects manually to accumulate `Set-Cookie` across hops.
 */

export type CookieJar = Map<string, string>;

/** A browser-ish UA. Synergy is content-negotiation sensitive on some pages. */
export const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const createJar = (): CookieJar => new Map();

/** Record every `Set-Cookie` from a response into the jar (name=value only). */
export function absorbCookies(headers: Headers, jar: CookieJar) {
	// Node/undici exposes individual Set-Cookie lines via getSetCookie().
	const setCookies =
		typeof headers.getSetCookie === 'function'
			? headers.getSetCookie()
			: headers.has('set-cookie')
				? [headers.get('set-cookie')!]
				: [];

	for (const raw of setCookies) {
		const firstPair = raw.split(';', 1)[0] ?? '';
		const eq = firstPair.indexOf('=');
		if (eq <= 0) continue;
		const name = firstPair.slice(0, eq).trim();
		const value = firstPair.slice(eq + 1).trim();
		if (name) jar.set(name, value);
	}
}

export const cookieHeader = (jar: CookieJar): string =>
	[...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');

export interface RawFollowResult {
	response: Response;
	finalUrl: string;
	/** Whether the chain redirected at least once (e.g. a module page bouncing to Home). */
	redirected: boolean;
}

export interface FollowResult extends RawFollowResult {
	body: string;
}

/**
 * Fetch a URL, manually following redirects so cookies set on intermediate hops
 * (Synergy sets its session cookies on a 302 -> `?regenerateSessionId=true`) are
 * captured. Returns the final response (body unread) and the URL we ended on.
 */
export async function fetchFollowRaw(
	url: string,
	init: RequestInit,
	jar: CookieJar,
	maxRedirects = 8
): Promise<RawFollowResult> {
	let currentUrl = url;
	let currentInit: RequestInit = init;
	let redirected = false;

	for (let hop = 0; hop <= maxRedirects; hop++) {
		const response = await fetch(currentUrl, {
			...currentInit,
			redirect: 'manual',
			headers: {
				'User-Agent': USER_AGENT,
				Cookie: cookieHeader(jar),
				...currentInit.headers
			}
		});

		absorbCookies(response.headers, jar);

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) return { response, finalUrl: currentUrl, redirected };
			redirected = true;
			currentUrl = new URL(location, currentUrl).toString();
			// A redirect after a POST is followed with GET (303/302 semantics).
			currentInit = { method: 'GET' };
			continue;
		}

		return { response, finalUrl: currentUrl, redirected };
	}

	throw new Error(`Too many redirects starting from ${url}`);
}

/** Like {@link fetchFollowRaw} but also reads the response body as text. */
export async function fetchFollow(
	url: string,
	init: RequestInit,
	jar: CookieJar,
	maxRedirects = 8
): Promise<FollowResult> {
	const raw = await fetchFollowRaw(url, init, jar, maxRedirects);
	return { ...raw, body: await raw.response.text() };
}
