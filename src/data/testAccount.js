// Built-in test account — sign in with username "test" / password "test" at
// the "Hustler's University" district (hustler-uni-psv.edupoint.com) to get a
// fully populated fake student. Unlike VITE_DEMO (a build-time switch that
// refuses to ship), this works in ANY build, including production: it exists so
// features can be exercised on the deployed site without a real StudentVUE
// account. No network is involved — login, sync, and document downloads are
// short-circuited in api.js / studentvue.js when these credentials are used.
//
// The dataset is deliberately ample and spread across the grade bands:
// one course each at A, B, C, and F (exercising the grade color palette),
// 10+ dated assignments per course (so the grade chart has a real series),
// and a document center with several categories. Shapes are validated against
// the domain schemas at import, so a typo fails loudly.
import { GradebookSchema, AttendanceSchema, DocumentMetaSchema, MailMessageSchema } from '../domain/index';

export const TEST_DISTRICT = {
  state: 'Test',
  name: "Hustler's University",
  domain: 'hustler-uni-psv.edupoint.com',
};

export const TEST_USERNAME = 'test';
export const TEST_PASSWORD = 'test';

export const TEST_STUDENT = {
  name: 'Test Student',
  permId: 'TEST-0001',
  gender: '',
  grade: '11',
};

// The district gate matters: "test" is a plausible real username elsewhere, so
// the fake account only exists at the fake district's domain.
export function isTestCredentials({ domain, username, password }) {
  return (
    (domain || '').toLowerCase() === TEST_DISTRICT.domain &&
    (username || '').trim().toLowerCase() === TEST_USERNAME &&
    password === TEST_PASSWORD
  );
}

const teacher = (name, email) => ({ name, email });

// A (96%), weighted. Homework carries extra credit (78 earned of 80 possible
// includes a +2 EC row), plus an upcoming ungraded test and a not-for-grade
// row. 0.2×97.5 + 0.3×95 + 0.5×96 = 96.
const CALCULUS = {
  courseId: 'TEST-1',
  name: 'AP Calculus BC',
  title: 'AP Calculus BC',
  period: '1',
  room: 'B-210',
  staff: teacher('K. Nakamura', 'knakamura@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'A',
      percentage: 96,
      categories: [
        { name: 'Homework', weightPercentage: 20, pointsEarned: 78, pointsPossible: 80, weightedPercentage: 19.5, letter: 'A+' },
        { name: 'Quizzes', weightPercentage: 30, pointsEarned: 76, pointsPossible: 80, weightedPercentage: 28.5, letter: 'A' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 288, pointsPossible: 300, weightedPercentage: 48, letter: 'A' },
      ],
      assignments: [
        { id: 'TEST-1-1', name: 'Syllabus Signature', pointsEarned: 5, pointsPossible: 5, extraCredit: false, notForGrade: true, category: 'Homework', date: '2026-08-13', comments: '(Not For Grading)' },
        { id: 'TEST-1-2', name: 'HW 1.1 Limits Practice', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-17' },
        { id: 'TEST-1-3', name: 'HW 1.2 Continuity', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-20' },
        { id: 'TEST-1-4', name: 'Quiz: Limits & Continuity', pointsEarned: 20, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-08-24' },
        { id: 'TEST-1-5', name: 'HW 2.1 Derivative Rules', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-26' },
        { id: 'TEST-1-6', name: 'Unit 1 Test: Limits', pointsEarned: 95, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-08-28' },
        { id: 'TEST-1-7', name: 'HW 2.2 Chain Rule', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-01' },
        { id: 'TEST-1-8', name: 'Quiz: Derivative Rules', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-09-03' },
        { id: 'TEST-1-9', name: 'HW 2.3 Implicit Differentiation', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-09' },
        { id: 'TEST-1-10', name: 'Unit 2 Test: Derivatives', pointsEarned: 97, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-11' },
        { id: 'TEST-1-11', name: 'HW 3.1 Related Rates', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-16' },
        { id: 'TEST-1-12', name: 'Derivative Challenge Problem', pointsEarned: 2, pointsPossible: 2, extraCredit: true, notForGrade: false, category: 'Homework', date: '2026-09-18' },
        { id: 'TEST-1-13', name: 'Quiz: Applications of Derivatives', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-09-21' },
        { id: 'TEST-1-14', name: 'HW 3.2 Optimization', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-24' },
        { id: 'TEST-1-15', name: 'Quiz: Curve Sketching', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-10-01' },
        { id: 'TEST-1-16', name: 'HW 4.1 Riemann Sums', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-06' },
        { id: 'TEST-1-17', name: 'Unit 3 Test: Applications', pointsEarned: 96, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-09' },
        { id: 'TEST-1-18', name: 'Unit 4 Test: Integration', pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-15', dueDate: '2026-10-15' },
      ],
    },
  ],
};

// B (86%), unweighted straight points: 430/500. Includes a scaled assignment
// (graded out of 10, scaled to 30) and an ungraded upcoming paper with a
// resource attachment.
const ENGLISH = {
  courseId: 'TEST-2',
  name: 'English 11 Honors',
  title: 'English 11 Honors',
  period: '2',
  room: 'L-104',
  staff: teacher('D. Whitfield', 'dwhitfield@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'B',
      percentage: 86,
      assignments: [
        { id: 'TEST-2-1', name: 'Vocab Quiz 1', pointsEarned: 17, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-08-19' },
        { id: 'TEST-2-2', name: 'Reading Response 1', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-21' },
        { id: 'TEST-2-3', name: 'Grammar Diagnostic', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-25' },
        { id: 'TEST-2-4', name: 'Gatsby Essay Draft', pointsEarned: 43, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-08-31', description: 'First full draft, graded on completeness.' },
        { id: 'TEST-2-5', name: 'Vocab Quiz 2', pointsEarned: 16, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-02' },
        { id: 'TEST-2-6', name: 'Reading Response 2', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-08' },
        { id: 'TEST-2-7', name: 'Gatsby Final Essay', pointsEarned: 85, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-09-14' },
        { id: 'TEST-2-8', name: 'Socratic Seminar', pointsEarned: 27, pointsPossible: 30, unscaledPoints: { pointsEarned: 9, pointsPossible: 10 }, extraCredit: false, notForGrade: false, date: '2026-09-17' },
        { id: 'TEST-2-9', name: 'Vocab Quiz 3', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-23' },
        { id: 'TEST-2-10', name: 'Reading Response 3', pointsEarned: 7, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-28' },
        { id: 'TEST-2-11', name: 'Poetry Annotation', pointsEarned: 25, pointsPossible: 30, extraCredit: false, notForGrade: false, date: '2026-10-01' },
        { id: 'TEST-2-12', name: 'Midterm Exam', pointsEarned: 84, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-10-07' },
        { id: 'TEST-2-13', name: 'Group Presentation', pointsEarned: 45, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-10-09' },
        { id: 'TEST-2-14', name: 'Reading Response 4', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-12' },
        { id: 'TEST-2-15', name: 'Poetry Recitation', pointsEarned: 27, pointsPossible: 30, extraCredit: false, notForGrade: false, date: '2026-10-14' },
        { id: 'TEST-2-16', name: 'Research Paper: Modernism', pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-10-15', dueDate: '2026-10-20', resources: [{ name: 'Research paper rubric.pdf', type: 'File' }] },
      ],
    },
  ],
};

// C (74.5%), weighted. 0.3×80 + 0.2×75 + 0.5×71 = 74.5.
const CHEMISTRY = {
  courseId: 'TEST-3',
  name: 'Chemistry',
  title: 'Chemistry',
  period: '3',
  room: 'S-215',
  staff: teacher('P. Vasquez', 'pvasquez@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'C',
      percentage: 74.5,
      categories: [
        { name: 'Labs', weightPercentage: 30, pointsEarned: 120, pointsPossible: 150, weightedPercentage: 24, letter: 'B-' },
        { name: 'Homework', weightPercentage: 20, pointsEarned: 45, pointsPossible: 60, weightedPercentage: 15, letter: 'C' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 213, pointsPossible: 300, weightedPercentage: 35.5, letter: 'C-' },
      ],
      assignments: [
        { id: 'TEST-3-1', name: 'Lab Safety Contract', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: true, category: 'Labs', date: '2026-08-14', comments: '(Not For Grading)' },
        { id: 'TEST-3-2', name: 'HW: Significant Figures', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-18' },
        { id: 'TEST-3-3', name: 'Lab: Density of Metals', pointsEarned: 26, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-08-20' },
        { id: 'TEST-3-4', name: 'HW: Unit Conversions', pointsEarned: 7, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-27' },
        { id: 'TEST-3-5', name: 'Test: Matter & Measurement', pointsEarned: 74, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-08-31' },
        { id: 'TEST-3-6', name: 'Lab: Separation of Mixtures', pointsEarned: 22, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-01' },
        { id: 'TEST-3-7', name: 'HW: Atomic Structure', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-08' },
        { id: 'TEST-3-8', name: 'Lab: Flame Tests', pointsEarned: 25, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-15' },
        { id: 'TEST-3-9', name: 'HW: Electron Configurations', pointsEarned: 6, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-17' },
        { id: 'TEST-3-10', name: 'Test: Atomic Theory', pointsEarned: 68, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-21' },
        { id: 'TEST-3-11', name: 'HW: Periodic Trends', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-25' },
        { id: 'TEST-3-12', name: 'Lab: Periodic Properties', pointsEarned: 23, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-29' },
        { id: 'TEST-3-13', name: 'HW: Ionic Bonding', pointsEarned: 7, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-05' },
        { id: 'TEST-3-14', name: 'Lab: Ionic vs. Covalent', pointsEarned: 24, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-10-08' },
        { id: 'TEST-3-15', name: 'Test: Bonding', pointsEarned: 71, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-12' },
        { id: 'TEST-3-16', name: 'Quiz: The Mole Concept', pointsPossible: 25, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-15', dueDate: '2026-10-15' },
      ],
    },
  ],
};

// F (55%), unweighted: 220/400, dragged down by missing work (earned zeros).
const HISTORY = {
  courseId: 'TEST-4',
  name: 'World History',
  title: 'World History',
  period: '4',
  room: 'H-112',
  staff: teacher('M. Adeyemi', 'madeyemi@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'F',
      percentage: 55,
      assignments: [
        { id: 'TEST-4-1', name: 'Map Activity: Empires', pointsEarned: 15, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-08-18' },
        { id: 'TEST-4-2', name: 'Reading Notes Ch 1', pointsEarned: 0, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-24', comments: 'Missing — not turned in.' },
        { id: 'TEST-4-3', name: 'Unit 1 Quiz', pointsEarned: 12, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-08-27' },
        { id: 'TEST-4-4', name: 'Primary Source Analysis', pointsEarned: 18, pointsPossible: 25, extraCredit: false, notForGrade: false, date: '2026-09-02' },
        { id: 'TEST-4-5', name: 'Reading Notes Ch 2', pointsEarned: 5, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-09' },
        { id: 'TEST-4-6', name: 'Unit 1 Test', pointsEarned: 58, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-09-15' },
        { id: 'TEST-4-7', name: 'Reading Notes Ch 3', pointsEarned: 0, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-22', comments: 'Missing — not turned in.' },
        { id: 'TEST-4-8', name: 'Timeline Project', pointsEarned: 30, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-09-25' },
        { id: 'TEST-4-9', name: 'Unit 2 Quiz', pointsEarned: 9, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-30' },
        { id: 'TEST-4-10', name: 'Reading Notes Ch 4', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-06' },
        { id: 'TEST-4-11', name: 'Essay: Causes of WWI', pointsEarned: 28, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-10-09' },
        { id: 'TEST-4-12', name: 'Unit 2 Test', pointsEarned: 35, pointsPossible: 75, extraCredit: false, notForGrade: false, date: '2026-10-13' },
        { id: 'TEST-4-13', name: 'Cold War Debate', pointsPossible: 40, extraCredit: false, notForGrade: false, date: '2026-10-16', dueDate: '2026-10-16' },
      ],
    },
  ],
};

export const TEST_GRADEBOOK = GradebookSchema.parse({
  reportingPeriods: [
    { index: 0, name: 'Quarter 1', startDate: '2026-08-12', endDate: '2026-10-16' },
    { index: 1, name: 'Quarter 2', startDate: '2026-10-19', endDate: '2026-12-18' },
    { index: 2, name: 'Quarter 3', startDate: '2027-01-06', endDate: '2027-03-12' },
    { index: 3, name: 'Quarter 4', startDate: '2027-03-15', endDate: '2027-05-28' },
  ],
  currentPeriodIndex: 0,
  courses: [CALCULUS, ENGLISH, CHEMISTRY, HISTORY],
});

export const TEST_ATTENDANCE = AttendanceSchema.parse({
  schoolName: "Hustler's University",
  absences: [
    { date: '2026-08-28', reason: 'Excused Absence', note: 'Family travel' },
    {
      date: '2026-09-10',
      periods: [
        { period: '1', reason: 'Tardy' },
        { period: '2', reason: 'Tardy', note: 'Overslept' },
      ],
    },
    { date: '2026-09-21', reason: 'Unexcused Absence' },
    { date: '2026-10-02', reason: 'Excused Absence', note: 'Medical appointment' },
    { date: '2026-10-13', reason: 'Field Trip', note: 'DECA competition' },
  ],
  unreadableAbsences: 0,
});

export const TEST_DOCUMENTS = [
  { docToken: 'TESTDOC-01', title: 'Report Card — Q4 2025-2026', category: 'Report Card', uploadDate: '2026-06-05' },
  { docToken: 'TESTDOC-02', title: 'Report Card — Q3 2025-2026', category: 'Report Card', uploadDate: '2026-03-20' },
  { docToken: 'TESTDOC-03', title: 'Report Card — Q2 2025-2026', category: 'Report Card', uploadDate: '2025-12-19' },
  { docToken: 'TESTDOC-04', title: 'Report Card — Q1 2025-2026', category: 'Report Card', uploadDate: '2025-10-17' },
  { docToken: 'TESTDOC-05', title: 'Progress Report — September 2026', category: 'Progress Report', uploadDate: '2026-09-18' },
  { docToken: 'TESTDOC-06', title: 'Unofficial Transcript', category: 'Transcript', uploadDate: '2026-08-14' },
  { docToken: 'TESTDOC-07', title: 'MAP Growth Family Report — Spring 2026', category: 'MAP Growth Family Report', uploadDate: '2026-05-12' },
  { docToken: 'TESTDOC-08', title: 'MAP Growth Family Report — Fall 2025', category: 'MAP Growth Family Report', uploadDate: '2025-10-02' },
  { docToken: 'TESTDOC-09', title: 'Immunization Record', category: 'Health', uploadDate: '2025-08-20' },
  { docToken: 'TESTDOC-10', title: 'Class Schedule 2026-2027', category: 'Schedule', uploadDate: '2026-08-10' },
].map((d) => DocumentMetaSchema.parse(d));

// The former Mail.jsx placeholder messages, now the test account's mailbox so
// mail flows through the same sync pipeline as everything else. Contents match
// the design mock (Gmail-style mail design.pdf).
export const TEST_MAIL = [
  {
    id: 'm1',
    subject: 'Action Needed: DECA/ROP Survey',
    sender: { name: 'Tami Raaker', role: 'Teacher', email: 'traaker@pleasantonusd.net' },
    date: '2025-05-13',
    body: [
      'Hi all,',
      "Please complete the DECA/ROP end-of-year survey by this Friday. It helps us plan next year's program and only takes a couple of minutes.",
      'Regards,\nMrs. Raaker',
    ],
    links: [{ label: 'DECA/ROP Survey', url: 'https://example.com/deca-rop-survey' }],
    attachments: [],
  },
  {
    id: 'm2',
    subject: 'Grades: 09, 10, 11, 12, 13 - Are You Moving?',
    sender: { name: 'Brigitte Holling', role: 'Staff', email: 'bholling@pleasantonusd.net' },
    date: '2025-05-07',
    body: [
      'Families,',
      'If your student is moving or will not be returning to Foothill next year, please let the office know so we can update enrollment. The withdrawal form, FAQ, and office contact are linked below.',
      'Thank you,\nB. Holling',
    ],
    links: [
      { label: 'Withdrawal Form', url: 'https://example.com/withdrawal-form' },
      { label: 'Enrollment FAQ', url: 'https://example.com/enrollment-faq' },
      { label: 'Contact the Office', url: 'https://example.com/office-contact' },
    ],
    attachments: [],
  },
  {
    id: 'm3',
    subject: 'Grades: 09, 10, 11 - Summer Opportunities!',
    sender: { name: 'Anabel Delgado', role: 'Staff', email: 'adelgado@pleasantonusd.net' },
    date: '2025-04-28',
    body: [
      'Hello students,',
      'A number of summer programs, internships, and volunteer opportunities are now open. Details and application links are below, and the flyers are attached.',
      'Best,\nA. Delgado',
    ],
    links: [
      { label: 'Summer Internships', url: 'https://example.com/summer-internships' },
      { label: 'Volunteer Portal', url: 'https://example.com/volunteer-portal' },
      { label: 'Enrichment Camps', url: 'https://example.com/enrichment-camps' },
      { label: 'Scholarships', url: 'https://example.com/scholarships' },
    ],
    attachments: [
      { token: 'TESTMAIL-ATT-01', name: 'Summer Programs.pdf' },
      { token: 'TESTMAIL-ATT-02', name: 'Internship Flyer.pdf' },
      { token: 'TESTMAIL-ATT-03', name: 'Volunteer Guide.pdf' },
      { token: 'TESTMAIL-ATT-04', name: 'Camp Schedule.pdf' },
      { token: 'TESTMAIL-ATT-05', name: 'Scholarship List.pdf' },
    ],
  },
  {
    id: 'm4',
    subject: 'Grades: 09, 10, 11 - Summer Enrichment Opportunities!',
    sender: { name: 'Anabel Delgado', role: 'Staff', email: 'adelgado@pleasantonusd.net' },
    date: '2025-04-22',
    body: [
      'Hello students,',
      'More enrichment opportunities for the summer have been posted. See the links below to learn more and apply.',
      'Best,\nA. Delgado',
    ],
    links: [
      { label: 'STEM Summer Institute', url: 'https://example.com/stem-institute' },
      { label: 'Arts Intensive', url: 'https://example.com/arts-intensive' },
      { label: 'Writing Workshop', url: 'https://example.com/writing-workshop' },
      { label: 'Leadership Camp', url: 'https://example.com/leadership-camp' },
    ],
    attachments: [],
  },
  {
    id: 'm5',
    subject: 'Grades: 09, 10, 11, 12 - Volunteers Needed!',
    sender: { name: 'Anabel Delgado', role: 'Staff', email: 'adelgado@pleasantonusd.net' },
    date: '2025-04-17',
    body: [
      'Hi everyone,',
      "We're looking for volunteers to help at upcoming school events. Sign up using the link below — all grade levels welcome.",
      'Thanks,\nA. Delgado',
    ],
    links: [{ label: 'Volunteer Sign-Up', url: 'https://example.com/volunteer-signup' }],
    attachments: [],
  },
  {
    id: 'm6',
    subject: 'Grades: 09, 10, 11, 12 - Volunteer Opportunities!',
    sender: { name: 'Anabel Delgado', role: 'Staff', email: 'adelgado@pleasantonusd.net' },
    date: '2025-04-15',
    body: [
      'Hi everyone,',
      'New volunteer opportunities are available this month. Check the links below for details and to sign up.',
      'Thanks,\nA. Delgado',
    ],
    links: [
      { label: 'Community Cleanup', url: 'https://example.com/community-cleanup' },
      { label: 'Tutoring Program', url: 'https://example.com/tutoring-program' },
    ],
    attachments: [],
  },
  {
    id: 'm7',
    subject: 'Grades: 09, 10, 11, 12 - Out of State Mini College Fair: Tomorrow during lunch at FHS!',
    sender: { name: 'Anabel Delgado', role: 'Staff', email: 'adelgado@pleasantonusd.net' },
    date: '2025-04-14',
    body: [
      'Students,',
      'A mini college fair with out-of-state schools will be held tomorrow during lunch at FHS. Stop by to meet admissions reps — the list of attending colleges is attached.',
      'Best,\nA. Delgado',
    ],
    links: [],
    attachments: [{ token: 'TESTMAIL-ATT-06', name: 'College List.pdf' }],
  },
].map((m) => MailMessageSchema.parse(m));

// ---- document downloads ----
// Real documents stream from the portal; test documents are generated here as
// tiny single-page PDFs so the download flow (blob → save) works end to end.

// PDF strings take latin-ish text with \, (, ) escaped; anything outside
// printable ASCII (the em dashes above) is normalized or dropped.
const pdfText = (s) =>
  s
    .replace(/[—–]/g, '-')
    .replace(/[\\()]/g, (c) => '\\' + c)
    .replace(/[^\x20-\x7e]/g, '');

function buildPdf(title, bodyLines) {
  const ops = ['BT', '/F1 16 Tf', '72 714 Td', `(${pdfText(title)}) Tj`, '/F1 11 Tf', '0 -30 Td'];
  bodyLines.forEach((line, i) => {
    if (i > 0) ops.push('0 -16 Td');
    ops.push(`(${pdfText(line)}) Tj`);
  });
  ops.push('ET');
  const stream = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export function testDocumentContent(docToken) {
  const doc = TEST_DOCUMENTS.find((d) => d.docToken === docToken);
  if (!doc) throw new Error('Unknown test document.');
  const bytes = buildPdf(doc.title, [
    "Hustler's University",
    `Student: ${TEST_STUDENT.name} (ID ${TEST_STUDENT.permId})`,
    `Category: ${doc.category}`,
    `Issued: ${doc.uploadDate}`,
    '',
    'This is a generated sample document for the Grademax test account.',
    'It is not a real school record.',
  ]);
  const fileName = `${doc.title.replace(/[—–]/g, '-').replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`;
  return { bytes, mimeType: 'application/pdf', fileName };
}

export function testMailAttachmentContent(token) {
  for (const message of TEST_MAIL) {
    const attachment = message.attachments.find((a) => a.token === token);
    if (!attachment) continue;
    const bytes = buildPdf(attachment.name.replace(/\.pdf$/i, ''), [
      "Hustler's University",
      `Attached to: ${message.subject}`,
      `From: ${message.sender.name}`,
      `Sent: ${message.date}`,
      '',
      'This is a generated sample attachment for the Grademax test account.',
      'It is not a real school document.',
    ]);
    return { bytes, mimeType: 'application/pdf', fileName: attachment.name };
  }
  throw new Error('Unknown test attachment.');
}
