import { Hono, type Context } from 'hono';
import { checkLogin } from '../../portal/pages/index.js';
import { requireSession, type ApiEnv } from '../auth.js';
import type { ApiDeps } from '../deps.js';
import { RateLimitedError, RequestValidationError } from '../errors.js';
import { clientKey, RateLimiter } from '../rateLimit.js';
import { LoginRequestSchema } from '../schemas.js';

async function readJson(c: Context): Promise<unknown> {
	try {
		return await c.req.json();
	} catch {
		throw new RequestValidationError('Request body must be valid JSON.');
	}
}

export function authRoutes(deps: ApiDeps) {
	const app = new Hono<ApiEnv>();
	const limiter = new RateLimiter({
		limit: deps.config.loginLimit,
		windowMs: deps.config.loginWindowMs
	});

	app.post('/login', async (c) => {
		const retryAfterSeconds = limiter.check(clientKey(c, deps.config.trustProxy));
		if (retryAfterSeconds !== undefined) throw new RateLimitedError(retryAfterSeconds);

		const credentials = LoginRequestSchema.parse(await readJson(c));

		deps.sessions.sweep();
		const token = await deps.sessions.create(credentials);

		try {
			const student = await deps.sessions.withSession(token, (session) =>
				checkLogin(session, deps.fetchOptions)
			);
			return c.json({ token, student });
		} catch (error) {
			deps.sessions.delete(token);
			throw error;
		}
	});

	app.delete('/session', requireSession, (c) => {
		deps.sessions.delete(c.get('token'));
		return c.body(null, 204);
	});

	return app;
}
