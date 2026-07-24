// StudentVUE sync layer — pulls everything the app shows from the in-browser
// portal client (src/data/api.js, which scrapes the PXP2 portal over the blind
// relay) and maps its domain shapes to the page shapes.
//
// One sync = student info + gradebook + attendance + documents, in parallel.
// A resource that fails does not sink the others: its section stays empty and
// `meta.<resource>.message` says why. A 401 anywhere aborts the sync so the
// provider can sign the user out.
import * as api from './api.js';
import { DEMO, DEMO_STUDENT } from './demo.js';
import { emptySnapshot } from './snapshot.js';
import { harvestFromClasses } from './gradeIndexStore.js';
import { SAMPLE_ATTENDANCE, SAMPLE_GRADEBOOK } from './placeholders.js';
import { GradebookSchema } from '../domain/index';

const slug = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const round = (n, places) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

const fmtNum = (n) => String(Number.isInteger(n) ? n : round(n, 2));

// ---- gradebook → classes + assignment lists ----

// A course's current mark is its most recent one.
const currentMark = (course) => course.marks[course.marks.length - 1];

function mapAssignment(a) {
  const scaled = !!a.unscaledPoints;
  const graded = a.pointsEarned !== undefined;
  const pct =
    graded && a.pointsPossible !== undefined && a.pointsPossible > 0
      ? round((a.pointsEarned / a.pointsPossible) * 100, 1)
      : null;

  // Scaled scores show the raw points big and the scaled (grade-calc) points in
  // parens, like the portal: 178/200 (89/100).
  const score = a.extraCredit
    ? `+${graded ? fmtNum(a.pointsEarned) : '?'}`
    : scaled
      ? `${fmtNum(a.unscaledPoints.pointsEarned)}/${fmtNum(a.unscaledPoints.pointsPossible)}`
      : `${graded ? fmtNum(a.pointsEarned) : '—'}/${a.pointsPossible !== undefined ? fmtNum(a.pointsPossible) : '—'}`;

  return {
    title: a.name,
    type: a.category || 'Uncategorized',
    date: shortDate(a.date),
    isoDate: a.date,
    scaled,
    scaledScore: scaled ? `(${fmtNum(a.pointsEarned)}/${fmtNum(a.pointsPossible)})` : undefined,
    score,
    pct,
    extraCredit: a.extraCredit,
    notForGrade: a.notForGrade,
    // The untouched domain assignment — src/calc/ computes over this.
    raw: a,
  };
}

function mapGradebook(rawGradebook) {
  // The same schema the backend validates against, re-checked in the browser
  // so shape drift fails loudly instead of rendering nonsense.
  const gradebook = GradebookSchema.parse(rawGradebook);

  const classes = [];
  const assignmentsByClass = {};
  const used = new Set();

  for (const course of gradebook.courses) {
    const name = course.title || course.name;
    let id = slug(name) || slug(course.courseId) || `course-${classes.length}`;
    while (used.has(id)) id = `${id}-p${slug(course.period) || used.size}`;
    used.add(id);

    const mark = currentMark(course);
    const graded = !!(mark && mark.letter);
    classes.push({
      id,
      name,
      period: /^\s*period/i.test(course.period) ? course.period : `Period ${course.period}`,
      periodNum: course.period.replace(/[^0-9]/g, ''),
      room: course.room,
      teacher: course.staff.name,
      grade: graded ? mark.letter : '—',
      pct: graded ? round(mark.percentage, 2) : null,
      isNew: 0,
      // Weighted-category config for src/calc/; undefined = straight points.
      categories:
        mark && mark.categories && mark.categories.length > 0 ? mark.categories : undefined,
    });
    assignmentsByClass[id] = (mark ? mark.assignments : []).map(mapAssignment);
  }

  const period = gradebook.reportingPeriods.find(
    (p) => p.index === gradebook.currentPeriodIndex,
  );
  return { classes, assignmentsByClass, semester: period ? period.name : '' };
}

// ---- attendance → calendar/list records ----

const STATUS_PRIORITY = { excused: 0, activity: 1, tardy: 2, unexcused: 3 };

function classifyReason(reason) {
  const r = (reason || '').toLowerCase();
  if (!r) return null;
  if (r.includes('tardy')) return 'tardy';
  if (r.includes('unexcused') || r.includes('unverified') || r.includes('truan')) return 'unexcused';
  if (r.includes('field trip') || r.includes('activity') || r.includes('school business')) return 'activity';
  return 'excused';
}

function mapAbsence(a) {
  const periods = (a.periods || []).map((p) => ({
    period: p.period,
    reason: p.reason || a.reason || '',
    note: p.note || '',
  }));
  // Day status = the worst thing that happened that day.
  const statuses = [classifyReason(a.reason), ...periods.map((p) => classifyReason(p.reason))]
    .filter(Boolean);
  const status = statuses.length
    ? statuses.reduce((worst, s) => (STATUS_PRIORITY[s] > STATUS_PRIORITY[worst] ? s : worst))
    : 'excused';
  return { date: a.date, status, note: a.note || '', reason: a.reason || '', periods };
}

// ---- demo snapshot (VITE_DEMO) ----
// Built through the exact same mappings real data takes, so every feature works
// identically in demo — the only difference is where the Gradebook came from.

function demoSnapshot() {
  const mapped = mapGradebook(SAMPLE_GRADEBOOK);
  return {
    ...emptySnapshot,
    classes: mapped.classes,
    assignmentsByClass: mapped.assignmentsByClass,
    attendance: {
      schoolName: SAMPLE_ATTENDANCE.schoolName,
      records: SAMPLE_ATTENDANCE.absences.map(mapAbsence),
      unreadableAbsences: SAMPLE_ATTENDANCE.unreadableAbsences,
    },
    documents: [],
    session: {
      ...emptySnapshot.session,
      studentName: DEMO_STUDENT.name,
      grade: DEMO_STUDENT.grade,
      semester: mapped.semester,
      lastUpdated: new Date(),
      demo: true,
    },
    meta: {
      gradebook: { ok: true, placeholder: true, message: 'Demo mode — sample data.' },
      attendance: { ok: true, placeholder: true, message: '' },
      documents: { ok: true, message: '' },
    },
  };
}

// ---- the sync ----

const friendlyGradebookMessage = (error) => {
  if (error.code === 'NO_ACTIVE_GRADING_PERIOD')
    return 'No active grading period — grades will appear when the term starts.';
  if (error.code === 'PARSE_FAILED')
    return 'Grades are not readable yet — live gradebook support is still being finished.';
  return error.message;
};

export async function sync(knownStudent) {
  if (DEMO) {
    const snapshot = demoSnapshot();
    harvestFromClasses(snapshot.classes);
    return snapshot;
  }
  const [student, gradebook, attendance, documents] = await Promise.allSettled([
    api.getStudent(),
    api.getGradebook(),
    api.getAttendance(),
    api.getDocuments(),
  ]);

  for (const r of [student, gradebook, attendance, documents]) {
    if (r.status === 'rejected' && r.reason && r.reason.status === 401) throw r.reason;
  }

  const data = {
    ...emptySnapshot,
    meta: { ...emptySnapshot.meta },
    session: { ...emptySnapshot.session, lastUpdated: new Date() },
  };

  const info = student.status === 'fulfilled' ? student.value : knownStudent;
  if (info) data.session = { ...data.session, studentName: info.name, grade: info.grade };

  if (gradebook.status === 'fulfilled') {
    const mapped = mapGradebook(gradebook.value.gradebook);
    data.classes = mapped.classes;
    data.assignmentsByClass = mapped.assignmentsByClass;
    data.session.semester = mapped.semester;
    // Every sync teaches the per-class grade index a little more — the
    // portal's letters are the only honest source of each teacher's scale.
    harvestFromClasses(mapped.classes);
    data.meta.gradebook = {
      ok: true,
      placeholder: gradebook.value.placeholder,
      message: gradebook.value.placeholder
        ? 'Sample gradebook — the portal has no active grading period yet.'
        : '',
    };
  } else {
    data.meta.gradebook = {
      ok: false,
      placeholder: false,
      message: friendlyGradebookMessage(gradebook.reason),
    };
  }

  if (attendance.status === 'fulfilled') {
    const att = attendance.value.attendance;
    data.attendance = {
      schoolName: att.schoolName,
      records: att.absences.map(mapAbsence),
      unreadableAbsences: att.unreadableAbsences,
    };
    data.meta.attendance = { ok: true, placeholder: attendance.value.placeholder, message: '' };
  } else {
    data.meta.attendance = { ok: false, placeholder: false, message: attendance.reason.message };
  }

  if (documents.status === 'fulfilled') {
    data.documents = documents.value.map((d) => ({
      id: d.docToken,
      docToken: d.docToken,
      title: d.title,
      category: d.category,
      date: d.uploadDate,
    }));
    data.meta.documents = { ok: true, message: '' };
  } else {
    data.meta.documents = { ok: false, message: documents.reason.message };
  }

  return data;
}

export default { sync };
