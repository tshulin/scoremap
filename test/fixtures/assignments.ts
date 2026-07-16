export type RawAssignmentRow = Record<string, unknown>;

// Missing keys and empty strings intentionally represent different portal values.
const base = {
	GradebookID: '12345',
	Measure: 'Chapter 3 Problem Set',
	Type: 'Homework',
	Date: '8/20/2025',
	DueDate: '8/22/2025',
	Notes: '',
	MeasureDescription: 'Odd problems only'
};

export const NORMAL: RawAssignmentRow = {
	...base,
	Score: '25',
	DisplayScore: '3 out of 4',
	ScoreCalValue: '3',
	ScoreMaxValue: '4',
	Points: '3 / 4',
	Point: '3',
	PointPossible: '4'
};

export const SCALED: RawAssignmentRow = {
	...base,
	Score: '3',
	DisplayScore: '3 out of 4',
	ScoreCalValue: '3',
	ScoreMaxValue: '4',
	Points: '6 / 8',
	Point: '6',
	PointPossible: '8'
};

export const NOT_GRADED: RawAssignmentRow = {
	...base,
	DisplayScore: 'Not Graded',
	ScoreMaxValue: '4',
	Points: '4 Points Possible'
};

export const NOT_GRADED_NO_MAX: RawAssignmentRow = {
	...base,
	DisplayScore: 'Not Graded',
	Points: '4 Points Possible'
};

export const NOT_GRADED_NO_POSSIBLE: RawAssignmentRow = {
	...base,
	DisplayScore: 'Not Graded',
	Points: 'Points Possible'
};

export const ZERO_EMPTY_POINT: RawAssignmentRow = {
	...base,
	DisplayScore: '0 out of 4',
	ScoreCalValue: '0',
	ScoreMaxValue: '4',
	Points: ' / 4',
	Point: '',
	PointPossible: '4'
};

export const EXTRA_CREDIT: RawAssignmentRow = {
	...base,
	Score: '3',
	DisplayScore: '3 out of 4',
	ScoreCalValue: '3',
	ScoreMaxValue: '4',
	Points: '3 / ',
	Point: '3',
	PointPossible: ''
};

// Extra credit with no ScoreMaxValue and no total in Points: nothing supplies a
// pointsPossible, so the domain object has none at all.
export const EXTRA_CREDIT_NO_MAX: RawAssignmentRow = {
	...base,
	Score: '3',
	DisplayScore: '3 extra credit',
	Points: '3 / ',
	Point: '3',
	PointPossible: ''
};

export const NOT_FOR_GRADING: RawAssignmentRow = {
	...base,
	DisplayScore: '3 out of 4',
	ScoreCalValue: '3',
	ScoreMaxValue: '4',
	Points: '3 / 4',
	Point: '3',
	PointPossible: '4',
	Notes: '(Not For Grading) Practice only'
};
