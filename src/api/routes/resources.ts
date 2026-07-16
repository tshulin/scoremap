import { Hono } from 'hono';
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

	app.get('/attendance', requireSession, async (c) =>
		c.json(await withSession(c.get('token'), (s) => fetchAttendance(s, deps.fetchOptions)))
	);

	app.get('/gradebook', requireSession, async (c) => {
		const { period } = GradebookQuerySchema.parse({ period: c.req.query('period') });
		return c.json(
			await withSession(c.get('token'), (s) => fetchGradebook(s, period, deps.fetchOptions))
		);
	});

	return app;
}
