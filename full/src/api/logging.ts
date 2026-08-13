import { createMiddleware } from 'hono/factory';

export type LogRecord = Record<string, unknown>;
export type LogSink = (record: LogRecord) => void;

export const consoleSink: LogSink = (record) => {
	console.log(JSON.stringify(record));
};

export const silentSink: LogSink = () => {};

export const requestLogger = (log: LogSink) =>
	createMiddleware(async (c, next) => {
		const startedAt = performance.now();
		await next();
		log({
			event: 'request',
			method: c.req.method,
			route: c.req.routePath,
			status: c.res.status,
			durationMs: Math.round(performance.now() - startedAt)
		});
	});
