import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PortalErrorCodeSchema } from '../domain/index.js';
import {
	AuthError,
	InvalidDomainError,
	ModuleUnavailableError,
	NoActiveGradingPeriodError,
	ParseError,
	PortalError,
	PortalHttpError,
	PortalShapeError,
	SessionExpiredError
} from '../portal/errors.js';
import { apiErrorFor, RateLimitedError, RequestValidationError } from './errors.js';

describe('apiErrorFor — portal errors', () => {
	const cases = [
		[new InvalidDomainError('bad domain'), 400, 'VALIDATION'],
		[new AuthError('bad password'), 401, 'AUTH_FAILED'],
		[new SessionExpiredError('gone'), 401, 'SESSION_EXPIRED'],
		[new NoActiveGradingPeriodError('no term'), 409, 'NO_ACTIVE_GRADING_PERIOD'],
		[new ModuleUnavailableError('off'), 502, 'MODULE_UNAVAILABLE'],
		[new PortalShapeError('odd page'), 502, 'PARSE_FAILED'],
		[new ParseError('unreadable'), 502, 'PARSE_FAILED'],
		[
			new PortalHttpError('portal 500', { url: 'https://portal.test', status: 500 }),
			502,
			'PORTAL_UNAVAILABLE'
		],
		[new PortalError('generic'), 502, 'PORTAL_UNAVAILABLE']
	] as const;

	it.each(cases)('maps %s', (error, status, code) => {
		const result = apiErrorFor(error);

		expect(result.status).toBe(status);
		expect(result.body.error.code).toBe(code);
	});

	it('preserves portal error messages', () => {
		expect(apiErrorFor(new AuthError('Login failed.')).body.error.message).toBe('Login failed.');
	});

	it('covers every PortalError subclass', () => {
		const mapped = new Set(cases.map(([error]) => error.constructor.name));
		const subclasses = [
			'InvalidDomainError',
			'AuthError',
			'PortalShapeError',
			'SessionExpiredError',
			'ModuleUnavailableError',
			'NoActiveGradingPeriodError',
			'ParseError',
			'PortalHttpError',
			'PortalError'
		];

		expect([...mapped].sort()).toEqual([...subclasses].sort());
	});
});

describe('apiErrorFor — request errors', () => {
	it('maps a Zod failure to 400 VALIDATION naming the field', () => {
		const error = z.object({ username: z.string() }).safeParse({}).error!;
		const result = apiErrorFor(error);

		expect(result.status).toBe(400);
		expect(result.body.error.code).toBe('VALIDATION');
		expect(result.body.error.message).toContain('username');
	});

	it('does not echo the rejected value', () => {
		const error = z
			.object({ password: z.string().min(20) })
			.safeParse({ password: 'hunter2' }).error!;

		expect(apiErrorFor(error).body.error.message).not.toContain('hunter2');
	});

	it('maps a malformed request body to 400 VALIDATION', () => {
		const result = apiErrorFor(new RequestValidationError('Request body must be valid JSON.'));

		expect(result.status).toBe(400);
		expect(result.body.error.code).toBe('VALIDATION');
	});

	it('maps a rate limit to 429 with Retry-After', () => {
		const result = apiErrorFor(new RateLimitedError(42));

		expect(result.status).toBe(429);
		expect(result.body.error.code).toBe('RATE_LIMITED');
		expect(result.headers['Retry-After']).toBe('42');
	});
});

describe('apiErrorFor — unexpected errors', () => {
	it('becomes a generic 500 that reveals nothing', () => {
		const result = apiErrorFor(
			new TypeError("Cannot read properties of undefined (reading 'jar')")
		);

		expect(result.status).toBe(500);
		expect(result.body.error.code).toBe('INTERNAL');
		expect(result.body.error.message).toBe('Something went wrong.');
	});

	it('handles a thrown non-error', () => {
		expect(apiErrorFor('just a string').status).toBe(500);
		expect(apiErrorFor(undefined).status).toBe(500);
	});
});

describe('error envelope', () => {
	it('uses codes declared by the domain', () => {
		const errors = [
			new AuthError('x'),
			new RateLimitedError(1),
			new RequestValidationError('x'),
			new TypeError('x')
		];

		for (const error of errors) {
			expect(() => PortalErrorCodeSchema.parse(apiErrorFor(error).body.error.code)).not.toThrow();
		}
	});
});
