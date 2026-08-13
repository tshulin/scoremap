import { z } from 'zod';

export const StudentInfoSchema = z.object({
	name: z.string(),
	permId: z.string(),
	gender: z.string(),
	grade: z.string(),
	photoBase64: z.string().optional()
});

export type StudentInfo = z.infer<typeof StudentInfoSchema>;
