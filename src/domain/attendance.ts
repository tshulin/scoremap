import { z } from 'zod';
import { IsoDateString } from './common.js';

export const AbsencePeriodSchema = z.object({
	period: z.string(),
	reason: z.string().optional(),
	note: z.string().optional()
});

export const AbsenceSchema = z.object({
	date: IsoDateString,
	reason: z.string().optional(),
	note: z.string().optional(),
	periods: z.array(AbsencePeriodSchema).optional()
});

export const AttendanceSchema = z.object({
	schoolName: z.string(),
	absences: z.array(AbsenceSchema)
});

export type AbsencePeriod = z.infer<typeof AbsencePeriodSchema>;
export type Absence = z.infer<typeof AbsenceSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;
