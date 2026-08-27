import { Hono } from 'hono';
import { SAMPLE_GRADEBOOK } from '../../mock/placeholders.js';
import { NoActiveGradingPeriodError, ParseError } from '../../portal/errors.js';
import type { PortalSession } from '../../portal/login.js';
import {
	downloadDocument,
	fetchAttendance,
	fetchDocuments,
	fetchGradebook,
	fetchStudentInfo
} from '../../portal/pages/index.js';
import { requireSession, type ApiEnv } from '../auth.js';
import type { ApiDeps } from '../deps.js';
import { GradebookQuerySchema } from '../schemas.js';

export const PLACEHOLDER_HEADER = 'X-Grademax-Placeholder';

// The two states the gradebook is stuck in until Part 7b: out of term, and parser missing.
// Anything else is a genuine fault and must still surface.
const isGradebookBlocked = (error: unknown): error is Error =>
	error instanceof NoActiveGradingPeriodError || error instanceof ParseError;

export function contentDisposition(fileName: string): string {
	const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_') || 'document';
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function resourceRoutes(deps: ApiDeps) {
	const app = new Hono<ApiEnv>();

	const withSession = <T>(token: string, fn: (session: PortalSession) => Promise<T>): Promise<T> =>
		deps.sessions.withSession(token, fn);

	app.get('/student', requireSession, async (c) =>
		c.json(await withSession(c.get('token'), (s) => fetchStudentInfo(s, deps.fetchOptions)))
	);

	app.get('/documents', requireSession, async (c) =>
		c.json(await withSession(c.get('token'), (s) => fetchDocuments(s, deps.fetchOptions)))
	);

	app.get('/documents/:docToken', requireSession, async (c) => {
		const docToken = c.req.param('docToken');
		const document = await withSession(c.get('token'), (s) =>
			downloadDocument(s, docToken, deps.fetchOptions)
		);

		return c.body(document.bytes.slice().buffer, 200, {
			'Content-Type': document.mimeType,
			'Content-Disposition': contentDisposition(document.fileName),
			'Content-Length': String(document.bytes.byteLength)
		});
	});

	app.get('/attendance', requireSession, async (c) => {
		return c.json(
			await withSession(c.get('token'), (s) => fetchAttendance(s, deps.fetchOptions))
		);
	});

	app.get('/gradebook', requireSession, async (c) => {
		const { period } = GradebookQuerySchema.parse({ period: c.req.query('period') });
		try {
			return c.json(
				await withSession(c.get('token'), (s) => fetchGradebook(s, period, deps.fetchOptions))
			);
		} catch (error) {
			if (!deps.config.placeholderData || !isGradebookBlocked(error)) throw error;
			c.header(PLACEHOLDER_HEADER, 'true');
			return c.json(SAMPLE_GRADEBOOK);
		}
	});

	return app;
}
