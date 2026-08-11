// StudentVUE sync layer - pulls everything the app shows from the in-browser
// portal client (src/data/api.js, which scrapes the PXP2 portal over the blind
// relay) and maps its domain shapes to the page shapes.
//
// A sync fetches the resources in `scope`, in parallel, and merges them over the
// snapshot the app already has. A resource that fails does not sink the others:
// its section keeps its previous value and `meta.<resource>.message` says why. A
// 401 anywhere aborts the sync so the provider can sign the user out.
//
// SCOPE EXISTS TO SAVE REQUESTS. Every request the app makes is charged against
// the portal's per-IP budget, which a whole school shares behind one NAT address
// (see options.md). Refreshing the dashboard must therefore cost one request for
// the gradebook, not a fresh copy of the mailbox and the document list too.
import * as api from './api.js';
import { DEMO, DEMO_STUDENT } from './demo.js';
import { emptySnapshot } from './snapshot.js';
import { harvestFromClasses } from './gradeIndexStore.js';
import { SAMPLE_ATTENDANCE, SAMPLE_GRADEBOOK } from './placeholders.js';
import {
  TEST_STUDENT,
  TEST_GRADEBOOK,
  TEST_ATTENDANCE,
  TEST_DOCUMENTS,
  TEST_MAIL,
  TEST_USERNAME,
  TEST_DISTRICT,
} from './testAccount.js';
import {
  DISPLAY_STUDENT,
  DISPLAY_GRADEBOOK,
  DISPLAY_ATTENDANCE,
  DISPLAY_DOCUMENTS,
  DISPLAY_MAIL,
  DISPLAY_USERNAME,
} from './displayAccount.js';
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
      : `${graded ? fmtNum(a.pointsEarned) : 'N/A'}/${a.pointsPossible !== undefined ? fmtNum(a.pointsPossible) : 'N/A'}`;

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
    // The untouched domain assignment - src/calc/ computes over this.
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
      grade: graded ? mark.letter : 'N/A',
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
  return {
    classes,
    assignmentsByClass,
    semester: period ? period.name : '',
    semesters: gradebook.reportingPeriods.map((p) => p.name),
  };
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

// ---- mail → message list ----

// Flattens the sender for the pages (the shape Mail.jsx always rendered).
function mapMailMessage(m) {
  return {
    id: m.id,
    subject: m.subject,
    sender: m.sender.name,
    role: m.sender.role || '',
    email: m.sender.email || '',
    date: m.date,
    body: m.body,
    links: m.links,
    attachments: m.attachments,
    bodyLoaded: m.bodyLoaded,
    hasAttachments: m.hasAttachments || m.attachments.length > 0,
    isSystemMessage: m.isSystemMessage,
  };
}

// ---- demo snapshot (VITE_DEMO) ----
// Built through the exact same mappings real data takes, so every feature works
// identically in demo - the only difference is where the Gradebook came from.

// Demo-only: refreshes after the first nudge a few class percentages so the
// "changed since last refresh" UI has real deltas to show. Never runs for
// real portal data.
let demoSyncCount = 0;

function jitterDemoClasses(classes) {
  if (demoSyncCount++ === 0) return;
  for (const c of classes) {
    if (c.pct == null || Math.random() >= 0.6) continue;
    const delta = Math.round((Math.random() * 1.6 - 0.8) * 100) / 100;
    c.pct = Math.round((c.pct + delta) * 100) / 100;
  }
}

function demoSnapshot() {
  const mapped = mapGradebook(SAMPLE_GRADEBOOK);
  jitterDemoClasses(mapped.classes);
  return {
    ...emptySnapshot,
    classes: mapped.classes,
    assignmentsByClass: mapped.assignmentsByClass,
    semesters: mapped.semesters,
    attendance: {
      schoolName: SAMPLE_ATTENDANCE.schoolName,
      records: SAMPLE_ATTENDANCE.absences.map(mapAbsence),
      unreadableAbsences: SAMPLE_ATTENDANCE.unreadableAbsences,
    },
    documents: [],
    mail: { messages: TEST_MAIL.map(mapMailMessage), unreadableMessages: 0 },
    session: {
      ...emptySnapshot.session,
      studentName: DEMO_STUDENT.name,
      grade: DEMO_STUDENT.grade,
      semester: mapped.semester,
      lastUpdated: new Date(),
      demo: true,
    },
    meta: {
      gradebook: { ok: true, placeholder: true, message: 'Demo mode. Sample data.' },
      attendance: { ok: true, placeholder: true, message: '' },
      documents: { ok: true, message: '' },
      mail: { ok: true, placeholder: true, message: 'Demo mode. Sample messages.' },
    },
  };
}

// ---- test-account snapshot (username "test" / password "test") ----
// Same idea as the demo snapshot, but triggered by credentials at runtime -
// including production builds - so features can be exercised on the deployed
// site without a real StudentVUE account. Data flows through the exact same
// mappings real data takes.

function testSnapshot() {
  const mapped = mapGradebook(TEST_GRADEBOOK);
  return {
    ...emptySnapshot,
    classes: mapped.classes,
    assignmentsByClass: mapped.assignmentsByClass,
    semesters: mapped.semesters,
    attendance: {
      schoolName: TEST_ATTENDANCE.schoolName,
      records: TEST_ATTENDANCE.absences.map(mapAbsence),
      unreadableAbsences: TEST_ATTENDANCE.unreadableAbsences,
    },
    documents: TEST_DOCUMENTS.map((d) => ({
      id: d.docToken,
      docToken: d.docToken,
      title: d.title,
      category: d.category,
      date: d.uploadDate,
    })),
    mail: { messages: TEST_MAIL.map(mapMailMessage), unreadableMessages: 0 },
    session: {
      ...emptySnapshot.session,
      studentName: TEST_STUDENT.name,
      grade: TEST_STUDENT.grade,
      username: TEST_USERNAME,
      domain: TEST_DISTRICT.domain,
      semester: mapped.semester,
      lastUpdated: new Date(),
      demo: true,
    },
    meta: {
      gradebook: { ok: true, placeholder: true, message: 'Test account. Sample data.' },
      attendance: { ok: true, placeholder: true, message: '' },
      documents: { ok: true, message: '' },
      mail: { ok: true, placeholder: true, message: 'Test account. Sample messages.' },
    },
  };
}

// ---- display-account snapshot (username "display" / password "display") ----
// The landing page's screenshot subject AND the landing's "Try demo mode"
// target: a six-course student with a realistic gradebook and its own
// invented mailbox and document center (nothing shared with the test
// account's, whose contents mirror a real district's design mock). The
// session carries the demo flag so visitors see the "sample data" pill, but
// no placeholder meta - the per-page banners stay away. (For pill-free
// photography, strip `demo` below before capturing.)

function displaySnapshot() {
  const mapped = mapGradebook(DISPLAY_GRADEBOOK);
  return {
    ...emptySnapshot,
    classes: mapped.classes,
    assignmentsByClass: mapped.assignmentsByClass,
    semesters: mapped.semesters,
    attendance: {
      schoolName: DISPLAY_ATTENDANCE.schoolName,
      records: DISPLAY_ATTENDANCE.absences.map(mapAbsence),
      unreadableAbsences: DISPLAY_ATTENDANCE.unreadableAbsences,
    },
    documents: DISPLAY_DOCUMENTS.map((d) => ({
      id: d.docToken,
      docToken: d.docToken,
      title: d.title,
      category: d.category,
      date: d.uploadDate,
    })),
    mail: { messages: DISPLAY_MAIL.map(mapMailMessage), unreadableMessages: 0 },
    session: {
      ...emptySnapshot.session,
      studentName: DISPLAY_STUDENT.name,
      grade: DISPLAY_STUDENT.grade,
      username: DISPLAY_USERNAME,
      domain: TEST_DISTRICT.domain,
      semester: mapped.semester,
      lastUpdated: new Date(),
      demo: true,
    },
    meta: {
      gradebook: { ok: true, placeholder: false, message: '' },
      attendance: { ok: true, placeholder: false, message: '' },
      documents: { ok: true, message: '' },
      mail: { ok: true, placeholder: false, message: '' },
    },
  };
}

// ---- the sync ----

const friendlyGradebookMessage = (error) => {
  if (error.code === 'NO_ACTIVE_GRADING_PERIOD')
    return 'No active grading period. Grades will appear when the term starts.';
  if (error.code === 'PARSE_FAILED')
    return 'Grades are not readable yet. Live gradebook support is still being finished.';
  return error.message;
};

const friendlyMailMessage = (error) => {
  if (error.code === 'PARSE_FAILED')
    return 'Messages are not readable yet. Live mail support is still being finished.';
  return error.message;
};

// The resources a sync can fetch. A page refreshes the one it displays; the
// initial sign-in sync takes them all.
export const ALL_RESOURCES = ['gradebook', 'attendance', 'documents', 'mail'];

const FETCHERS = {
  gradebook: () => api.getGradebook(),
  attendance: () => api.getAttendance(),
  documents: () => api.getDocuments(),
  mail: () => api.getMail(),
};

// Who is signed in, without asking the portal if we can avoid it. Sign-in
// already fetched the student to show the name, a reload finds it mirrored in
// sessionStorage, and a scoped refresh still holds the previous snapshot - so in
// the steady state this costs zero requests. Only a session that somehow knows
// no name falls through to the portal.
function knownIdentity(knownStudent, previous) {
  if (knownStudent && knownStudent.name) return knownStudent;
  const remembered = api.recallStudent();
  if (remembered && remembered.name) return remembered;
  const session = previous && previous.session;
  if (session && session.studentName) return { name: session.studentName, grade: session.grade };
  return null;
}

export async function sync(knownStudent, { scope = ALL_RESOURCES, previous = null } = {}) {
  if (DEMO) {
    const snapshot = demoSnapshot();
    harvestFromClasses(snapshot.classes);
    return snapshot;
  }
  if (api.isTestSession()) {
    const snapshot = api.builtinAccount() === 'display' ? displaySnapshot() : testSnapshot();
    harvestFromClasses(snapshot.classes);
    return snapshot;
  }

  const base = previous || emptySnapshot;
  const identity = knownIdentity(knownStudent, base);

  // Only the requested resources are fetched, plus student info if - and only
  // if - nobody knows the name yet.
  const jobs = scope.filter((name) => FETCHERS[name]).map((name) => [name, FETCHERS[name]()]);
  if (!identity) jobs.unshift(['student', api.getStudent()]);

  const settled = await Promise.allSettled(jobs.map(([, promise]) => promise));
  const results = {};
  jobs.forEach(([name], i) => {
    results[name] = settled[i];
  });

  for (const r of settled) {
    if (r.status === 'rejected' && r.reason && r.reason.status === 401) throw r.reason;
  }

  // Merged over the previous snapshot, not rebuilt from empty: a scoped refresh
  // must leave the sections it did not fetch exactly as they were.
  const data = {
    ...base,
    meta: { ...base.meta },
    session: { ...base.session, lastUpdated: new Date() },
  };

  // A sync that loses only the student-info request must not blank the name out
  // of the chrome - the app already knows who is signed in, and after a reload
  // there is no caller to pass it back in.
  const student = results.student;
  const info = student && student.status === 'fulfilled' ? student.value : identity;
  if (info) {
    data.session = { ...data.session, studentName: info.name, grade: info.grade };
    api.rememberStudent(info);
  }

  // The account behind the data, for the chrome and for prefilling the login
  // form if the saved sign-in ever stops working.
  const creds = api.recallCredentials();
  if (creds) data.session = { ...data.session, username: creds.username, domain: creds.domain };

  const { gradebook, attendance, documents, mail } = results;

  if (gradebook && gradebook.status === 'fulfilled') {
    const mapped = mapGradebook(gradebook.value.gradebook);
    data.classes = mapped.classes;
    data.assignmentsByClass = mapped.assignmentsByClass;
    data.semesters = mapped.semesters;
    data.session.semester = mapped.semester;
    // Every sync teaches the per-class grade index a little more - the
    // portal's letters are the only honest source of each teacher's scale.
    harvestFromClasses(mapped.classes);
    data.meta.gradebook = {
      ok: true,
      placeholder: gradebook.value.placeholder,
      message: gradebook.value.placeholder
        ? 'Sample gradebook. The portal has no active grading period yet.'
        : '',
    };
  } else if (gradebook) {
    data.meta.gradebook = {
      ok: false,
      placeholder: false,
      message: friendlyGradebookMessage(gradebook.reason),
    };
  }

  if (attendance && attendance.status === 'fulfilled') {
    const att = attendance.value.attendance;
    data.attendance = {
      schoolName: att.schoolName,
      records: att.absences.map(mapAbsence),
      unreadableAbsences: att.unreadableAbsences,
    };
    data.meta.attendance = { ok: true, placeholder: attendance.value.placeholder, message: '' };
  } else if (attendance) {
    data.meta.attendance = { ok: false, placeholder: false, message: attendance.reason.message };
  }

  if (documents && documents.status === 'fulfilled') {
    data.documents = documents.value.map((d) => ({
      id: d.docToken,
      docToken: d.docToken,
      title: d.title,
      category: d.category,
      date: d.uploadDate,
    }));
    data.meta.documents = { ok: true, message: '' };
  } else if (documents) {
    data.meta.documents = { ok: false, message: documents.reason.message };
  }

  if (mail && mail.status === 'fulfilled') {
    data.mail = {
      messages: mail.value.messages.map(mapMailMessage),
      unreadableMessages: mail.value.unreadableMessages,
    };
    data.meta.mail = { ok: true, placeholder: false, message: '' };
  } else if (mail) {
    data.meta.mail = { ok: false, placeholder: false, message: friendlyMailMessage(mail.reason) };
  }

  return data;
}

export default { sync };
