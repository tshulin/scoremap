// Sample data so the Grades and Attendance UIs can be demonstrated. Gated
// behind VITE_PLACEHOLDER_DATA (off by default) and always
// flagged in the UI as sample, because invented grades that look real are the worst
// outcome here.
//
// The shapes below are validated against the domain schemas at import, so a typo
// fails loudly at build/load rather than rendering wrong numbers.
import { GradebookSchema, AttendanceSchema } from '../domain/index';

// Optional chaining so this module also imports cleanly under Node (tests), where
// import.meta.env doesn't exist; Vite still populates it at build time in the browser.
export const PLACEHOLDER_DATA = import.meta.env?.VITE_PLACEHOLDER_DATA === 'true';

const teacher = (name, email) => ({ name, email });

// Weighted, mid-term. Finals has weight but no graded work, so the grade must
// renormalize over graded categories (85%, not the 68% you'd get treating Finals
// as a zero). Covers extra credit, an earned zero, a not-for-grading row, and an
// assigned-but-ungraded assignment.
const ALGEBRA = {
  courseId: 'SAMPLE-1',
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
        { name: 'Homework', weightPercentage: 30, pointsEarned: 65, pointsPossible: 75, weightedPercentage: 26, letter: 'B' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 252, pointsPossible: 300, weightedPercentage: 42, letter: 'B' },
        { name: 'Finals', weightPercentage: 20, pointsEarned: 0, pointsPossible: 0, weightedPercentage: 0, letter: '' },
      ],
      assignments: [
        { id: 'SAMPLE-1-1', name: 'Factoring Practice', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-08', dueDate: '2026-09-10', description: 'Sections 3.1–3.4, odd problems.' },
        { id: 'SAMPLE-1-2', name: 'Quadratics Worksheet', pointsEarned: 30, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-15' },
        // An earned zero, not a missing grade.
        { id: 'SAMPLE-1-3', name: 'Warm-up Set 4', pointsEarned: 0, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-18', comments: 'Not turned in.' },
        // Extra credit carries pointsPossible; the extraCredit flag keeps it out of the denominator.
        { id: 'SAMPLE-1-4', name: 'Homework Bonus', pointsEarned: 4, pointsPossible: 4, extraCredit: true, notForGrade: false, category: 'Homework', date: '2026-09-22' },
        { id: 'SAMPLE-1-5', name: 'Unit 1 Test', pointsEarned: 88, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-25' },
        { id: 'SAMPLE-1-9', name: 'Systems of Equations HW', pointsEarned: 13, pointsPossible: 15, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-02' },
        { id: 'SAMPLE-1-6', name: 'Unit 2 Test', pointsEarned: 80, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-09' },
        { id: 'SAMPLE-1-10', name: 'Chapter 5 Quiz', pointsEarned: 84, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-16' },
        // Assigned, not graded.
        { id: 'SAMPLE-1-7', name: 'Unit 3 Test', pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-23', dueDate: '2026-10-23' },
        { id: 'SAMPLE-1-8', name: 'Syllabus Acknowledgement', pointsEarned: 0, pointsPossible: 5, extraCredit: false, notForGrade: true, category: 'Homework', date: '2026-09-02', comments: '(Not For Grading)' },
      ],
    },
  ],
};

// Unweighted: no categories, so the grade is straight point totals. Includes a
// scaled assignment (raw vs. grade-calc points differ) and an ungraded essay.
const BIOLOGY = {
  courseId: 'SAMPLE-2',
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
        { id: 'SAMPLE-2-1', name: 'Cell Structure Lab', pointsEarned: 47, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-09-11' },
        { id: 'SAMPLE-2-2', name: 'Osmosis Quiz', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-19' },
        { id: 'SAMPLE-2-5', name: 'Photosynthesis Quiz', pointsEarned: 23, pointsPossible: 25, extraCredit: false, notForGrade: false, date: '2026-09-26' },
        { id: 'SAMPLE-2-3', name: 'Genetics Problem Set', pointsEarned: 27, pointsPossible: 30, unscaledPoints: { pointsEarned: 22.5, pointsPossible: 25 }, extraCredit: false, notForGrade: false, date: '2026-10-02' },
        { id: 'SAMPLE-2-6', name: 'Dissection Lab', pointsEarned: 46, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-10-09' },
        { id: 'SAMPLE-2-4', name: 'Ecology Essay', pointsPossible: 40, extraCredit: false, notForGrade: false, date: '2026-10-16', dueDate: '2026-10-20', resources: [{ name: 'Essay prompt.pdf', type: 'File' }] },
      ],
    },
  ],
};

// Unweighted with a non-standard grade scale: the teacher's A starts at 84, and
// the stored letter proves it. Exercises grade-index inference (an observed
// A at 84% must drag the inferred A cutoff below the default 93).
const AP_BIOLOGY = {
  courseId: 'SAMPLE-4',
  name: 'AP Biology',
  title: 'AP Biology',
  period: '4',
  room: 'S-204',
  staff: teacher('M. Chen', 'mchen@example.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'A',
      percentage: 84,
      assignments: [
        { id: 'SAMPLE-4-1', name: 'Biochemistry Problem Set', pointsEarned: 40, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-09-10' },
        { id: 'SAMPLE-4-2', name: 'Enzyme Lab Quiz', pointsEarned: 17, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-17' },
        { id: 'SAMPLE-4-3', name: 'Unit 1 Exam', pointsEarned: 84, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-09-24' },
        { id: 'SAMPLE-4-4', name: 'Cell Respiration FRQ', pointsEarned: 20, pointsPossible: 25, extraCredit: false, notForGrade: false, date: '2026-10-08' },
        { id: 'SAMPLE-4-5', name: 'Photosynthesis Lab Report', pointsEarned: 49, pointsPossible: 55, extraCredit: false, notForGrade: false, date: '2026-10-15' },
      ],
    },
  ],
};

// Nothing graded yet - the empty state, which must not render as 0%.
const CERAMICS = {
  courseId: 'SAMPLE-3',
  name: 'Ceramics',
  title: 'Ceramics I',
  period: '3',
  room: 'A-3',
  staff: teacher('J. Lindqvist', 'jlindqvist@example.edu'),
  marks: [{ name: 'Quarter 1', shortName: 'Q1', letter: '', percentage: 0, assignments: [] }],
};

export const SAMPLE_GRADEBOOK = GradebookSchema.parse({
  reportingPeriods: [
    { index: 0, name: 'Quarter 1', startDate: '2026-08-12', endDate: '2026-10-16' },
    { index: 1, name: 'Quarter 2', startDate: '2026-10-19', endDate: '2026-12-18' },
    { index: 2, name: 'Quarter 3', startDate: '2027-01-06', endDate: '2027-03-12' },
    { index: 3, name: 'Quarter 4', startDate: '2027-03-15', endDate: '2027-05-28' },
  ],
  currentPeriodIndex: 0,
  courses: [ALGEBRA, BIOLOGY, AP_BIOLOGY, CERAMICS],
});

// Sample absences to exercise the attendance UI's status classification (excused /
// tardy / unexcused) and per-period detail. The real parser already handles the
// empty case; this only stands in when there are no real absences AND the flag is on.
export const SAMPLE_ATTENDANCE = AttendanceSchema.parse({
  schoolName: 'Sample High School',
  absences: [
    { date: '2026-09-14', reason: 'Excused Absence', note: 'Doctor appointment' },
    {
      date: '2026-09-28',
      periods: [
        { period: '2', reason: 'Tardy' },
        { period: '3', reason: 'Tardy', note: 'Bus late' },
      ],
    },
    { date: '2026-10-05', reason: 'Unexcused Absence' },
  ],
  unreadableAbsences: 0,
});
