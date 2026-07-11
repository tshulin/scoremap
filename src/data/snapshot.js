// StudentVUE snapshot — the last-synced view of the student's gradebook.
//
// This is the shape the StudentVUE sync layer produces. The values seed the app
// from the design references so the recreated screens render identically; a live
// StudentVUE client (src/data/studentvue.js) would populate the same structure
// from the district endpoint instead of this literal.

// A class id is a stable slug used in the /grades/:classId route.
const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const rawClasses = [
  { name: 'Integrated Marketing Comm', period: 'Period 1', room: 'A-4', teacher: 'Tami Raaker', grade: 'A+', pct: 98.3, isNew: 0 },
  { name: 'AP Computer Science A', period: 'Period 2', room: 'K-203', teacher: 'Shannon Sos', grade: 'A+', pct: 101.92, isNew: 1 },
  { name: 'Hon Pre-Calculus', period: 'Period 3', room: 'B-17', teacher: 'Oksana Mozgina', grade: 'A+', pct: 100.03, isNew: 27 },
  { name: 'AP World History', period: 'Period 4', room: 'I-1', teacher: 'Stephen Ferrel', grade: 'A', pct: 95.9, isNew: 22 },
  { name: 'Sophomore English', period: 'Period 5', room: 'B-2', teacher: 'Matthew Beach', grade: 'A+', pct: 98, isNew: 48 },
  { name: 'Chemistry', period: 'Period 6', room: 'J-9', teacher: 'Christopher Jones', grade: 'A', pct: 96.2, isNew: 26 },
];

export const classes = rawClasses.map((c) => ({ id: slug(c.name), ...c }));

// Per-class assignment lists (title, type, scaled?, date, delta, score, %).
// Only Integrated Marketing Comm has a detailed breakdown in the references;
// `__default` backs any class the sync layer hasn't pulled assignments for yet.
const imcAssignments = [
  { title: 'Etiquette Unit', type: 'Assignments', date: '5/22/26', delta: '+0%', score: '25/25', pct: 100 },
  { title: 'Career Research Worksheet', type: 'Assignments', date: '5/20/26', delta: '+0%', score: '10/10', pct: 100 },
  { title: 'Marketing in the Global Economy Presentations', type: 'Assignments', date: '5/18/26', delta: '+0%', score: '25/25', pct: 100 },
  { title: 'Final Exam', type: 'Assessments', scaled: true, date: '5/16/26', delta: '-1.61%', negative: true, scaledScore: '(89/100)', score: '178/200', pct: 89 },
  { title: 'ROP End of the Year Survey', type: 'Assignments', date: '5/12/26', delta: '+0%', score: '10/10', pct: 100 },
];

export const assignmentsByClass = {
  __default: imcAssignments,
  [slug('Integrated Marketing Comm')]: imcAssignments,
};

// Per-class grade history (date → grade) for the class-detail chart.
const imcHistory = {
  dates: ['1/11', '1/18', '1/25', '2/1', '2/8', '2/15', '2/22', '3/1', '3/8', '3/15', '3/22', '3/29', '4/5', '4/12', '4/19', '4/26', '5/3', '5/10', '5/17'],
  values: [100, 100, 100, 100, 100, 100, 99.0, 99.2, 99.35, 99.4, 99.5, 99.6, 99.6, 99.7, 99.75, 99.82, 99.85, 99.85, 98.3],
};

export const historyByClass = {
  __default: imcHistory,
  [slug('Integrated Marketing Comm')]: imcHistory,
};

// Auth/session — who is signed in and against which StudentVUE domain.
export const session = {
  studentName: 'Shalin R. Madabhavi',
  username: '',
  domain: '',
  agreed: false,
  semester: 'Semester 2',
  lastUpdated: 'last month',
};

export const snapshot = { classes, assignmentsByClass, historyByClass, session };

export default snapshot;
