import { beforeEach, describe, expect, it } from 'vitest';
import { apiHarness, authed, loginRequest } from '../../test/helpers/api.js';
import { MOCK_CREDENTIALS } from '../mock/portal.js';
import type { ApiError } from '../domain/index.js';

const login = async (app: ReturnType<typeof apiHarness>['app'], body: unknown = MOCK_CREDENTIALS) =>
	app.request(loginRequest(body));

const tokenFrom = async (app: ReturnType<typeof apiHarness>['app']): Promise<string> => {
	const res = await login(app);
	const body = (await res.json()) as { token: string };
	return body.token;
};

const errorBody = async (res: Response): Promise<ApiError['error']> =>
	((await res.json()) as ApiError).error;

describe('GET /api/health', () => {
	it('answers without a token', async () => {
		const { app } = apiHarness();
		const res = await app.request('/api/health');

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});

describe('POST /api/auth/login', () => {
	it('returns a token and the student it belongs to', async () => {
		const { app } = apiHarness();
		const res = await login(app);

		expect(res.status).toBe(200);
		const body = (await res.json()) as { token: string; student: { name: string } };
		expect(body.token).toMatch(/[0-9a-f-]{36}/);
		expect(body.student.name).toBeTruthy();
	});

	it('rejects bad credentials with AUTH_FAILED', async () => {
		const { app } = apiHarness();
		const res = await login(app, { ...MOCK_CREDENTIALS, password: 'wrong' });

		expect(res.status).toBe(401);
		expect((await errorBody(res)).code).toBe('AUTH_FAILED');
	});

	it('never echoes the submitted password back', async () => {
		const { app } = apiHarness();
		const res = await login(app, { ...MOCK_CREDENTIALS, password: 'hunter2-secret' });

		expect(await res.text()).not.toContain('hunter2-secret');
	});

	it('rejects a malformed body with VALIDATION', async () => {
		const { app } = apiHarness();
		const res = await login(app, { domain: MOCK_CREDENTIALS.domain });

		expect(res.status).toBe(400);
		const error = await errorBody(res);
		expect(error.code).toBe('VALIDATION');
		expect(error.message).toContain('username');
	});

	it('rejects a non-JSON body', async () => {
		const { app } = apiHarness();
		const res = await app.request('http://api.test/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json'
		});

		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe('VALIDATION');
	});

	it('rejects a domain that is not a bare hostname', async () => {
		const { app } = apiHarness();
		const res = await login(app, { ...MOCK_CREDENTIALS, domain: 'http://evil.test/path' });

		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe('VALIDATION');
	});

	it('returns a token that can access protected routes', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/student', { headers: authed(token) });

		expect(res.status).toBe(200);
	});
});

describe('DELETE /api/auth/session', () => {
	it('drops the session', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);

		const res = await app.request('/api/auth/session', {
			method: 'DELETE',
			headers: authed(token)
		});
		expect(res.status).toBe(204);

		const after = await app.request('/api/student', { headers: authed(token) });
		expect(after.status).toBe(401);
		expect((await errorBody(after)).code).toBe('SESSION_EXPIRED');
	});
});

describe('authentication', () => {
	const protectedRoutes = [
		['GET', '/api/student'],
		['GET', '/api/documents'],
		['GET', '/api/documents/abc'],
		['GET', '/api/attendance'],
		['GET', '/api/gradebook'],
		['DELETE', '/api/auth/session']
	] as const;

	it.each(protectedRoutes)('%s %s requires a token', async (method, path) => {
		const { app } = apiHarness();
		const res = await app.request(path, { method });

		expect(res.status).toBe(401);
		expect((await errorBody(res)).code).toBe('SESSION_EXPIRED');
	});

	it('rejects an unknown token', async () => {
		const { app } = apiHarness();
		const res = await app.request('/api/student', { headers: authed('not-a-real-token') });

		expect(res.status).toBe(401);
		expect((await errorBody(res)).code).toBe('SESSION_EXPIRED');
	});

	it('rejects a malformed Authorization header', async () => {
		const { app } = apiHarness();
		const res = await app.request('/api/student', { headers: { Authorization: 'Basic abc123' } });

		expect(res.status).toBe(401);
	});
});

describe('resource endpoints', () => {
	it('serves student info', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/student', { headers: authed(token) });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({
			name: expect.any(String),
			permId: expect.any(String)
		});
	});

	it('serves the document list', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/documents', { headers: authed(token) });

		expect(res.status).toBe(200);
		const documents = (await res.json()) as Array<{ docToken: string; uploadDate: string }>;
		expect(documents.length).toBeGreaterThan(0);
		expect(documents[0]?.docToken).toBeTruthy();
	});

	it('serves attendance', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/attendance', { headers: authed(token) });

		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ absences: expect.any(Array) });
	});
});

describe('GET /api/documents/:docToken', () => {
	const firstDocToken = async (app: ReturnType<typeof apiHarness>['app'], token: string) => {
		const res = await app.request('/api/documents', { headers: authed(token) });
		const documents = (await res.json()) as Array<{ docToken: string }>;
		return documents[0]!.docToken;
	};

	it('streams the file with its own content type and name', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const docToken = await firstDocToken(app, token);

		const res = await app.request(`/api/documents/${encodeURIComponent(docToken)}`, {
			headers: authed(token)
		});

		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('application/pdf');
		expect(res.headers.get('content-disposition')).toContain('Report Card.pdf');
		expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(0);
	});

	it('round-trips a docToken containing +, / and = through the path', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const docToken = await firstDocToken(app, token);

		expect(docToken).toMatch(/[+/=]/);
		const res = await app.request(`/api/documents/${encodeURIComponent(docToken)}`, {
			headers: authed(token)
		});

		expect(res.status).toBe(200);
	});

	it('maps an HTML response from the portal to MODULE_UNAVAILABLE', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);

		const res = await app.request('/api/documents/%20', { headers: authed(token) });

		expect(res.status).toBe(502);
		expect((await errorBody(res)).code).toBe('MODULE_UNAVAILABLE');
	});
});

describe('GET /api/gradebook', () => {
	it('reports NO_ACTIVE_GRADING_PERIOD when the portal bounces to Home', async () => {
		const { app } = apiHarness({ gradebookAvailable: false });
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.status).toBe(409);
		expect((await errorBody(res)).code).toBe('NO_ACTIVE_GRADING_PERIOD');
	});

	it('rejects a non-numeric period with VALIDATION', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook?period=first', { headers: authed(token) });

		expect(res.status).toBe(400);
		expect((await errorBody(res)).code).toBe('VALIDATION');
	});

	it('reports PARSE_FAILED while the parser is unimplemented', async () => {
		const { app } = apiHarness({ gradebookAvailable: true });
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.status).toBe(502);
		expect((await errorBody(res)).code).toBe('PARSE_FAILED');
	});
});

describe('GET /api/gradebook — placeholder data', () => {
	const placeholderApp = (options: Parameters<typeof apiHarness>[0] = {}) =>
		apiHarness({ ...options, app: { config: { placeholderData: true } } });

	it('serves the sample when the portal has no active grading period', async () => {
		const { app } = placeholderApp({ gradebookAvailable: false });
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.status).toBe(200);
		const gradebook = (await res.json()) as { courses: Array<{ name: string }> };
		expect(gradebook.courses.length).toBeGreaterThan(0);
	});

	it('serves the sample when the parser is not implemented yet', async () => {
		const { app } = placeholderApp({ gradebookAvailable: true });
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.status).toBe(200);
	});

	it('marks the response so the client can say it is not real', async () => {
		const { app } = placeholderApp();
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.headers.get('x-grademax-placeholder')).toBe('true');
	});

	it('does not mark responses that came from the portal', async () => {
		const { app } = placeholderApp();
		const token = await tokenFrom(app);
		const res = await app.request('/api/student', { headers: authed(token) });

		expect(res.headers.get('x-grademax-placeholder')).toBeNull();
	});

	it('records that a placeholder was served', async () => {
		const { app, logs } = placeholderApp();
		const token = await tokenFrom(app);
		await app.request('/api/gradebook', { headers: authed(token) });

		expect(logs).toContainEqual(
			expect.objectContaining({ event: 'placeholder_served', resource: 'gradebook' })
		);
	});

	it('still surfaces a real fault rather than papering over it with sample data', async () => {
		// A portal outage must not look like a working gradebook.
		const { app } = apiHarness({
			app: { config: { placeholderData: true } },
			fetchImpl: () => Promise.resolve(new Response('down', { status: 500 }))
		});
		const res = await login(app);

		expect(res.status).toBe(502);
	});

	it('is off unless asked for', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);
		const res = await app.request('/api/gradebook', { headers: authed(token) });

		expect(res.status).toBe(409);
	});
});

describe('session use', () => {
	it('uses a valid token for later requests', async () => {
		const { app } = apiHarness();
		const token = await tokenFrom(app);

		const res = await app.request('/api/student', { headers: authed(token) });
		expect(res.status).toBe(200);
	});
});

describe('portal failures', () => {
	it('maps a portal outage to PORTAL_UNAVAILABLE without leaking details', async () => {
		const { app } = apiHarness({
			fetchImpl: () => Promise.reject(new Error('ECONNREFUSED 10.0.0.1:443'))
		});
		const res = await login(app);

		expect(res.status).toBe(502);
		const error = await errorBody(res);
		expect(error.code).toBe('PORTAL_UNAVAILABLE');
		expect(error.message).not.toContain('10.0.0.1');
	});

	it('maps a portal 500 to PORTAL_UNAVAILABLE', async () => {
		const { app } = apiHarness({
			fetchImpl: () => Promise.resolve(new Response('boom', { status: 500 }))
		});
		const res = await login(app);

		expect(res.status).toBe(502);
		expect((await errorBody(res)).code).toBe('PORTAL_UNAVAILABLE');
	});

	it('never forwards portal HTML to the client', async () => {
		const { app } = apiHarness({
			fetchImpl: () =>
				Promise.resolve(
					new Response('<html><body>Portal internal error: user jsmith</body></html>', {
						status: 500,
						headers: { 'content-type': 'text/html' }
					})
				)
		});
		const res = await login(app);

		expect(await res.text()).not.toContain('jsmith');
	});
});

describe('CORS', () => {
	it('allows the configured origin', async () => {
		const { app } = apiHarness({ app: { config: { allowedOrigin: 'http://localhost:5173' } } });
		const res = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });

		expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
	});

	it('does not allow an unconfigured origin', async () => {
		const { app } = apiHarness({ app: { config: { allowedOrigin: 'http://localhost:5173' } } });
		const res = await app.request('/api/health', { headers: { Origin: 'http://evil.test' } });

		expect(res.headers.get('access-control-allow-origin')).not.toBe('http://evil.test');
	});

	it('answers preflight for an authenticated route', async () => {
		const { app } = apiHarness({ app: { config: { allowedOrigin: 'http://localhost:5173' } } });
		const res = await app.request('/api/student', {
			method: 'OPTIONS',
			headers: {
				Origin: 'http://localhost:5173',
				'Access-Control-Request-Method': 'GET',
				'Access-Control-Request-Headers': 'Authorization'
			}
		});

		expect(res.status).toBe(204);
		expect(res.headers.get('access-control-allow-headers')).toContain('Authorization');
	});

	it('exposes Content-Disposition so the browser can name the download', async () => {
		const { app } = apiHarness({ app: { config: { allowedOrigin: 'http://localhost:5173' } } });
		const res = await app.request('/api/health', { headers: { Origin: 'http://localhost:5173' } });

		expect(res.headers.get('access-control-expose-headers')).toContain('Content-Disposition');
	});
});

describe('login rate limiting', () => {
	it('blocks once the window is full and says how long to wait', async () => {
		const { app } = apiHarness({ app: { config: { loginLimit: 3, loginWindowMs: 60_000 } } });

		for (let attempt = 0; attempt < 3; attempt++) {
			const res = await login(app, { ...MOCK_CREDENTIALS, password: 'wrong' });
			expect(res.status).toBe(401);
		}

		const blocked = await login(app, { ...MOCK_CREDENTIALS, password: 'wrong' });
		expect(blocked.status).toBe(429);
		expect((await errorBody(blocked)).code).toBe('RATE_LIMITED');
		expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
	});

	it('counts successful login attempts', async () => {
		const { app } = apiHarness({ app: { config: { loginLimit: 1, loginWindowMs: 60_000 } } });

		expect((await login(app)).status).toBe(200);
		expect((await login(app)).status).toBe(429);
	});

	it('does not limit reads', async () => {
		const { app } = apiHarness({ app: { config: { loginLimit: 1, loginWindowMs: 60_000 } } });
		const token = await tokenFrom(app);

		for (let attempt = 0; attempt < 5; attempt++) {
			expect((await app.request('/api/student', { headers: authed(token) })).status).toBe(200);
		}
	});
});

describe('logging', () => {
	let harness: ReturnType<typeof apiHarness>;

	beforeEach(() => {
		harness = apiHarness();
	});

	it('records request metadata', async () => {
		await harness.app.request('/api/health');

		expect(harness.logs).toContainEqual(
			expect.objectContaining({
				event: 'request',
				method: 'GET',
				route: '/api/health',
				status: 200
			})
		);
	});

	it('logs the route pattern, never the document token in the URL', async () => {
		const token = await tokenFrom(harness.app);
		const res = await harness.app.request('/api/documents', { headers: authed(token) });
		const documents = (await res.json()) as Array<{ docToken: string }>;
		const docToken = documents[0]!.docToken;

		await harness.app.request(`/api/documents/${encodeURIComponent(docToken)}`, {
			headers: authed(token)
		});

		const serialized = JSON.stringify(harness.logs);
		expect(serialized).toContain('/api/documents/:docToken');
		expect(serialized).not.toContain(docToken);
	});

	it('never logs credentials or the session token', async () => {
		const token = await tokenFrom(harness.app);
		await harness.app.request('/api/student', { headers: authed(token) });

		const serialized = JSON.stringify(harness.logs);
		expect(serialized).not.toContain(MOCK_CREDENTIALS.password);
		expect(serialized).not.toContain(MOCK_CREDENTIALS.username);
		expect(serialized).not.toContain(token);
	});

	it('records the domain a login targeted', async () => {
		await login(harness.app);

		expect(harness.logs).toContainEqual(
			expect.objectContaining({ event: 'login', domain: MOCK_CREDENTIALS.domain, ok: true })
		);
	});
});

describe('unknown endpoints', () => {
	it('answers 404 in the error envelope', async () => {
		const { app } = apiHarness();
		const res = await app.request('/api/nope');

		expect(res.status).toBe(404);
		expect((await errorBody(res)).message).toBeTruthy();
	});
});
