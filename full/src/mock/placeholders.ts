// Stand-in gradebook for the term break, when the portal has no grading period to serve.
// Gated behind PLACEHOLDER_DATA, which is refused in production. Attendance has no
// equivalent here on purpose: MOCK_WITH_ABSENCES drives the real parser instead.
// Delete once Part 7b lands — see note.md.
import { GradebookSchema, type Gradebook } from '../domain/index.js';

const teacher = (name: string, email: string) => ({ name, email });

// Weighted, mid-term. Finals has weight but no graded work, so the grade must renormalize.
const ALGEBRA: Gradebook['courses'][number] = {
	courseId: 'PLACEHOLDER-1',
	name: 'Algebra II',
	title: 'Algebra II',
	period: '1',
	room: 'B-204',
	staff: teacher('R. Mendoza', 'rmendoza@example.edu'),
	marks: [
		{
			name: 'Quarter 1',
			shortName: 'Q1',
			letter: 'B',
			percentage: 85,
			categories: [
				{
					name: 'Homework',
					weightPercentage: 30,
					pointsEarned: 52,
					pointsPossible: 60,
					weightedPercentage: 26,
					letter: 'B'
				},
				{
					name: 'Tests',
					weightPercentage: 50,
					pointsEarned: 168,
					pointsPossible: 200,
					weightedPercentage: 42,
					letter: 'B'
				},
				{
					name: 'Finals',
					weightPercentage: 20,
					pointsEarned: 0,
					pointsPossible: 0,
					weightedPercentage: 0,
					letter: ''
				}
			],
			assignments: [
				{
					id: 'PLACEHOLDER-1-1',
					name: 'Factoring Practice',
					pointsEarned: 18,
					pointsPossible: 20,
					extraCredit: false,
					notForGrade: false,
					category: 'Homework',
					date: '2026-09-08',
					dueDate: '2026-09-10',
					description: 'Sections 3.1–3.4, odd problems.'
				},
				{
					id: 'PLACEHOLDER-1-2',
					name: 'Quadratics Worksheet',
					pointsEarned: 30,
					pointsPossible: 30,
					extraCredit: false,
					notForGrade: false,
					category: 'Homework',
					date: '2026-09-15'
				},
				// An earned zero, not a missing grade.
				{
					id: 'PLACEHOLDER-1-3',
					name: 'Warm-up Set 4',
					pointsEarned: 0,
					pointsPossible: 10,
					extraCredit: false,
					notForGrade: false,
					category: 'Homework',
					date: '2026-09-18',
					comments: 'Not turned in.'
				},
				// Extra credit still carries pointsPossible (the portal's ScoreMaxValue); it is
				// the extraCredit flag, not a missing denominator, that keeps it out of the total.
				{
					id: 'PLACEHOLDER-1-4',
					name: 'Homework Bonus',
					pointsEarned: 4,
					pointsPossible: 4,
					extraCredit: true,
					notForGrade: false,
					category: 'Homework',
					date: '2026-09-22'
				},
				{
					id: 'PLACEHOLDER-1-5',
					name: 'Unit 1 Test',
					pointsEarned: 88,
					pointsPossible: 100,
					extraCredit: false,
					notForGrade: false,
					category: 'Tests',
					date: '2026-09-25'
				},
				{
					id: 'PLACEHOLDER-1-6',
					name: 'Unit 2 Test',
					pointsEarned: 80,
					pointsPossible: 100,
					extraCredit: false,
					notForGrade: false,
					category: 'Tests',
					date: '2026-10-09'
				},
				// Assigned, not graded.
				{
					id: 'PLACEHOLDER-1-7',
					name: 'Unit 3 Test',
					pointsPossible: 100,
					extraCredit: false,
					notForGrade: false,
					category: 'Tests',
					date: '2026-10-23',
					dueDate: '2026-10-23'
				},
				{
					id: 'PLACEHOLDER-1-8',
					name: 'Syllabus Acknowledgement',
					pointsEarned: 0,
					pointsPossible: 5,
					extraCredit: false,
					notForGrade: true,
					category: 'Homework',
					date: '2026-09-02',
					comments: '(Not For Grading)'
				}
			]
		}
	]
};

// Unweighted: no categories, so the grade is straight point totals.
const BIOLOGY: Gradebook['courses'][number] = {
	courseId: 'PLACEHOLDER-2',
	name: 'Biology',
	title: 'Biology Honors',
	period: '2',
	room: 'S-110',
	staff: teacher('A. Okafor', 'aokafor@example.edu'),
	marks: [
		{
			name: 'Quarter 1',
			shortName: 'Q1',
			letter: 'A-',
			percentage: 92,
			assignments: [
				{
					id: 'PLACEHOLDER-2-1',
					name: 'Cell Structure Lab',
					pointsEarned: 47,
					pointsPossible: 50,
					extraCredit: false,
					notForGrade: false,
					date: '2026-09-11'
				},
				{
					id: 'PLACEHOLDER-2-2',
					name: 'Osmosis Quiz',
					pointsEarned: 18,
					pointsPossible: 20,
					extraCredit: false,
					notForGrade: false,
					date: '2026-09-19'
				},
				{
					id: 'PLACEHOLDER-2-3',
					name: 'Genetics Problem Set',
					pointsEarned: 27,
					pointsPossible: 30,
					unscaledPoints: { pointsEarned: 22.5, pointsPossible: 25 },
					extraCredit: false,
					notForGrade: false,
					date: '2026-10-02'
				},
				{
					id: 'PLACEHOLDER-2-4',
					name: 'Ecology Essay',
					pointsPossible: 40,
					extraCredit: false,
					notForGrade: false,
					date: '2026-10-16',
					dueDate: '2026-10-20',
					resources: [{ name: 'Essay prompt.pdf', type: 'File' }]
				}
			]
		}
	]
};

// Nothing graded yet — the empty state, which must not render as 0%.
const CERAMICS: Gradebook['courses'][number] = {
	courseId: 'PLACEHOLDER-3',
	name: 'Ceramics',
	title: 'Ceramics I',
	period: '3',
	room: 'A-3',
	staff: teacher('J. Lindqvist', 'jlindqvist@example.edu'),
	marks: [{ name: 'Quarter 1', shortName: 'Q1', letter: '', percentage: 0, assignments: [] }]
};

export const SAMPLE_GRADEBOOK: Gradebook = GradebookSchema.parse({
	reportingPeriods: [
		{ index: 0, name: 'Quarter 1', startDate: '2026-08-12', endDate: '2026-10-16' },
		{ index: 1, name: 'Quarter 2', startDate: '2026-10-19', endDate: '2026-12-18' },
		{ index: 2, name: 'Quarter 3', startDate: '2027-01-06', endDate: '2027-03-12' },
		{ index: 3, name: 'Quarter 4', startDate: '2027-03-15', endDate: '2027-05-28' }
	],
	currentPeriodIndex: 0,
	courses: [ALGEBRA, BIOLOGY, CERAMICS]
} satisfies Gradebook);
