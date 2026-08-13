import { SessionExpiredError } from './errors';
import type { PageResult } from './http';

// The portal bounces expired sessions to the login page; every page fetch checks
// this so a dead session surfaces as SessionExpiredError, not a parse failure.
// (The server-side SessionStore is gone in the browser build - the browser holds
// the cookie jar itself and re-logs-in on this error.)
export function assertSessionAlive(page: Pick<PageResult, 'finalUrl'>): void {
	if (/PXP2_Login/i.test(new URL(page.finalUrl).pathname)) {
		throw new SessionExpiredError(`The portal redirected to the login page (${page.finalUrl}).`);
	}
}
