import { z } from 'zod';
import { IsoDateString } from './common';

export const ResourceSchema = z.object({
	name: z.string(),
	type: z.string().optional(),
	url: z.string().optional()
});

export const AssignmentSchema = z.object({
	id: z.string(),
	name: z.string(),
	pointsEarned: z.number().optional(),
	pointsPossible: z.number().optional(),
	extraCredit: z.boolean(),
	notForGrade: z.boolean(),
	unscaledPoints: z.object({ pointsEarned: z.number(), pointsPossible: z.number() }).optional(),
	category: z.string().optional(),
	date: IsoDateString,
	dueDate: IsoDateString.optional(),
	description: z.string().optional(),
	comments: z.string().optional(),
	resources: z.array(ResourceSchema).optional()
});

export const CategorySchema = z.object({
	name: z.string(),
	weightPercentage: z.number(),
	pointsEarned: z.number(),
	pointsPossible: z.number(),
	weightedPercentage: z.number(),
	letter: z.string()
});

export const MarkSchema = z.object({
	name: z.string(),
	shortName: z.string(),
	letter: z.string(),
	percentage: z.number(),
	categories: z.array(CategorySchema).optional(),
	// True when the portal showed category rows the parser could not read: the
	// weights were dropped (see classDetail.ts) and computed grades fall back
	// to total points - the UI must say so rather than let a weighted class
	// silently read as total-points.
	categoriesUnreadable: z.boolean().optional(),
	assignments: z.array(AssignmentSchema)
});

export const StaffSchema = z.object({
	name: z.string(),
	email: z.string().optional(),
	gu: z.string().optional()
});

export const CourseSchema = z.object({
	courseId: z.string(),
	name: z.string(),
	title: z.string(),
	period: z.string(),
	room: z.string(),
	staff: StaffSchema,
	imageType: z.string().optional(),
	marks: z.array(MarkSchema)
});

// Dates are optional: the legacy XML carried them, but the PXP2 gradebook page
// only names its grading periods. Nothing downstream reads the dates.
export const ReportPeriodSchema = z.object({
	index: z.number(),
	name: z.string(),
	startDate: IsoDateString.optional(),
	endDate: IsoDateString.optional()
});

// The unreadable* counters follow the attendance/mail pattern: a row or course
// the parser could not read is skipped and counted, never silently dropped.
export const GradebookSchema = z.object({
	reportingPeriods: z.array(ReportPeriodSchema),
	currentPeriodIndex: z.number(),
	courses: z.array(CourseSchema),
	unreadableCourses: z.number().default(0),
	unreadableAssignments: z.number().default(0),
	unreadableCategories: z.number().default(0)
});

export type Resource = z.infer<typeof ResourceSchema>;
export type Assignment = z.infer<typeof AssignmentSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Mark = z.infer<typeof MarkSchema>;
export type Staff = z.infer<typeof StaffSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;
export type Gradebook = z.infer<typeof GradebookSchema>;
