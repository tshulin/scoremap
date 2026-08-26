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
// (see scripts/plans/options.md). Refreshing the dashboard must therefore cost one request for
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
    bodyHtml: m.bodyHtml || '',
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
    return 'The gradebook page did not look the way Scoremap expects. Try a refresh.';
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

// The sync-pill stages, in the order the student cares about them. The
// current stage is the FIRST of these still pending, so "Loading grades"
// gives way to "Loading assignments" the moment the gradebook landing page
// paints - even while attendance and mail are still in flight on the other
// relay's lane.
const STAGE_ORDER = ['grades', 'assignments', 'attendance', 'documents', 'mail'];
const RESOURCE_STAGES = {
  gradebook: ['grades', 'assignments'],
  attendance: ['attendance'],
  documents: ['documents'],
  mail: ['mail'],
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

// Progressive sync. `onUpdate` (optional) receives a freshly-copied merged
// snapshot every time something usable lands: the gradebook landing page
// first (every class with its grade - one emission, all classes together),
// then the completed gradebook (every assignment at once), then each
// background resource - so the app paints grades seconds before the sync
// completes without grades ever popping in class by class. `onStage`
// (optional) hears the current STAGE_ORDER stage (null when done).
// `onGrades` (optional) fires exactly once, the moment grades are on screen -
// the sign-in flow uses it to enter the app right then. The returned promise
// still resolves with the final snapshot exactly as before; a caller passing
// no callbacks gets the old all-at-once behavior.
export async function sync(
  knownStudent,
  { scope = ALL_RESOURCES, previous = null, onUpdate, onStage, onGrades } = {},
) {
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

  // The working snapshot. Merged over the previous one, not rebuilt from
  // empty: a scoped refresh must leave the sections it did not fetch exactly
  // as they were. Mutated in place as resources land; every emission hands
  // out fresh top-level copies so React sees a new object.
  const data = {
    ...base,
    meta: { ...base.meta },
    session: { ...base.session, lastUpdated: new Date() },
  };

  const pending = new Set(scope.flatMap((name) => RESOURCE_STAGES[name] || []));
  const announce = () => {
    if (onStage) onStage(STAGE_ORDER.find((s) => pending.has(s)) || null);
  };
  const finish = (stage) => {
    if (pending.delete(stage)) announce();
  };
  const emit = () => {
    if (onUpdate) onUpdate({ ...data, session: { ...data.session }, meta: { ...data.meta } });
  };
  let gradesAnnounced = false;
  const announceGrades = () => {
    if (gradesAnnounced) return;
    gradesAnnounced = true;
    if (onGrades) onGrades();
  };
  // Are these classes worth calling "grades" on screen? Yes when at least one
  // carries a real percentage (a cache merge or an informative landing page),
  // or when every class is genuinely ungraded (start of term - N/A is the
  // honest answer). A letter-only landing page on a first sign-in fails this,
  // so "Loading grades" holds and sign-in waits for the full gradebook rather
  // than dropping the student onto a wall of 0% bars.
  const presentableGrades = (classes) =>
    classes.some((c) => c.pct != null && c.pct > 0) ||
    (classes.length > 0 && classes.every((c) => c.pct == null));

  const apply = {
    // `partial` marks a landing-page gradebook: for some districts the landing
    // rows carry a letter but no percentage (and never any assignments), so
    // applying it verbatim over a cached snapshot would slam every grade bar
    // to 0% and blank the assignment lists until the full gradebook lands.
    // A partial therefore MERGES per class: the fresh value wins only when it
    // is informative; otherwise the class keeps what the last sync showed, and
    // the final (non-partial) apply replaces everything in one step -
    // last-visit grades -> current grades, nothing in between.
    gradebook(value, { partial = false } = {}) {
      const mapped = mapGradebook(value.gradebook);
      let classes = mapped.classes;
      let assignmentsByClass = mapped.assignmentsByClass;
      if (partial) {
        const prevById = new Map(data.classes.map((c) => [c.id, c]));
        classes = classes.map((c) => {
          const prev = prevById.get(c.id);
          if (!prev || prev.pct == null) return c;
          const uninformative = c.pct == null || c.pct === 0;
          if (!uninformative) return c;
          return {
            ...c,
            grade: prev.grade,
            pct: prev.pct,
            categories: c.categories ?? prev.categories,
          };
        });
        assignmentsByClass = Object.fromEntries(
          classes.map((c) => {
            const fresh = mapped.assignmentsByClass[c.id];
            return [c.id, (fresh && fresh.length > 0 ? fresh : data.assignmentsByClass[c.id]) || []];
          }),
        );
      }
      data.classes = classes;
      data.assignmentsByClass = assignmentsByClass;
      data.semesters = mapped.semesters;
      data.session.semester = mapped.semester;
      // Every sync teaches the per-class grade index a little more - the
      // portal's letters are the only honest source of each teacher's scale.
      harvestFromClasses(classes);
      data.meta.gradebook = {
        ok: true,
        placeholder: value.placeholder,
        message: value.placeholder
          ? 'Sample gradebook. The portal has no active grading period yet.'
          : '',
      };
    },
    attendance(value) {
      const att = value.attendance;
      data.attendance = {
        schoolName: att.schoolName,
        records: att.absences.map(mapAbsence),
        unreadableAbsences: att.unreadableAbsences,
      };
      data.meta.attendance = { ok: true, placeholder: value.placeholder, message: '' };
    },
    documents(value) {
      data.documents = value.map((d) => ({
        id: d.docToken,
        docToken: d.docToken,
        title: d.title,
        category: d.category,
        date: d.uploadDate,
      }));
      data.meta.documents = { ok: true, message: '' };
    },
    mail(value) {
      data.mail = {
        messages: value.messages.map(mapMailMessage),
        unreadableMessages: value.unreadableMessages,
      };
      data.meta.mail = { ok: true, placeholder: false, message: '' };
    },
  };

  // Built per-sync so the gradebook fetcher can stream partial gradebooks
  // into this sync's snapshot as the portal pages land.
  const FETCHERS = {
    gradebook: () =>
      api.getGradebook({
        onPartial: (gradebook) => {
          apply.gradebook({ gradebook, placeholder: false }, { partial: true });
          emit();
          if (presentableGrades(data.classes)) {
            finish('grades'); // grades are on screen from the landing page on
            announceGrades();
          }
        },
      }),
    attendance: () => api.getAttendance(),
    documents: () => api.getDocuments(),
    mail: () => api.getMail(),
  };

  announce(); // the pill shows its first stage before any bytes move

  // Only the requested resources are fetched, plus student info if - and only
  // if - nobody knows the name yet. Success applies the resource to the
  // snapshot and emits immediately; the settled loop below handles failures.
  const jobs = scope
    .filter((name) => FETCHERS[name])
    .map((name) => {
      const promise = FETCHERS[name]().then(
        (value) => {
          apply[name](value);
          for (const stage of RESOURCE_STAGES[name]) finish(stage);
          emit();
          // A gradebook that never emitted a partial (the placeholder path)
          // still counts as grades arriving.
          if (name === 'gradebook') announceGrades();
          return value;
        },
        (error) => {
          for (const stage of RESOURCE_STAGES[name]) finish(stage);
          throw error;
        },
      );
      return [name, promise];
    });
  if (!identity) jobs.unshift(['student', api.getStudent()]);

  const settled = await Promise.allSettled(jobs.map(([, promise]) => promise));
  const results = {};
  jobs.forEach(([name], i) => {
    results[name] = settled[i];
  });

  for (const r of settled) {
    if (r.status === 'rejected' && r.reason && r.reason.status === 401) throw r.reason;
  }

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

  // A failed resource keeps its previous section; meta says why. (Successes
  // were already applied the moment they landed.)
  const { gradebook, attendance, documents, mail } = results;
  if (gradebook && gradebook.status === 'rejected') {
    data.meta.gradebook = {
      ok: false,
      placeholder: false,
      message: friendlyGradebookMessage(gradebook.reason),
    };
  }
  if (attendance && attendance.status === 'rejected') {
    data.meta.attendance = { ok: false, placeholder: false, message: attendance.reason.message };
  }
  if (documents && documents.status === 'rejected') {
    data.meta.documents = { ok: false, message: documents.reason.message };
  }
  if (mail && mail.status === 'rejected') {
    data.meta.mail = { ok: false, placeholder: false, message: friendlyMailMessage(mail.reason) };
  }

  return data;
}

export default { sync };
