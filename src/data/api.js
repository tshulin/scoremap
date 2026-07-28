// Data client. The browser signs in to StudentVUE and scrapes the PXP2 portal
// ITSELF — TLS terminates here (subtls) and runs over the blind relay, which only
// ever sees ciphertext. This module wraps the portal client (src/portal) behind
// the same surface the app already used, returning the same domain shapes.
//
// Session model: the portal cookie jar (not the password) is kept in memory and
// mirrored to sessionStorage so a reload resumes without another login. The
// password is used once, in the browser, and is never stored. When the portal
// session expires (~20 min idle) a fetch throws SESSION_EXPIRED and the app
// returns to sign-in — we can't silently re-login because we don't keep the
// password.
import { createRelayFetch } from '../transport/fetchShim';
import { CookieJar } from '../portal/http';
import { login as portalLogin } from '../portal/login';
import { fetchStudentInfo } from '../portal/pages/studentInfo';
import { fetchDocuments, downloadDocument as portalDownloadDocument } from '../portal/pages/documents';
import { fetchAttendance } from '../portal/pages/attendance';
import { fetchGradebook } from '../portal/pages/gradebook/index';
import {
  fetchMail,
  fetchMailMessage,
  downloadMailAttachment as portalDownloadMailAttachment,
} from '../portal/pages/mail';
import { SessionExpiredError, NoActiveGradingPeriodError, ParseError } from '../portal/errors';
import { SAMPLE_GRADEBOOK, SAMPLE_ATTENDANCE, PLACEHOLDER_DATA } from './placeholders';
import { DEMO, DEMO_STUDENT } from './demo';
import {
  isTestCredentials,
  TEST_STUDENT,
  TEST_MAIL,
  testDocumentContent,
  testMailAttachmentContent,
} from './testAccount';

// Set at build time (deploy workflow); wss:// in production, ws://localhost in dev.
const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:8080';
const SESSION_KEY = 'grademax-session';
const TEST_SESSION_KEY = 'grademax-test-session';
const STUDENT_KEY = 'grademax-student';
const SNAPSHOT_KEY = 'grademax-snapshot';

// How long a mirrored snapshot is worth showing. The portal drops an idle
// session after roughly twenty minutes, so anything older belongs to a session
// that is probably already gone — at which point a sync is needed regardless.
const SNAPSHOT_MAX_AGE_MS = 20 * 60_000;

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const options = { fetchImpl: createRelayFetch({ relayUrl: RELAY_URL }) };
let session = null; // in-memory { domain, jar: CookieJar }
let testSession = false; // signed in as the built-in test account (no portal session)

// The test account has no cookie jar; a sessionStorage marker lets a reload
// resume it the same way the mirrored jar resumes a real session.
export function isTestSession() {
  if (testSession) return true;
  try {
    testSession = sessionStorage.getItem(TEST_SESSION_KEY) === 'true';
  } catch {
    /* storage unavailable */
  }
  return testSession;
}

function persist(s) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ domain: s.domain, cookies: s.jar.header() }));
  } catch {
    /* storage unavailable */
  }
}

function restore() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { domain, cookies } = JSON.parse(raw);
    return { domain, jar: CookieJar.fromCookieString(cookies) };
  } catch {
    return null;
  }
}

// Who is signed in, kept next to the session so a reload still knows the name
// even if that sync's student-info request is the one that fails. Only the two
// fields the chrome shows — never the portrait or the perm ID.
export function rememberStudent(student) {
  if (!student || !student.name) return;
  try {
    sessionStorage.setItem(STUDENT_KEY, JSON.stringify({ name: student.name, grade: student.grade }));
  } catch {
    /* storage unavailable */
  }
}

export function recallStudent() {
  try {
    const raw = sessionStorage.getItem(STUDENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The last synced snapshot, mirrored beside the cookie jar so a reload can show
// the data it already had instead of re-fetching all of it. Reloading was the
// last thing in the app that still cost a full sync every time — F5, a restored
// tab, or following a link back in all paid for one.
//
// It holds grades and messages, which is why it lives in sessionStorage (dies
// with the tab, same as the jar) and is cleared by clearToken() on sign-out.
export function rememberSnapshot(snapshot) {
  // An unsynced snapshot has nothing worth restoring, and writing it would
  // overwrite a good one during sign-out.
  if (!snapshot || !snapshot.session || !snapshot.session.lastUpdated) return;
  try {
    sessionStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({
        ...snapshot,
        session: { ...snapshot.session, lastUpdated: snapshot.session.lastUpdated.toISOString() },
      }),
    );
  } catch {
    // Out of quota, most likely. A missing mirror only costs a sync, so drop
    // the stale one rather than leaving a half-written record behind.
    try {
      sessionStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      /* storage unavailable */
    }
  }
}

export function recallSnapshot() {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const lastUpdated = new Date(parsed.session.lastUpdated);
    if (Number.isNaN(lastUpdated.getTime())) return null;
    if (Date.now() - lastUpdated.getTime() > SNAPSHOT_MAX_AGE_MS) return null;
    return { ...parsed, session: { ...parsed.session, lastUpdated } };
  } catch {
    return null;
  }
}

export function clearToken() {
  session = null;
  testSession = false;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TEST_SESSION_KEY);
    sessionStorage.removeItem(STUDENT_KEY);
    sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function hasToken() {
  if (DEMO) return true;
  if (isTestSession()) return true;
  if (session) return true;
  try {
    return !!sessionStorage.getItem(SESSION_KEY);
  } catch {
    return false;
  }
}

export function getToken() {
  return hasToken() ? 'session' : null;
}

function currentSession() {
  if (!session) session = restore();
  return session;
}

// Portal errors -> the { code, status } shape the app already handles. Codes match
// the former backend's PortalErrorCode enum; status 401 sends the app to sign-in.
function mapError(e) {
  if (e instanceof ApiError) return e;
  const name = e && e.constructor ? e.constructor.name : '';
  const table = {
    AuthError: ['AUTH_FAILED', 401],
    InvalidDomainError: ['VALIDATION', 400],
    SessionExpiredError: ['SESSION_EXPIRED', 401],
    NoActiveGradingPeriodError: ['NO_ACTIVE_GRADING_PERIOD', 409],
    ModuleUnavailableError: ['PORTAL_UNAVAILABLE', 502],
    ParseError: ['PARSE_FAILED', 502],
    PortalShapeError: ['PARSE_FAILED', 502],
    PortalHttpError: ['PORTAL_UNAVAILABLE', 502],
  };
  const [code, status] = table[name] || ['INTERNAL', 500];
  return new ApiError(code, (e && e.message) || 'Request failed.', status);
}

async function withSession(fn) {
  const s = currentSession();
  if (!s) throw new ApiError('SESSION_EXPIRED', 'Your session has ended. Sign in again.', 401);
  try {
    const result = await fn(s);
    persist(s); // the jar is updated in place per request; keep the mirror fresh
    return result;
  } catch (e) {
    if (e instanceof SessionExpiredError) clearToken();
    throw mapError(e);
  }
}

// ---- auth ----

export async function login({ domain, username, password }) {
  if (DEMO) return DEMO_STUDENT;
  // A fresh sign-in never inherits the previous session — in particular, a real
  // login must drop a lingering test-session marker, or the sync layer keeps
  // serving the sample snapshot to a genuinely signed-in student.
  clearToken();
  if (isTestCredentials({ domain, username, password })) {
    testSession = true;
    try {
      sessionStorage.setItem(TEST_SESSION_KEY, 'true');
    } catch {
      /* storage unavailable — the session just won't survive a reload */
    }
    return TEST_STUDENT;
  }
  try {
    session = await portalLogin({ domain, username, password }, options);
    persist(session);
    return await fetchStudentInfo(session, options);
  } catch (e) {
    clearToken();
    throw mapError(e);
  }
}

export async function logout() {
  clearToken();
}

// ---- resources (return the same domain shapes the app already maps) ----

export function getStudent() {
  return withSession((s) => fetchStudentInfo(s, options));
}

export function getDocuments() {
  return withSession((s) => fetchDocuments(s, options));
}

// Returns { attendance, placeholder }. With VITE_PLACEHOLDER_DATA on and no real
// absences, serves SAMPLE_ATTENDANCE (flagged as sample) so the UI can be seen;
// otherwise returns the real (possibly empty) attendance.
export async function getAttendance() {
  return withSession(async (s) => {
    const attendance = await fetchAttendance(s, options);
    if (PLACEHOLDER_DATA && attendance.absences.length === 0) {
      return {
        attendance: { ...SAMPLE_ATTENDANCE, schoolName: attendance.schoolName || SAMPLE_ATTENDANCE.schoolName },
        placeholder: true,
      };
    }
    return { attendance, placeholder: false };
  });
}

// Returns { gradebook, placeholder }. Real grades always win. Only when the portal
// has no gradebook to give — NO_ACTIVE_GRADING_PERIOD (out of term) or PARSE_FAILED
// (parser not written yet) — AND VITE_PLACEHOLDER_DATA is on do we serve
// SAMPLE_GRADEBOOK, flagged as sample. Once the parser lands and the term is active,
// this fallback is never reached.
export async function getGradebook() {
  return withSession(async (s) => {
    try {
      return { gradebook: await fetchGradebook(s, undefined, options), placeholder: false };
    } catch (e) {
      const blocked = e instanceof NoActiveGradingPeriodError || e instanceof ParseError;
      if (PLACEHOLDER_DATA && blocked) return { gradebook: SAMPLE_GRADEBOOK, placeholder: true };
      throw e;
    }
  });
}

export function getMail() {
  return withSession((s) => fetchMail(s, options));
}

// One message with its body and attachments. The list call carries neither, so
// the reader loads them on open for anything the sync did not prefetch.
export function getMailMessage(id, isSystemMessage = false) {
  if (isTestSession() || DEMO) {
    const message = TEST_MAIL.find((m) => m.id === id);
    if (!message) throw new ApiError('NOT_FOUND', 'Message not found.', 404);
    return Promise.resolve(message);
  }
  return withSession((s) => fetchMailMessage(s, id, isSystemMessage, options));
}

export async function downloadMailAttachment(token) {
  if (isTestSession()) {
    const { bytes, mimeType, fileName } = testMailAttachmentContent(token);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  }
  return withSession(async (s) => {
    const { bytes, mimeType, fileName } = await portalDownloadMailAttachment(s, token, options);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  });
}

export async function downloadDocument(docToken) {
  if (isTestSession()) {
    const { bytes, mimeType, fileName } = testDocumentContent(docToken);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  }
  return withSession(async (s) => {
    const { bytes, mimeType, fileName } = await portalDownloadDocument(s, docToken, options);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  });
}
