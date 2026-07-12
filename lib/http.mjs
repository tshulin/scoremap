// Redirects are manual because the portal sets cookies during 302 responses.
//

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export function createJar() {
	return new Map();
}

/** Parse a Cookie header copied from a browser. */
export function jarFromCookieString(str) {
	const jar = createJar();
	for (const pair of str.split(';')) {
		const eq = pair.indexOf('=');
		if (eq <= 0) continue;
		jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
	}
	return jar;
}

export function cookieHeader(jar) {
	return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function absorbSetCookies(jar, res) {
	// Bun and newer Node versions expose each Set-Cookie header separately.
	const lines =
		typeof res.headers.getSetCookie === 'function'
			? res.headers.getSetCookie()
			: [res.headers.get('set-cookie')].filter(Boolean);
	for (const line of lines) {
		const nameValue = line.split(';', 1)[0];
		const eq = nameValue.indexOf('=');
		if (eq <= 0) continue;
		jar.set(nameValue.slice(0, eq).trim(), nameValue.slice(eq + 1).trim());
	}
}

/** Fetch a page and retain cookies set during redirects. */
export async function fetchFollow(url, init = {}, jar, maxHops = 10) {
	let current = url;
	let redirected = false;
	let hopInit = init;
	for (let hop = 0; hop <= maxHops; hop++) {
		const res = await fetch(current, {
			...hopInit,
			headers: {
				'User-Agent': USER_AGENT,
				...(jar.size > 0 ? { Cookie: cookieHeader(jar) } : {}),
				...(hopInit.headers ?? {})
			},
			redirect: 'manual'
		});
		absorbSetCookies(jar, res);
		const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
		if (location === null) {
			return { body: await res.text(), finalUrl: current, redirected, status: res.status };
		}
		await res.text().catch(() => {});
		redirected = true;
		current = new URL(location, current).toString();
		hopInit = { method: 'GET' };
	}
	throw new Error(`Too many redirects (>${maxHops}) fetching ${url}`);
}
