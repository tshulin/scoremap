export { IsoDateString } from './common';

export { StudentInfoSchema } from './student';
export type { StudentInfo } from './student';

export { DocumentMetaSchema } from './documents';
export type { DocumentMeta, DocumentContent } from './documents';

export { AbsencePeriodSchema, AbsenceSchema, AttendanceSchema } from './attendance';
export type { AbsencePeriod, Absence, Attendance } from './attendance';

export {
	AssignmentSchema,
	CategorySchema,
	CourseSchema,
	GradebookSchema,
	MarkSchema,
	ReportPeriodSchema,
	ResourceSchema,
	StaffSchema
} from './gradebook';
export type {
	Assignment,
	Category,
	Course,
	Gradebook,
	Mark,
	ReportPeriod,
	Resource,
	Staff
} from './gradebook';

export { ApiErrorSchema, PortalErrorCodeSchema } from './errorCodes';
export type { ApiError, PortalErrorCode } from './errorCodes';
