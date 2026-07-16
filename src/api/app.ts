import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { FetchFollowOptions } from '../portal/http.js';
import { SessionStore } from '../portal/session.js';
import type { ApiEnv } from './auth.js';
import { loadConfig, type ApiConfig } from './config.js';
import type { ApiDeps } from './deps.js';
import { errorHandler } from './errors.js';
import { consoleSink, requestLogger, type LogSink } from './logging.js';
import { authRoutes } from './routes/auth.js';
import { resourceRoutes } from './routes/resources.js';

export interface CreateAppOptions {
	config?: Partial<ApiConfig>;
	fetchOptions?: FetchFollowOptions;
	log?: LogSink;
	sessions?: SessionStore;
}

export function createApp(options: CreateAppOptions = {}) {
	const config: ApiConfig = { ...loadConfig(), ...options.config };
	const fetchOptions = options.fetchOptions ?? {};
	const log = options.log ?? consoleSink;
	const sessions =
		options.sessions ?? new SessionStore({ ttlMs: config.sessionTtlMs, fetchOptions });

	const deps: ApiDeps = { config, fetchOptions, log, sessions };

	const app = new Hono<ApiEnv>();

	app.use('*', requestLogger(log));
	app.use(
		'/api/*',
		cors({
			origin: config.allowedOrigin,
			allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
			allowHeaders: ['Authorization', 'Content-Type'],
			exposeHeaders: ['Content-Disposition'],
			credentials: false
		})
	);

	app.onError(errorHandler(log));

	app.get('/api/health', (c) => c.json({ ok: true }));
	app.route('/api/auth', authRoutes(deps));
	app.route('/api', resourceRoutes(deps));

	app.notFound((c) =>
		c.json({ error: { code: 'VALIDATION' as const, message: 'Unknown endpoint.' } }, 404)
	);

	return app;
}
