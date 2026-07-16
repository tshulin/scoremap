import { z } from 'zod';

export const PortalErrorCodeSchema = z.enum([
	'AUTH_FAILED',
	'SESSION_EXPIRED',
	'NO_ACTIVE_GRADING_PERIOD',
	'MODULE_UNAVAILABLE',
	'PORTAL_UNAVAILABLE',
	'PARSE_FAILED',
	'VALIDATION'
]);

export type PortalErrorCode = z.infer<typeof PortalErrorCodeSchema>;

export const ApiErrorSchema = z.object({
	error: z.object({
		code: PortalErrorCodeSchema,
		message: z.string()
	})
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
