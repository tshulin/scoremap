import { z } from 'zod';

export const IsoDateString = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}(T[\d:.+Z-]+)?$/, 'expected an ISO-8601 date or datetime string');
