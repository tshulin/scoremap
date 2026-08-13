import { z } from 'zod';

export const LoginRequestSchema = z.object({
	domain: z.string().min(1).max(253),
	username: z.string().min(1).max(200),
	password: z.string().min(1).max(200)
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const GradebookQuerySchema = z.object({
	period: z.coerce.number().int().min(0).max(50).optional()
});
