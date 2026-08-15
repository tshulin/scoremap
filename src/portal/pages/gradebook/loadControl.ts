import { ModuleUnavailableError, ParseError, SessionExpiredError } from '../../errors';
import { fetchFollow, type FetchFollowOptions } from '../../http';
import type { PortalSession } from '../../login';
import { assertSessionAlive } from '../../session';
import { portalUrl } from '../shared';

// The gradebook is not one scrapable page: PXP2_Gradebook.aspx renders only the
// class list, and every detail view is fetched by the portal's own JS through
// this ASMX method (see PXPCallWebMethod in the portal's PXPUtility.js). It
// answers {d: {Error, Data: {html}}} where html is a server-rendered fragment
// with the DevExpress grids embedded inline.
const METHOD_PATH = 'service/PXP2Communication.asmx/LoadControl';

// The portal's own JS treats this error as a dead session and forces a logout;
// for us it means "re-login and retry", exactly like a login-page bounce.
const INVALID_CONTEXT = 'INVALID_CONTEXT';

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export async function loadControl(
	session: PortalSession,
	control: string,
	parameters: Record<string, unknown>,
	options: FetchFollowOptions = {}
): Promise<string> {
	const page = await fetchFollow(
		portalUrl(session, METHOD_PATH),
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				AGU: String(parameters['AGU'] ?? '0'),
				'X-Requested-With': 'XMLHttpRequest'
			},
			body: JSON.stringify({ request: { control, parameters } })
		},
		session.jar,
		options
	);
	assertSessionAlive(page);

	let parsed: unknown;
	try {
		parsed = JSON.parse(page.body);
	} catch {
		throw new ParseError(`The portal returned an unreadable ${control} response.`);
	}
	const envelope = isRecord(parsed) && isRecord(parsed['d']) ? parsed['d'] : undefined;
	if (!envelope) {
		throw new ParseError(`The portal returned an unexpected ${control} response.`);
	}

	const error = envelope['Error'];
	if (isRecord(error)) {
		const message = typeof error['Message'] === 'string' ? error['Message'] : '';
		if (message === INVALID_CONTEXT) {
			throw new SessionExpiredError(`The portal rejected the session (${INVALID_CONTEXT}).`);
		}
		throw new ModuleUnavailableError(
			`The gradebook is unavailable: ${message || 'unknown portal error'}`
		);
	}

	const data = envelope['Data'];
	const html = isRecord(data) ? data['html'] : undefined;
	if (typeof html !== 'string') {
		throw new ParseError(`The portal's ${control} response had no content.`);
	}
	return html;
}
