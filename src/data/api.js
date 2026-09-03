// Demo data client. Every resource is bundled into the app; no request leaves
// the browser. A local marker remembers which fictional dataset is open.
import { emptySnapshot } from './snapshot.js';
import { clearGradeIndex } from './gradeIndexStore';
import { DEMO, DEMO_STUDENT } from './demo';
import {
  TEST_STUDENT,
  TEST_MAIL,
  testDocumentContent,
  testMailAttachmentContent,
} from './testAccount';
import {
  DISPLAY_STUDENT,
  DISPLAY_MAIL,
  displayDocumentContent,
  displayMailAttachmentContent,
} from './displayAccount';

const SESSION_KEY = 'grademax-session'; // legacy: cleared, never written
const DEMO_SESSION_KEY = 'scoremap-demo-session';
const STUDENT_KEY = 'grademax-student';
const SNAPSHOT_KEY = 'grademax-snapshot';
const CREDS_KEY = 'grademax-credentials'; // legacy: cleared, never written

// Erase data stored by retired builds. These keys are never written now.
try {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CREDS_KEY);
  localStorage.removeItem('grademax-test-session');
  localStorage.removeItem('grademax-auth-notice');
  sessionStorage.removeItem('grademax-auth-notice');
} catch {
  /* storage unavailable */
}

export class ApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// 'test' | 'display' | null - which fictional dataset is open.
let builtinSession = null;

// The marker value 'true' predates the display account and still means the
// test account, so demo sessions from an older build survive.
const MARKER_TO_ACCOUNT = { true: 'test', display: 'display' };

export function hasDemoSession() {
  if (builtinSession) return true;
  try {
    const marker = localStorage.getItem(DEMO_SESSION_KEY);
    builtinSession = marker === 'test' || marker === 'display' ? marker : null;
  } catch {
    /* storage unavailable */
  }
  return !!builtinSession;
}

export function builtinAccount() {
  return hasDemoSession() ? builtinSession : null;
}

// Kept so the chrome can show a name across reloads. Only the two fields it
// displays - and only ever for a sample student.
export function rememberStudent(student) {
  if (!student || !student.name) return;
  try {
    localStorage.setItem(STUDENT_KEY, JSON.stringify({ name: student.name, grade: student.grade }));
  } catch {
    /* storage unavailable */
  }
}

export function recallStudent() {
  try {
    const raw = localStorage.getItem(STUDENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The last snapshot, mirrored so reopening the demo paints immediately
// instead of flashing an empty dashboard.
export function rememberSnapshot(snapshot) {
  if (!snapshot || !snapshot.session || !snapshot.session.lastUpdated) return;
  try {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        ...snapshot,
        session: { ...snapshot.session, lastUpdated: snapshot.session.lastUpdated.toISOString() },
      }),
    );
  } catch {
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

export function recallSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lastUpdated = new Date(parsed.session.lastUpdated);
    if (Number.isNaN(lastUpdated.getTime())) return null;
    return { ...parsed, session: { ...parsed.session, lastUpdated } };
  } catch {
    return null;
  }
}

export function clearDemoSession() {
  builtinSession = null;
  // The grade index is scoped to a sign-in - letters learned from one sample
  // account's classes must not label the other's.
  clearGradeIndex();
  try {
    localStorage.removeItem(DEMO_SESSION_KEY);
    localStorage.removeItem(STUDENT_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasDemo() {
  return DEMO || hasDemoSession();
}

// Retained for compatibility with the existing interface.
export function recallAuthNotice() {
  return null;
}

// Open one of the two fictional datasets. There is no authentication flow.
export async function openDemo(account = 'display') {
  if (DEMO) return DEMO_STUDENT;
  clearDemoSession();
  builtinSession = account === 'test' ? 'test' : 'display';
  try {
    localStorage.setItem(DEMO_SESSION_KEY, builtinSession);
  } catch {
    /* storage unavailable - the demo just won't survive a reload */
  }
  return builtinSession === 'display' ? DISPLAY_STUDENT : TEST_STUDENT;
}

export async function closeDemo() {
  clearDemoSession();
}

// ---- resources ----
// Every one of these is served from the bundled sample data. The sync layer
// builds its snapshot directly (see sync.js); these remain for the pages that
// fetch a single item on demand.

export function getStudent() {
  const account = builtinAccount();
  if (!account) throw new ApiError('DEMO_CLOSED', 'The demo is not open.', 401);
  return Promise.resolve(account === 'display' ? DISPLAY_STUDENT : TEST_STUDENT);
}

export function getMailMessage(id) {
  const mailbox = builtinAccount() === 'display' ? DISPLAY_MAIL : TEST_MAIL;
  const message = mailbox.find((m) => m.id === id);
  if (!message) throw new ApiError('NOT_FOUND', 'Message not found.', 404);
  return Promise.resolve(message);
}

export async function downloadMailAttachment(token) {
  const { bytes, mimeType, fileName } =
    builtinAccount() === 'display' ? displayMailAttachmentContent(token) : testMailAttachmentContent(token);
  return { blob: new Blob([bytes], { type: mimeType }), fileName };
}

export async function downloadDocument(docToken) {
  const { bytes, mimeType, fileName } =
    builtinAccount() === 'display' ? displayDocumentContent(docToken) : testDocumentContent(docToken);
  return { blob: new Blob([bytes], { type: mimeType }), fileName };
}

// Retained so a stale import cannot silently reach for a network that is no
// longer there.
export { emptySnapshot };
