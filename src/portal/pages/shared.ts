import type { ZodType } from 'zod';
import { portalBase } from '../base';
import { ParseError } from '../errors';
import { fetchFollow, type FetchFollowOptions, type PageResult } from '../http';
import type { PortalSession } from '../login';
import { assertSessionAlive } from '../session';

export const portalUrl = (session: PortalSession, path: string): string =>
	`${portalBase(session.domain)}/${path}`;

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
