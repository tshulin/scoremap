/**
 * lib/session.mjs
 * ---------------------------------------------------------------------------
 * Single task: build an authenticated portal session from environment
 * variables. No page fetching, no file I/O — env in, Session out.
 *
 * Resolution order (to implement):
 *   1. SYNERGY_COOKIE set  -> parse "name=value; name2=value2" into a cookie
 *      jar and skip login entirely (demo / expired-password workflow).
 *   2. SYNERGY_USERNAME + SYNERGY_PASSWORD -> real WebForms login via the
 *      app's server code (src/lib/server/synergy/login.ts).
 *   3. Neither -> print which vars are needed and exit 1.
 *
 * SYNERGY_DOMAIN (e.g. "yourdistrict-psv.edupoint.com") is required in all
 * cases. See .env.example.
 */

// TODO: import { login } from '../../src/lib/server/synergy/login.ts';
// TODO: import { createJar, cookieHeader } from '../../src/lib/server/synergy/http.ts';

/**
 * @returns {Promise<{ domain: string, jar: Map<string,string>, cookie: string }>}
 */
export async function getSessionFromEnv() {
	throw new Error('TODO: implement getSessionFromEnv() — SYNERGY_COOKIE, else SYNERGY_USERNAME/PASSWORD login');
}
