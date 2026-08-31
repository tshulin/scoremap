import { portalBase } from '../base';
import { AuthError, ModuleUnavailableError, ParseError, SessionExpiredError } from '../errors';
import { CookieJar, fetchFollow, type FetchFollowOptions } from '../http';
import type { Credentials } from '../login';

// The modern StudentVUE mobile API (the attested JSON service the current iOS app
// uses - NOT the deprecated SOAP PXPCommunication.asmx that answers D5518-00).
// It returns the one thing the PXP2 web scrape can't on districts that hide the
// category-weights grid: per-category weights (gradeCalculationSummary). We use it
// for the gradebook only, and fall back to the web scrape the moment it misbehaves.
//
// The attestation values (edupointkeyversion, the iOS User-Agent, x-* headers) are
// reverse-engineered constants; AttestKeyId/LoginAssertion are null and the server
// still accepts them today, but Edupoint can tighten this at any time - which is
// exactly why the web path stays as the fallback.
const USER_AGENT = 'StudentVUE/2.0.16 CFNetwork/3860.700.1 Darwin/25.6.0';
const KEY_VERSION = 'bOpVYcir6oyLwz0Ymg8kCDMUNaHbLy5yLJJK/3LgToU=';
const API = '/api/v1/mobile/PXPWebServices';

export interface MobileSession {
	domain: string;
	token: string;
	// Epoch ms when the access token stops being usable; the caller re-mints past it.
	expiresAt: number;
}

const clientData = (path: string): string =>
	`POST:${path}:${Date.now()}:${Math.random().toString(36).slice(2, 13)}`;

function basicAuthorization(username: string, password: string): string {
	const bytes = new TextEncoder().encode(`${username}:${password}`);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `Basic ${btoa(binary)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

// One request against the mobile API. Every call is `{arguments:{request:"<inner
// JSON string>"}}`; auth is Basic for AttemptLogin, Bearer thereafter. The service
// answers HTTP 200 even for its own failures, carrying `{error:{code,message}}`, so
// errors are read from the body, not the status.
async function mobilePost(
	domain: string,
	path: string,
	request: unknown,
	auth: { basic?: Credentials; bearer?: string },
	options: FetchFollowOptions
): Promise<Record<string, unknown>> {
	const headers: Record<string, string> = {
		Accept: '*/*',
		'Content-Type': 'application/json',
		'User-Agent': USER_AGENT,
		edupointkeyversion: KEY_VERSION,
		// A static cookie the app sends; the real credential is the Basic/Bearer header.
		Cookie: 'PVUE=98; AppSupportsSession=1'
	};
	if (auth.bearer) {
		headers.Authorization = `Bearer ${auth.bearer}`;
		headers['x-client-data'] = clientData(path);
		headers['x-platform'] = 'iOS';
		headers['x-device-model'] = 'iPhone18,3';
	} else if (auth.basic) {
		headers.Authorization = basicAuthorization(auth.basic.username, auth.basic.password);
	}

	// A throwaway jar (mobile auth is header-based); an empty jar means fetchFollow
	// adds no Cookie of its own and our explicit one above stands.
	const page = await fetchFollow(
		`${portalBase(domain)}${path}`,
		{
			method: 'POST',
			headers,
			body: JSON.stringify({ arguments: { request: JSON.stringify(request) } })
		},
		new CookieJar(),
		options
	);

	let parsed: unknown;
	try {
		parsed = JSON.parse(page.body);
	} catch {
		throw new ParseError('The mobile API returned an unreadable response.');
	}
	if (!isRecord(parsed)) {
		throw new ParseError('The mobile API returned an unexpected response.');
	}

	const error = parsed['error'];
	if (isRecord(error)) {
		const message = typeof error['message'] === 'string' ? error['message'] : '';
		if (/invalid|incorrect|unauthorized|credential|password|user ?name/i.test(message)) {
			throw new AuthError('The mobile API did not accept those credentials.');
		}
		if (/token|expired|session/i.test(message)) {
			throw new SessionExpiredError('The mobile API session expired.');
		}
		const code = typeof error['code'] === 'string' ? error['code'] : '';
		throw new ModuleUnavailableError(
			`The mobile API rejected the request${code ? ` (${code})` : ''}.`
		);
	}

	const data = parsed['data'];
	return isRecord(data) ? data : parsed;
}

export async function mobileLogin(
	creds: Credentials,
	options: FetchFollowOptions = {}
): Promise<MobileSession> {
	const path = `${API}/AttemptLogin`;
	const json = await mobilePost(
		creds.domain,
		path,
		{
			userID: creds.username,
			password: creds.password,
			userType: 'Student',
			AttestPlatform: 'iOS',
			AttestKeyId: null,
			LoginAssertion: null,
			LoginClientData: clientData(path),
			DeviceModel: 'iPhone18,3'
		},
		{ basic: creds },
		options
	);

	const token = typeof json['access_token'] === 'string' ? json['access_token'] : '';
	if (!token) throw new AuthError('The mobile API returned no access token.');
	const expiresIn = typeof json['expires_in'] === 'number' ? json['expires_in'] : 0;
	// Refresh a minute early; fall back to a conservative 5 min if the field is missing.
	const lifetimeMs = (expiresIn > 0 ? expiresIn : 300) * 1000;
	return { domain: creds.domain, token, expiresAt: Date.now() + lifetimeMs - 60_000 };
}

export const mobileCall = (
	session: MobileSession,
	method: string,
	request: Record<string, unknown>,
	options: FetchFollowOptions = {}
): Promise<Record<string, unknown>> =>
	mobilePost(session.domain, `${API}/${method}`, request, { bearer: session.token }, options);
