import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import type { ApiError, PortalErrorCode } from '../domain/index.js';
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

export class RequestValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RequestValidationError';
	}
}

export class RateLimitedError extends Error {
	readonly retryAfterSeconds: number;

	constructor(retryAfterSeconds: number) {
		super('Too many login attempts. Wait a moment and try again.');
		this.name = 'RateLimitedError';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

interface Mapping {
	status: ContentfulStatusCode;
	code: PortalErrorCode;
}

// Keep the base PortalError last because instanceof also matches subclasses.
const PORTAL_ERROR_MAPPINGS: Array<[abstract new (...args: never[]) => Error, Mapping]> = [
	[InvalidDomainError, { status: 400, code: 'VALIDATION' }],
	[AuthError, { status: 401, code: 'AUTH_FAILED' }],
	[SessionExpiredError, { status: 401, code: 'SESSION_EXPIRED' }],
	[NoActiveGradingPeriodError, { status: 409, code: 'NO_ACTIVE_GRADING_PERIOD' }],
	[ModuleUnavailableError, { status: 502, code: 'MODULE_UNAVAILABLE' }],
	[PortalShapeError, { status: 502, code: 'PARSE_FAILED' }],
	[ParseError, { status: 502, code: 'PARSE_FAILED' }],
	[PortalHttpError, { status: 502, code: 'PORTAL_UNAVAILABLE' }],
	[PortalError, { status: 502, code: 'PORTAL_UNAVAILABLE' }]
];

const envelope = (code: PortalErrorCode, message: string): ApiError => ({
	error: { code, message }
});

const zodMessage = (error: ZodError): string =>
	error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');

export interface ApiErrorResponse {
	status: ContentfulStatusCode;
	body: ApiError;
	headers: Record<string, string>;
}

export function apiErrorFor(error: unknown): ApiErrorResponse {
	if (error instanceof ZodError) {
		return { status: 400, body: envelope('VALIDATION', zodMessage(error)), headers: {} };
	}

	if (error instanceof RequestValidationError) {
		return { status: 400, body: envelope('VALIDATION', error.message), headers: {} };
	}

	if (error instanceof RateLimitedError) {
		return {
			status: 429,
			body: envelope('RATE_LIMITED', error.message),
			headers: { 'Retry-After': String(error.retryAfterSeconds) }
		};
	}

	for (const [ErrorClass, mapping] of PORTAL_ERROR_MAPPINGS) {
		if (error instanceof ErrorClass) {
			return { status: mapping.status, body: envelope(mapping.code, error.message), headers: {} };
		}
	}

	return { status: 500, body: envelope('INTERNAL', 'Something went wrong.'), headers: {} };
}

export const errorHandler = (error: Error, c: Context): Response => {
	const { status, body, headers } = apiErrorFor(error);
	return c.json(body, status, headers);
};
