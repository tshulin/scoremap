import type { ZodType } from 'zod';
import { ParseError } from '../errors.js';
import { fetchFollow, type FetchFollowOptions, type PageResult } from '../http.js';
import type { PortalSession } from '../login.js';
import { assertSessionAlive } from '../session.js';

export const portalUrl = (session: PortalSession, path: string): string =>
	`https://${session.domain}/${path}`;

export async function getPage(
	session: PortalSession,
	path: string,
	options: FetchFollowOptions = {}
): Promise<PageResult> {
	const page = await fetchFollow(portalUrl(session, path), { method: 'GET' }, session.jar, options);
	assertSessionAlive(page);
	return page;
}

export function validate<T>(schema: ZodType<T>, value: unknown, what: string): T {
	const result = schema.safeParse(value);
	if (!result.success) {
		const detail = result.error.issues
			.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
			.join('; ');
		throw new ParseError(`Could not parse ${what} from the portal: ${detail}`);
	}
	return result.data;
}

export const asString = (value: unknown): string => (typeof value === 'string' ? value : '');
