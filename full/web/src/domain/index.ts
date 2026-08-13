export { IsoDateString } from './common.js';

export { StudentInfoSchema } from './student.js';
export type { StudentInfo } from './student.js';

export { DocumentMetaSchema } from './documents.js';
export type { DocumentMeta, DocumentContent } from './documents.js';

export { AbsencePeriodSchema, AbsenceSchema, AttendanceSchema } from './attendance.js';
export type { AbsencePeriod, Absence, Attendance } from './attendance.js';

export {
	AssignmentSchema,
	CategorySchema,
	CourseSchema,
	GradebookSchema,
	MarkSchema,
	ReportPeriodSchema,
	ResourceSchema,
	StaffSchema
} from './gradebook.js';
export type {
	Assignment,
	Category,
	Course,
	Gradebook,
	Mark,
	ReportPeriod,
	Resource,
	Staff
} from './gradebook.js';

export { ApiErrorSchema, PortalErrorCodeSchema } from './errorCodes.js';
export type { ApiError, PortalErrorCode } from './errorCodes.js';
