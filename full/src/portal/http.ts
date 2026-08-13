import { PortalHttpError } from './errors.js';

// StudentVUE sets session cookies on redirects and varies its HTML by user agent.
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const DEFAULT_MAX_HOPS = 10;
const DEFAULT_TIMEOUT_MS = 15_000;

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export class CookieJar {
	private readonly cookies = new Map<string, string>();

	static fromCookieString(str: string): CookieJar {
		const jar = new CookieJar();
		for (const pair of str.split(';')) {
			const eq = pair.indexOf('=');
			if (eq === -1) continue;
			const name = pair.slice(0, eq).trim();
			if (!name) continue;
			jar.set(name, pair.slice(eq + 1).trim());
		}
		return jar;
	}

	get size(): number {
		return this.cookies.size;
	}

	get(name: string): string | undefined {
		return this.cookies.get(name);
	}

	set(name: string, value: string): void {
		this.cookies.set(name, value);
	}

	header(): string {
		return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
	}

	absorb(response: Response): void {
		const lines =
			typeof response.headers.getSetCookie === 'function'
				? response.headers.getSetCookie()
				: [response.headers.get('set-cookie')].filter((line): line is string => line !== null);
		for (const line of lines) {
			const nameValue = line.split(';', 1)[0] ?? '';
			const eq = nameValue.indexOf('=');
			if (eq === -1) continue;
			const name = nameValue.slice(0, eq).trim();
			if (!name) continue;
			this.cookies.set(name, nameValue.slice(eq + 1).trim());
		}
	}
}

export interface PortalRequestInit {
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface FetchFollowOptions {
	fetchImpl?: FetchLike;
	maxHops?: number;
	timeoutMs?: number;
}

export interface RawResult {
	response: Response;
	finalUrl: string;
	redirected: boolean;
}

export interface PageResult {
	body: string;
	finalUrl: string;
	redirected: boolean;
	status: number;
}

// Leaves the final response unread so callers can handle text or binary data.
export async function fetchFollowRaw(
	url: string,
	init: PortalRequestInit,
	jar: CookieJar,
	options: FetchFollowOptions = {}
): Promise<RawResult> {
	const { fetchImpl = fetch, maxHops = DEFAULT_MAX_HOPS, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

	let current = url;
	let redirected = false;
	let hopInit = init;

	for (let hop = 0; hop <= maxHops; hop++) {
		let response: Response;
		try {
			response = await fetchImpl(current, {
				...hopInit,
				headers: {
					'User-Agent': USER_AGENT,
					...(jar.size > 0 ? { Cookie: jar.header() } : {}),
					...(hopInit.headers ?? {})
				},
				redirect: 'manual',
				signal: AbortSignal.timeout(timeoutMs)
			});
		} catch (cause) {
			const timedOut = cause instanceof DOMException && cause.name === 'TimeoutError';
			throw new PortalHttpError(
				timedOut
					? `Request to ${current} timed out after ${timeoutMs} ms`
					: `Request to ${current} failed`,
				{ url: current, cause }
			);
		}

		jar.absorb(response);

		const location =
			response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
		if (location === null) {
			return { response, finalUrl: current, redirected };
		}

		await response.text().catch(() => {});
		redirected = true;
		current = new URL(location, current).toString();
		hopInit = { method: 'GET' };
	}

	throw new PortalHttpError(`Too many redirects (>${maxHops}) fetching ${url}`, { url });
}

export async function fetchFollow(
	url: string,
	init: PortalRequestInit,
	jar: CookieJar,
	options: FetchFollowOptions = {}
): Promise<PageResult> {
	const { response, finalUrl, redirected } = await fetchFollowRaw(url, init, jar, options);

	if (response.status >= 500) {
		await response.text().catch(() => {});
		throw new PortalHttpError(`The portal returned HTTP ${response.status} for ${finalUrl}`, {
			url: finalUrl,
			status: response.status
		});
	}

	let body: string;
	try {
		body = await response.text();
	} catch (cause) {
		throw new PortalHttpError(`Failed to read the response body from ${finalUrl}`, {
			url: finalUrl,
			status: response.status,
			cause
		});
	}
	return { body, finalUrl, redirected, status: response.status };
}
