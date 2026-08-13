import { z } from 'zod';
import { IsoDateString } from './common';

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
	absences: z.array(AbsenceSchema),
	// Rows the parser could not read. Surfaced rather than hidden: a short absence list a
	// student believes is complete could hide an unexcused absence.
	unreadableAbsences: z.number().int().min(0).default(0)
});

export type AbsencePeriod = z.infer<typeof AbsencePeriodSchema>;
export type Absence = z.infer<typeof AbsenceSchema>;
export type Attendance = z.infer<typeof AttendanceSchema>;
