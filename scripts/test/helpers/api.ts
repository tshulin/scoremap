import { createApp, type CreateAppOptions } from '../../src/api/app.js';
import {
	createMockPortal,
	mockPortalFetch,
	type MockPortalOptions
} from '../../src/mock/portal.js';
import type { FetchLike } from '../../src/portal/http.js';

export interface HarnessOptions extends MockPortalOptions {
	app?: Omit<CreateAppOptions, 'fetchOptions'>;
	fetchImpl?: FetchLike;
}

export function apiHarness(options: HarnessOptions = {}) {
	const { app: appOptions, fetchImpl, ...portalOptions } = options;

	const app = createApp({
		...appOptions,
		fetchOptions: { fetchImpl: fetchImpl ?? mockPortalFetch(createMockPortal(portalOptions)) }
	});

	return { app };
}

export const loginRequest = (body: unknown): Request =>
	new Request('http://api.test/api/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

export const authed = (token: string): { Authorization: string } => ({
	Authorization: `Bearer ${token}`
});
