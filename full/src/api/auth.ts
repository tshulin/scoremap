import { createMiddleware } from 'hono/factory';
import { SessionExpiredError } from '../portal/errors.js';

export interface ApiEnv {
	Variables: {
		token: string;
	};
}

const BEARER = /^Bearer\s+(\S+)$/i;

export const requireSession = createMiddleware<ApiEnv>(async (c, next) => {
	const token = BEARER.exec(c.req.header('Authorization') ?? '')?.[1];
	if (!token) {
		throw new SessionExpiredError('Missing or malformed bearer token. Log in again.');
	}
	c.set('token', token);
	await next();
});
