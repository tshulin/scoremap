// Build a session from either a copied cookie or portal credentials.

import { jarFromCookieString, cookieHeader } from './http.mjs';
import { login } from './login.mjs';

export class ConfigError extends Error {}

/** @returns {Promise<{ domain: string, jar: Map<string,string>, cookie: string }>} */
export async function getSessionFromEnv() {
	const domain = process.env.SYNERGY_DOMAIN;
	if (!domain) {
		throw new ConfigError('Set SYNERGY_DOMAIN (e.g. "yourdistrict-psv.edupoint.com"). See env.example.');
	}

	if (process.env.SYNERGY_COOKIE) {
		const jar = jarFromCookieString(process.env.SYNERGY_COOKIE);
		if (jar.size === 0) {
			throw new ConfigError('SYNERGY_COOKIE is set but has no name=value pairs (expected e.g. "ASP.NET_SessionId=x; EESPSV=y").');
		}
		return { domain, jar, cookie: cookieHeader(jar) };
	}

	const username = process.env.SYNERGY_USERNAME;
	const password = process.env.SYNERGY_PASSWORD;
	if (!username || !password) {
		throw new ConfigError('Set SYNERGY_COOKIE, or SYNERGY_USERNAME + SYNERGY_PASSWORD. See env.example.');
	}
	return login({ domain, username, password });
}
