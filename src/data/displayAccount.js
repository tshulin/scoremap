// Built-in display account - sign in with username "display" / password
// "display" at the "Hustler's University" district to get the student whose
// pages are photographed for the landing page.
//
// Where the test account exists to exercise every UI state (all four grade
// bands, missing work, failures), this one exists to look good in a
// screenshot: a six-course junior with As and Bs plus one C (so the shots
// show all three grade colors), a realistic amount of graded work in every
// class, and - unlike the test account - none of the "sample data" chrome
// (its snapshot carries no demo/placeholder flags, see studentvue.js
// displaySnapshot). Login/sync short-circuit exactly like the test account
// (api.js).
//
// Mail and documents are the display account's own. Every sender and
// document here is invented for this fictional school - nothing is carried
// over from the test mailbox (whose contents mirror a real district's design
// mock), so screenshots can't correlate with any real person.
//
// Every mark percentage is derivable from its assignments: the display test
// re-computes them through src/calc and fails on drift, same as the test
// account's suite.
import { GradebookSchema, AttendanceSchema, DocumentMetaSchema, MailMessageSchema } from '../domain/index';
import { TEST_DISTRICT, buildPdf } from './testAccount.js';

export const DISPLAY_USERNAME = 'display';
export const DISPLAY_PASSWORD = 'display';

export const DISPLAY_STUDENT = {
  name: 'Jordan Avery',
  permId: 'DISP-0001',
  gender: '',
  grade: '11',
};

// Same district gate as the test account: "display" could be someone's real
// username elsewhere, so the account only exists at the fake district.
export function isDisplayCredentials({ domain, username, password }) {
  return (
    (domain || '').toLowerCase() === TEST_DISTRICT.domain &&
    (username || '').trim().toLowerCase() === DISPLAY_USERNAME &&
    password === DISPLAY_PASSWORD
  );
}

const teacher = (name, email) => ({ name, email });

// A (95.5), weighted. Homework hits 100% via a +2 extra-credit row (78 earned
// of 80 possible, EC adds earned only). 0.2×100 + 0.3×95 + 0.5×94 = 95.5.
const CALCULUS = {
  courseId: 'DISP-1',
  name: 'AP Calculus AB',
  title: 'AP Calculus AB',
  period: '1',
  room: 'B-204',
  staff: teacher('R. Okafor', 'rokafor@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'A',
      percentage: 95.5,
      categories: [
        { name: 'Homework', weightPercentage: 20, pointsEarned: 80, pointsPossible: 80, weightedPercentage: 20, letter: 'A+' },
        { name: 'Quizzes', weightPercentage: 30, pointsEarned: 76, pointsPossible: 80, weightedPercentage: 28.5, letter: 'A' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 282, pointsPossible: 300, weightedPercentage: 47, letter: 'A' },
      ],
      assignments: [
        { id: 'DISP-1-1', name: 'Syllabus Signature', pointsEarned: 5, pointsPossible: 5, extraCredit: false, notForGrade: true, category: 'Homework', date: '2026-08-13', comments: '(Not For Grading)' },
        { id: 'DISP-1-2', name: 'HW 1.1 Limits Graphically', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-17' },
        { id: 'DISP-1-3', name: 'HW 1.2 Limit Laws', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-20' },
        { id: 'DISP-1-4', name: 'Quiz: Limits', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-08-24' },
        { id: 'DISP-1-5', name: 'HW 1.3 Continuity', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-26' },
        { id: 'DISP-1-6', name: 'Unit 1 Test: Limits & Continuity', pointsEarned: 94, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-08-28' },
        { id: 'DISP-1-7', name: 'HW 2.1 Definition of the Derivative', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-01' },
        { id: 'DISP-1-8', name: 'Quiz: Derivative Rules', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-09-03' },
        { id: 'DISP-1-9', name: 'HW 2.2 Product & Quotient Rules', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-09' },
        { id: 'DISP-1-10', name: 'Unit 2 Test: Derivatives', pointsEarned: 93, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-11' },
        { id: 'DISP-1-11', name: 'HW 2.3 Chain Rule', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-16' },
        { id: 'DISP-1-12', name: 'Derivative Challenge Problem', pointsEarned: 2, pointsPossible: 2, extraCredit: true, notForGrade: false, category: 'Homework', date: '2026-09-18' },
        { id: 'DISP-1-13', name: 'Quiz: Implicit Differentiation', pointsEarned: 20, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-09-21' },
        { id: 'DISP-1-14', name: 'HW 3.1 Related Rates', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-24' },
        { id: 'DISP-1-15', name: 'Quiz: Applications of Derivatives', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, category: 'Quizzes', date: '2026-10-01' },
        { id: 'DISP-1-16', name: 'HW 3.2 Optimization', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-06' },
        { id: 'DISP-1-17', name: 'Unit 3 Test: Applications', pointsEarned: 95, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-09' },
        { id: 'DISP-1-18', name: 'Unit 4 Test: Integration', pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-15', dueDate: '2026-10-15' },
      ],
    },
  ],
};

// A (92), unweighted straight points: 460/500.
const ENGLISH = {
  courseId: 'DISP-2',
  name: 'AP English Language',
  title: 'AP English Language',
  period: '2',
  room: 'L-117',
  staff: teacher('S. Marchetti', 'smarchetti@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'A',
      percentage: 92,
      assignments: [
        { id: 'DISP-2-1', name: 'Vocab Quiz 1', pointsEarned: 18, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-08-19' },
        { id: 'DISP-2-2', name: 'Reading Response 1', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-21' },
        { id: 'DISP-2-3', name: 'Rhetorical Analysis Draft', pointsEarned: 46, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-08-31', description: 'First full draft, graded on completeness.' },
        { id: 'DISP-2-4', name: 'Vocab Quiz 2', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-02' },
        { id: 'DISP-2-5', name: 'Reading Response 2', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-08' },
        { id: 'DISP-2-6', name: 'Rhetorical Analysis Essay', pointsEarned: 91, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-09-14' },
        { id: 'DISP-2-7', name: 'Socratic Seminar: The Great Gatsby', pointsEarned: 28, pointsPossible: 30, extraCredit: false, notForGrade: false, date: '2026-09-17' },
        { id: 'DISP-2-8', name: 'Vocab Quiz 3', pointsEarned: 17, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-23' },
        { id: 'DISP-2-9', name: 'Reading Response 3', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-28' },
        { id: 'DISP-2-10', name: 'Op-Ed Annotation', pointsEarned: 27, pointsPossible: 30, extraCredit: false, notForGrade: false, date: '2026-10-01' },
        { id: 'DISP-2-11', name: 'Reading Response 4', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-05' },
        { id: 'DISP-2-12', name: 'Midterm Exam', pointsEarned: 93, pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-10-07' },
        { id: 'DISP-2-13', name: 'Argument Presentation', pointsEarned: 47, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-10-09' },
        { id: 'DISP-2-14', name: 'Reading Response 5', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-12' },
        { id: 'DISP-2-15', name: 'Vocab Quiz 4', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-10-13' },
        { id: 'DISP-2-16', name: 'Reading Response 6', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-14' },
        { id: 'DISP-2-17', name: 'Research Argument Essay', pointsPossible: 100, extraCredit: false, notForGrade: false, date: '2026-10-15', dueDate: '2026-10-20', resources: [{ name: 'Essay rubric.pdf', type: 'File' }] },
      ],
    },
  ],
};

// B (87.15), weighted. 0.25×90 + 0.3×85 + 0.45×87 = 87.15.
//
// Deliberately the dramatic chart of the seven: a perfect start, a bombed
// first LEQ (72%) that craters the running grade to ~80, a 96% DBQ that
// soars it above 90, a rough Unit 2 exam (72%) that plunges it back to the
// mid-80s, a sagging stretch, and a 95% final exam comeback to a solid B.
const HISTORY = {
  courseId: 'DISP-3',
  name: 'AP US History',
  title: 'AP US History',
  period: '3',
  room: 'H-121',
  staff: teacher('L. Thibodeau', 'lthibodeau@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'B',
      percentage: 87.15,
      categories: [
        { name: 'Classwork', weightPercentage: 25, pointsEarned: 90, pointsPossible: 100, weightedPercentage: 22.5, letter: 'A-' },
        { name: 'Essays', weightPercentage: 30, pointsEarned: 170, pointsPossible: 200, weightedPercentage: 25.5, letter: 'B' },
        { name: 'Exams', weightPercentage: 45, pointsEarned: 261, pointsPossible: 300, weightedPercentage: 39.15, letter: 'B+' },
      ],
      assignments: [
        { id: 'DISP-3-1', name: 'Colonial Regions Chart', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-08-14' },
        { id: 'DISP-3-2', name: 'Primary Source: Mayflower Compact', pointsEarned: 7, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-08-18' },
        { id: 'DISP-3-3', name: 'Reading Quiz: Ch 2', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-08-21' },
        { id: 'DISP-3-4', name: 'LEQ: Colonial Society', pointsEarned: 36, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Essays', date: '2026-08-25', comments: 'Thesis and evidence need work - see rubric feedback.' },
        { id: 'DISP-3-5', name: 'Reading Quiz: Ch 4', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-08-27' },
        { id: 'DISP-3-6', name: 'Unit 1 Exam: Colonial America', pointsEarned: 94, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Exams', date: '2026-09-01' },
        { id: 'DISP-3-7', name: 'Revolution Timeline', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-09-03' },
        { id: 'DISP-3-8', name: 'DBQ: American Revolution', pointsEarned: 48, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Essays', date: '2026-09-08', comments: 'Excellent document use - big improvement.' },
        { id: 'DISP-3-9', name: 'Primary Source: Common Sense', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-09-10' },
        { id: 'DISP-3-10', name: 'Unit 2 Exam: A New Nation', pointsEarned: 72, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Exams', date: '2026-09-15' },
        { id: 'DISP-3-11', name: 'Constitution Stations', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-09-17' },
        { id: 'DISP-3-12', name: 'LEQ: Jacksonian Democracy', pointsEarned: 39, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Essays', date: '2026-09-22' },
        { id: 'DISP-3-13', name: 'Reading Quiz: Ch 7', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-09-24' },
        { id: 'DISP-3-14', name: 'Territorial Expansion Map', pointsEarned: 6, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-09-29' },
        { id: 'DISP-3-15', name: 'DBQ: Reform Movements', pointsEarned: 47, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Essays', date: '2026-10-02' },
        { id: 'DISP-3-16', name: 'Reading Quiz: Ch 9', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Classwork', date: '2026-10-08' },
        { id: 'DISP-3-17', name: 'Unit 3 Exam: Expansion & Reform', pointsEarned: 95, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Exams', date: '2026-10-13' },
        { id: 'DISP-3-18', name: 'DBQ Practice: Gilded Age', pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Essays', date: '2026-10-15', dueDate: '2026-10-16' },
      ],
    },
  ],
};

// C (75.6), weighted - the red band on the dashboard (C and below render
// red, see src/lib/grades.js). 0.3×82 + 0.2×75 + 0.5×72 = 75.6.
const CHEMISTRY = {
  courseId: 'DISP-4',
  name: 'Chemistry Honors',
  title: 'Chemistry Honors',
  period: '4',
  room: 'S-209',
  staff: teacher('E. Brandt', 'ebrandt@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'C',
      percentage: 75.6,
      categories: [
        { name: 'Labs', weightPercentage: 30, pointsEarned: 123, pointsPossible: 150, weightedPercentage: 24.6, letter: 'B-' },
        { name: 'Homework', weightPercentage: 20, pointsEarned: 45, pointsPossible: 60, weightedPercentage: 15, letter: 'C' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 216, pointsPossible: 300, weightedPercentage: 36, letter: 'C-' },
      ],
      assignments: [
        { id: 'DISP-4-1', name: 'Lab Safety Contract', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: true, category: 'Labs', date: '2026-08-14', comments: '(Not For Grading)' },
        { id: 'DISP-4-2', name: 'HW: Measurement & Sig Figs', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-18' },
        { id: 'DISP-4-3', name: 'Lab: Density of Solids', pointsEarned: 25, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-08-20' },
        { id: 'DISP-4-4', name: 'HW: Dimensional Analysis', pointsEarned: 7, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-27' },
        { id: 'DISP-4-5', name: 'Test: Matter & Measurement', pointsEarned: 71, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-08-31' },
        { id: 'DISP-4-6', name: 'Lab: Separation of Mixtures', pointsEarned: 24, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-01' },
        { id: 'DISP-4-7', name: 'HW: Atomic Structure', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-08' },
        { id: 'DISP-4-8', name: 'Lab: Flame Tests', pointsEarned: 26, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-15' },
        { id: 'DISP-4-9', name: 'HW: Electron Configurations', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-17' },
        { id: 'DISP-4-10', name: 'Test: Atomic Theory', pointsEarned: 74, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-21' },
        { id: 'DISP-4-11', name: 'HW: Periodic Trends', pointsEarned: 6, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-25', comments: 'Turned in late.' },
        { id: 'DISP-4-12', name: 'Lab: Periodic Properties', pointsEarned: 23, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-09-29' },
        { id: 'DISP-4-13', name: 'HW: Lewis Structures', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-05' },
        { id: 'DISP-4-14', name: 'Lab: Ionic vs. Covalent', pointsEarned: 25, pointsPossible: 30, extraCredit: false, notForGrade: false, category: 'Labs', date: '2026-10-08' },
        { id: 'DISP-4-15', name: 'Test: Bonding', pointsEarned: 71, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-12' },
        { id: 'DISP-4-16', name: 'Quiz: The Mole Concept', pointsPossible: 25, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-15', dueDate: '2026-10-15' },
      ],
    },
  ],
};

// A (96), unweighted straight points: 336/350.
const SPANISH = {
  courseId: 'DISP-5',
  name: 'Spanish III',
  title: 'Spanish III',
  period: '5',
  room: 'W-306',
  staff: teacher('M. Arellano', 'marellano@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'A',
      percentage: 96,
      assignments: [
        { id: 'DISP-5-1', name: 'Tarea: Repaso del verano', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-17' },
        { id: 'DISP-5-2', name: 'Quiz: El pretérito', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-08-21' },
        { id: 'DISP-5-3', name: 'Tarea: El pretérito vs. el imperfecto', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-24' },
        { id: 'DISP-5-4', name: 'Tarea: Lectura y preguntas', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-08-31' },
        { id: 'DISP-5-5', name: 'Quiz: El imperfecto', pointsEarned: 20, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-04' },
        { id: 'DISP-5-6', name: 'Tarea: Vocabulario Unidad 2', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-08' },
        { id: 'DISP-5-7', name: 'Presentación oral: Mis vacaciones', pointsEarned: 24, pointsPossible: 25, extraCredit: false, notForGrade: false, date: '2026-09-11' },
        { id: 'DISP-5-8', name: 'Tarea: Práctica de conversación', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-14' },
        { id: 'DISP-5-9', name: 'Quiz: Vocabulario Unidad 2', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-09-18' },
        { id: 'DISP-5-10', name: 'Tarea: El subjuntivo (intro)', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-21' },
        { id: 'DISP-5-11', name: 'Examen: Unidad 2', pointsEarned: 46, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-09-25' },
        { id: 'DISP-5-12', name: 'Tarea: El subjuntivo (práctica)', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-09-28' },
        { id: 'DISP-5-13', name: 'Quiz: El subjuntivo', pointsEarned: 20, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-10-02' },
        { id: 'DISP-5-14', name: 'Tarea: Ensayo corto', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-05' },
        { id: 'DISP-5-15', name: 'Tarea: Lectura cultural', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-07' },
        { id: 'DISP-5-16', name: 'Presentación oral: Una noticia', pointsEarned: 23, pointsPossible: 25, extraCredit: false, notForGrade: false, date: '2026-10-09' },
        { id: 'DISP-5-17', name: 'Tarea: Repaso Unidad 3', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, date: '2026-10-12' },
        { id: 'DISP-5-18', name: 'Quiz: Vocabulario Unidad 3', pointsEarned: 19, pointsPossible: 20, extraCredit: false, notForGrade: false, date: '2026-10-13' },
        { id: 'DISP-5-19', name: 'Examen: Unidad 3', pointsEarned: 48, pointsPossible: 50, extraCredit: false, notForGrade: false, date: '2026-10-14' },
      ],
    },
  ],
};

// B (88.4), weighted. 0.4×91 + 0.1×90 + 0.5×86 = 88.4.
const COMPSCI = {
  courseId: 'DISP-6',
  name: 'AP Computer Science A',
  title: 'AP Computer Science A',
  period: '6',
  room: 'T-112',
  staff: teacher('P. Sandoval', 'psandoval@hustler.edu'),
  marks: [
    {
      name: 'Quarter 1',
      shortName: 'Q1',
      letter: 'B',
      percentage: 88.4,
      categories: [
        { name: 'Projects', weightPercentage: 40, pointsEarned: 182, pointsPossible: 200, weightedPercentage: 36.4, letter: 'A-' },
        { name: 'Homework', weightPercentage: 10, pointsEarned: 45, pointsPossible: 50, weightedPercentage: 9, letter: 'A-' },
        { name: 'Tests', weightPercentage: 50, pointsEarned: 258, pointsPossible: 300, weightedPercentage: 43, letter: 'B' },
      ],
      assignments: [
        { id: 'DISP-6-1', name: 'HW: Variables & Types', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-18' },
        { id: 'DISP-6-2', name: 'HW: Conditionals', pointsEarned: 10, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-08-25' },
        { id: 'DISP-6-3', name: 'Project: Number Guessing Game', pointsEarned: 46, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Projects', date: '2026-08-28' },
        { id: 'DISP-6-4', name: 'Test: Primitives & Control Flow', pointsEarned: 85, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-02' },
        { id: 'DISP-6-5', name: 'HW: Loops', pointsEarned: 8, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-09' },
        { id: 'DISP-6-6', name: 'Project: Caesar Cipher', pointsEarned: 44, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Projects', date: '2026-09-16' },
        { id: 'DISP-6-7', name: 'HW: Methods', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-09-22' },
        { id: 'DISP-6-8', name: 'Test: Strings & Methods', pointsEarned: 88, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-09-23' },
        { id: 'DISP-6-9', name: 'Project: Bank Account Class', pointsEarned: 47, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Projects', date: '2026-10-02' },
        { id: 'DISP-6-10', name: 'HW: Classes & Objects', pointsEarned: 9, pointsPossible: 10, extraCredit: false, notForGrade: false, category: 'Homework', date: '2026-10-06' },
        { id: 'DISP-6-11', name: 'Test: Classes & Objects', pointsEarned: 85, pointsPossible: 100, extraCredit: false, notForGrade: false, category: 'Tests', date: '2026-10-09' },
        { id: 'DISP-6-12', name: 'Project: Inventory Tracker', pointsEarned: 45, pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Projects', date: '2026-10-13' },
        { id: 'DISP-6-13', name: 'Project: Array Statistics', pointsPossible: 50, extraCredit: false, notForGrade: false, category: 'Projects', date: '2026-10-15', dueDate: '2026-10-20' },
      ],
    },
  ],
};

export const DISPLAY_GRADEBOOK = GradebookSchema.parse({
  reportingPeriods: [
    { index: 0, name: 'Quarter 1', startDate: '2026-08-12', endDate: '2026-10-16' },
    { index: 1, name: 'Quarter 2', startDate: '2026-10-19', endDate: '2026-12-18' },
    { index: 2, name: 'Quarter 3', startDate: '2027-01-06', endDate: '2027-03-12' },
    { index: 3, name: 'Quarter 4', startDate: '2027-03-15', endDate: '2027-05-28' },
  ],
  currentPeriodIndex: 0,
  courses: [CALCULUS, ENGLISH, HISTORY, CHEMISTRY, SPANISH, COMPSCI],
});

// Light and mostly excused - the display student is doing fine.
export const DISPLAY_ATTENDANCE = AttendanceSchema.parse({
  schoolName: "Hustler's University",
  absences: [
    { date: '2026-09-02', reason: 'Excused Absence', note: 'Medical appointment' },
    { date: '2026-09-18', periods: [{ period: '1', reason: 'Tardy', note: 'Bus delay' }] },
    { date: '2026-10-06', reason: 'Excused Absence', note: 'College visit' },
    { date: '2026-10-13', reason: 'Field Trip', note: 'Robotics competition' },
  ],
  unreadableAbsences: 0,
});

// Only the three categories the landing page wants to show: Report Card,
// Transcript, and MAP Growth (each has its own badge color on the page).
export const DISPLAY_DOCUMENTS = [
  { docToken: 'DISPDOC-01', title: 'Unofficial Transcript', category: 'Transcript', uploadDate: '2026-08-13' },
  { docToken: 'DISPDOC-02', title: 'Report Card: Q4 2025-2026', category: 'Report Card', uploadDate: '2026-06-04' },
  { docToken: 'DISPDOC-03', title: 'MAP Growth Family Report: Spring 2026', category: 'MAP Growth Family Report', uploadDate: '2026-05-11' },
  { docToken: 'DISPDOC-04', title: 'Report Card: Q3 2025-2026', category: 'Report Card', uploadDate: '2026-03-19' },
  { docToken: 'DISPDOC-05', title: 'Report Card: Q2 2025-2026', category: 'Report Card', uploadDate: '2025-12-18' },
  { docToken: 'DISPDOC-06', title: 'Report Card: Q1 2025-2026', category: 'Report Card', uploadDate: '2025-10-16' },
  { docToken: 'DISPDOC-07', title: 'MAP Growth Family Report: Fall 2025', category: 'MAP Growth Family Report', uploadDate: '2025-10-01' },
].map((d) => DocumentMetaSchema.parse(d));

// The display mailbox: routine school mail from the display world's own staff
// (the schedule's teachers plus an invented counselor and front office),
// dated inside the same quarter as the gradebook. Covers the states the list
// renders - links only, attachments only, both, and neither.
export const DISPLAY_MAIL = [
  {
    id: 'dm1',
    subject: 'Q1 Grades Close Friday - Missing Work Reminders',
    sender: { name: 'E. Brandt', role: 'Teacher', email: 'ebrandt@hustler.edu' },
    date: '2026-10-14',
    body: [
      'Chemistry students,',
      'Quarter 1 grades close this Friday. If you are missing a lab write-up or want to retake the Mole Concept quiz, come in at lunch or after school by Thursday - no late work can be accepted after grades post.',
      'Mrs. Brandt',
    ],
    links: [],
    attachments: [],
  },
  {
    id: 'dm2',
    subject: 'PSAT Results & Score Review Session',
    sender: { name: 'D. Whitmore', role: 'Counselor', email: 'dwhitmore@hustler.edu' },
    date: '2026-10-12',
    body: [
      'Juniors,',
      'PSAT results are now available in your College Board account. The counseling office is holding a score review session Thursday at lunch in room C-3 - bring your login and we will walk through your report and what it means for AP and SAT planning.',
      'Ms. Whitmore\nCounseling Office',
    ],
    links: [
      { label: 'College Board Sign-In', url: 'https://example.com/collegeboard' },
      { label: 'Session Sign-Up', url: 'https://example.com/psat-review-signup' },
    ],
    attachments: [],
  },
  {
    id: 'dm3',
    subject: 'Homecoming Week Schedule & Spirit Days',
    sender: { name: 'K. Ellison', role: 'Staff', email: 'kellison@hustler.edu' },
    date: '2026-10-08',
    body: [
      'Students and families,',
      'Homecoming week is October 12-16! The full schedule of spirit days, the rally, and Friday\'s game is attached. Tickets for Saturday\'s dance go on sale Monday at lunch and online.',
      'Front Office',
    ],
    links: [{ label: 'Buy Dance Tickets', url: 'https://example.com/homecoming-tickets' }],
    attachments: [{ token: 'DISPMAIL-ATT-01', name: 'Homecoming Week Schedule.pdf' }],
  },
  {
    id: 'dm4',
    subject: 'AP Exam Registration Now Open',
    sender: { name: 'D. Whitmore', role: 'Counselor', email: 'dwhitmore@hustler.edu' },
    date: '2026-10-02',
    body: [
      'AP students,',
      'Registration for May AP exams is open through November 6. Register through the portal below - the fall deadline matters, late registration adds a fee. The attached guide covers costs, fee waivers, and how to join your class sections on College Board.',
      'Ms. Whitmore\nCounseling Office',
    ],
    links: [
      { label: 'AP Registration Portal', url: 'https://example.com/ap-registration' },
      { label: 'Fee Waiver Information', url: 'https://example.com/ap-fee-waivers' },
    ],
    attachments: [{ token: 'DISPMAIL-ATT-02', name: 'AP Registration Guide.pdf' }],
  },
  {
    id: 'dm5',
    subject: 'Research Argument Essay - Rubric & Exemplars',
    sender: { name: 'S. Marchetti', role: 'Teacher', email: 'smarchetti@hustler.edu' },
    date: '2026-09-25',
    body: [
      'Hi everyone,',
      'As promised, the rubric for the Research Argument Essay is attached, along with two exemplar essays from previous years (shared with permission). Drafts are due October 15 - start gathering sources now.',
      'Mr. Marchetti',
    ],
    links: [],
    attachments: [
      { token: 'DISPMAIL-ATT-03', name: 'Research Essay Rubric.pdf' },
      { token: 'DISPMAIL-ATT-04', name: 'Exemplar Essays.pdf' },
    ],
  },
  {
    id: 'dm6',
    subject: 'Fall Club Fair This Thursday at Lunch',
    sender: { name: 'J. Paredes', role: 'Staff', email: 'jparedes@hustler.edu' },
    date: '2026-09-10',
    body: [
      'Hello students,',
      'The fall club fair is this Thursday at lunch in the main quad. Over 40 clubs will have tables - come find one (or start your own; the new-club application is linked below).',
      'Mr. Paredes\nStudent Activities',
    ],
    links: [{ label: 'New Club Application', url: 'https://example.com/new-club-application' }],
    attachments: [],
  },
  {
    id: 'dm7',
    subject: 'Back to School Night - Thursday, September 3',
    sender: { name: 'K. Ellison', role: 'Staff', email: 'kellison@hustler.edu' },
    date: '2026-08-28',
    body: [
      'Families,',
      'Back to School Night is Thursday, September 3 from 6:00-8:30 PM. Families follow their student\'s schedule in ten-minute periods; a campus map with room numbers is attached. Parking is available in the main and pool lots.',
      'Front Office',
    ],
    links: [{ label: 'RSVP', url: 'https://example.com/btsn-rsvp' }],
    attachments: [{ token: 'DISPMAIL-ATT-05', name: 'Campus Map.pdf' }],
  },
  {
    id: 'dm8',
    subject: 'Welcome to AP Calculus AB',
    sender: { name: 'R. Okafor', role: 'Teacher', email: 'rokafor@hustler.edu' },
    date: '2026-08-17',
    body: [
      'Welcome, mathematicians!',
      'I\'m looking forward to a great year. The syllabus is linked below - please have the signature page in by Friday. Bring your graphing calculator every day starting Monday.',
      'Dr. Okafor',
    ],
    links: [{ label: 'Course Syllabus', url: 'https://example.com/calc-ab-syllabus' }],
    attachments: [],
  },
].map((m) => MailMessageSchema.parse({ ...m, hasAttachments: m.attachments.length > 0 }));

// Sample-PDF generators, mirroring the test account's (same builder).

export function displayDocumentContent(docToken) {
  const doc = DISPLAY_DOCUMENTS.find((d) => d.docToken === docToken);
  if (!doc) throw new Error('Unknown display document.');
  const bytes = buildPdf(doc.title, [
    "Hustler's University",
    `Student: ${DISPLAY_STUDENT.name} (ID ${DISPLAY_STUDENT.permId})`,
    `Category: ${doc.category}`,
    `Issued: ${doc.uploadDate}`,
    '',
    'This is a generated sample document for the Scoremap display account.',
    'It is not a real school record.',
  ]);
  const fileName = `${doc.title.replace(/[–—]/g, '-').replace(/[^A-Za-z0-9-]+/g, '_')}.pdf`;
  return { bytes, mimeType: 'application/pdf', fileName };
}

export function displayMailAttachmentContent(token) {
  for (const message of DISPLAY_MAIL) {
    const attachment = message.attachments.find((a) => a.token === token);
    if (!attachment) continue;
    const bytes = buildPdf(attachment.name.replace(/\.pdf$/i, ''), [
      "Hustler's University",
      `Attached to: ${message.subject}`,
      `From: ${message.sender.name}`,
      `Sent: ${message.date}`,
      '',
      'This is a generated sample attachment for the Scoremap display account.',
      'It is not a real school document.',
    ]);
    return { bytes, mimeType: 'application/pdf', fileName: attachment.name };
  }
  throw new Error('Unknown display attachment.');
}
