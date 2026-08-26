// Data client. The browser signs in to StudentVUE and scrapes the PXP2 portal
// ITSELF - TLS terminates here (subtls) and runs over the blind relay, which only
// ever sees ciphertext. This module wraps the portal client (src/portal) behind
// the same surface the app already used, returning the same domain shapes.
//
// Session model: the portal cookie jar is kept in memory and mirrored to
// sessionStorage; the credentials are saved in localStorage - on this device
// only, never sent anywhere but StudentVUE - so the app can sign back in by
// itself: on the next visit, and again whenever the ~20-min portal session
// expires mid-use. A saved sign-in is replayed until the portal rejects it;
// AUTH_FAILED clears everything and the app returns to the login page with a
// notice. Relay/portal outages never clear it - a dead relay must not log
// anyone out.
import { createRelayRouter } from '../transport/relayRouter';
import { userRegion } from '../transport/region';
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
import {
  AuthError,
  InvalidDomainError,
  ModuleUnavailableError,
  NoActiveGradingPeriodError,
  ParseError,
  PortalHttpError,
  PortalShapeError,
  SessionExpiredError,
} from '../portal/errors';
import { SAMPLE_GRADEBOOK, SAMPLE_ATTENDANCE, PLACEHOLDER_DATA } from './placeholders';
import { DEMO, DEMO_STUDENT } from './demo';
import {
  isTestCredentials,
  TEST_STUDENT,
  TEST_MAIL,
  testDocumentContent,
  testMailAttachmentContent,
} from './testAccount';
import {
  isDisplayCredentials,
  DISPLAY_STUDENT,
  DISPLAY_MAIL,
  displayDocumentContent,
  displayMailAttachmentContent,
} from './displayAccount';

// Set at build time (deploy workflow). Production sets BOTH coast relays and
// the router serves the hot lane (login, student info, gradebook) from the
// relay nearest the user with the cold lane (attendance, documents, mail) on
// the other one - see transport/relayRouter.js. With only VITE_RELAY_URL set
// (dev: ws://localhost) both lanes share the single relay.
const RELAY_URL = import.meta.env.VITE_RELAY_URL || 'ws://localhost:8080';
const RELAY_WEST_URL = import.meta.env.VITE_RELAY_WEST_URL || '';
const RELAY_EAST_URL = import.meta.env.VITE_RELAY_EAST_URL || '';
const SESSION_KEY = 'grademax-session'; // sessionStorage: the live cookie jar
const TEST_SESSION_KEY = 'grademax-test-session';
const STUDENT_KEY = 'grademax-student';
const SNAPSHOT_KEY = 'grademax-snapshot';
const CREDS_KEY = 'grademax-credentials';
const AUTH_NOTICE_KEY = 'grademax-auth-notice'; // sessionStorage: why the sign-in was cleared

// One-time migration: the snapshot, student, and test-session mirrors moved
// from sessionStorage to localStorage so auto sign-in survives a closed tab.
// Carry a live test marker over; purge the rest of the pre-move copies.
(function migrateStorage() {
  try {
    if (sessionStorage.getItem(TEST_SESSION_KEY) === 'true') localStorage.setItem(TEST_SESSION_KEY, 'true');
    sessionStorage.removeItem(TEST_SESSION_KEY);
    sessionStorage.removeItem(STUDENT_KEY);
    sessionStorage.removeItem(SNAPSHOT_KEY);
  } catch {
    /* storage unavailable */
  }
})();

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const router = createRelayRouter({
  relays:
    RELAY_WEST_URL && RELAY_EAST_URL
      ? [
          { url: RELAY_WEST_URL, region: 'west' },
          { url: RELAY_EAST_URL, region: 'east' },
        ]
      : [{ url: RELAY_URL }],
  preferRegion: userRegion(),
});
// Hot lane: what the student is waiting to see.
const options = { fetchImpl: router.primary };
// Cold lane: background resources, kept off the hot lane's relay so they
// never queue ahead of grades.
const backgroundOptions = { fetchImpl: router.secondary };
let session = null; // in-memory { domain, jar: CookieJar }
// 'test' | 'display' | null - signed in as a built-in account (no portal
// session). The marker value 'true' predates the display account and still
// means the test account, so existing sessions survive.
let builtinSession = null;

const MARKER_TO_ACCOUNT = { true: 'test', display: 'display' };

// A built-in account has no cookie jar; a localStorage marker lets the next
// visit resume it the same way stored credentials resume a real session.
export function isTestSession() {
  if (builtinSession) return true;
  try {
    builtinSession = MARKER_TO_ACCOUNT[localStorage.getItem(TEST_SESSION_KEY)] || null;
  } catch {
    /* storage unavailable */
  }
  return !!builtinSession;
}

// Which built-in account is signed in: 'test', 'display', or null.
export function builtinAccount() {
  return isTestSession() ? builtinSession : null;
}

// The saved sign-in. Plaintext by design: any obfuscation a bundled app could
// apply is decodable by the same code that would read it, so it would only
// pretend. The honest mitigations are elsewhere - the password never leaves
// the browser unencrypted, and signing out erases it.
export function rememberCredentials({ domain, username, password }) {
  try {
    localStorage.setItem(CREDS_KEY, JSON.stringify({ domain, username, password }));
  } catch {
    /* storage unavailable - auto sign-in just won't survive this tab */
  }
}

export function recallCredentials() {
  try {
    const raw = localStorage.getItem(CREDS_KEY);
    if (!raw) return null;
    const { domain, username, password } = JSON.parse(raw);
    if (!domain || !username || typeof password !== 'string') return null;
    return { domain, username, password };
  } catch {
    return null;
  }
}

// Why the login page is being shown after an automatic sign-in died: carries
// the non-secret half of the cleared credentials so the form can prefill.
// Read non-destructively (StrictMode mounts twice); erased by the next
// clearToken(), i.e. by the next completed sign-in or sign-out.
export function recallAuthNotice() {
  try {
    const raw = sessionStorage.getItem(AUTH_NOTICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
// fields the chrome shows - never the portrait or the perm ID.
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

// The last synced snapshot, mirrored so opening the app can show the data it
// already had instead of a blank page. It has no expiry: with a saved sign-in
// the boot sync refreshes it anyway, and grades from last week beat an empty
// dashboard while that runs. The "Last updated" pill keeps its age honest.
//
// It holds grades and messages, so it lives exactly as long as the saved
// sign-in does - clearToken() erases both.
export function rememberSnapshot(snapshot) {
  // An unsynced snapshot has nothing worth restoring, and writing it would
  // overwrite a good one during sign-out.
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
    // Out of quota, most likely. A missing mirror only costs a sync, so drop
    // the stale one rather than leaving a half-written record behind.
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

// authFailed: the portal rejected the saved sign-in - leave a notice (with the
// non-secret fields, for prefill) for the login page. The notice deliberately
// survives ordinary clears (the provider's 401 handler runs clearToken() right
// after the one that set it); it goes away only when its story ends - a
// completed sign-in or an explicit sign-out (clearAuthNotice).
export function clearToken({ authFailed = false } = {}) {
  const creds = authFailed ? recallCredentials() : null;
  session = null;
  builtinSession = null;
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TEST_SESSION_KEY);
    localStorage.removeItem(STUDENT_KEY);
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(CREDS_KEY);
  } catch {
    /* ignore */
  }
  if (creds) {
    try {
      sessionStorage.setItem(AUTH_NOTICE_KEY, JSON.stringify({ username: creds.username, domain: creds.domain }));
    } catch {
      /* storage unavailable */
    }
  }
}

function clearAuthNotice() {
  try {
    sessionStorage.removeItem(AUTH_NOTICE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasToken() {
  if (DEMO) return true;
  if (isTestSession()) return true;
  if (session) return true;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return true;
  } catch {
    /* fall through to the saved sign-in */
  }
  return !!recallCredentials();
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
// Matched by instanceof, never by class NAME: the production bundle is minified
// and esbuild mangles class names, which silently turned every entry of the old
// name-keyed table into INTERNAL - auth failures showed a generic error instead
// of signing the student out.
const ERROR_MAP = [
  [AuthError, 'AUTH_FAILED', 401],
  [InvalidDomainError, 'VALIDATION', 400],
  [SessionExpiredError, 'SESSION_EXPIRED', 401],
  [NoActiveGradingPeriodError, 'NO_ACTIVE_GRADING_PERIOD', 409],
  [ModuleUnavailableError, 'PORTAL_UNAVAILABLE', 502],
  [ParseError, 'PARSE_FAILED', 502],
  [PortalShapeError, 'PARSE_FAILED', 502],
  [PortalHttpError, 'PORTAL_UNAVAILABLE', 502],
];

function mapError(e) {
  if (e instanceof ApiError) return e;
  const hit = ERROR_MAP.find(([cls]) => e instanceof cls);
  const [, code, status] = hit || [null, 'INTERNAL', 500];
  return new ApiError(code, (e && e.message) || 'Request failed.', status);
}

// A live session, minting one from the saved credentials when there is none.
// Single-flight: a cold boot fires every resource fetcher at once and they must
// share one login, not race four. Resolves null only when nothing is saved.
// AUTH_FAILED here is the moment the saved sign-in "stops working": everything
// is cleared (with the login-page notice) before the 401 surfaces. Any other
// failure - relay down, portal 5xx - leaves the credentials alone.
let loginInFlight = null;
function ensureSession() {
  const s = currentSession();
  if (s) return Promise.resolve(s);
  const creds = recallCredentials();
  if (!creds) return Promise.resolve(null);
  if (!loginInFlight) {
    loginInFlight = (async () => {
      try {
        session = await portalLogin(creds, options);
        persist(session);
        return session;
      } catch (e) {
        const mapped = mapError(e);
        if (mapped.code === 'AUTH_FAILED') clearToken({ authFailed: true });
        throw mapped;
      } finally {
        loginInFlight = null;
      }
    })();
  }
  return loginInFlight;
}

async function withSession(fn) {
  const s = await ensureSession();
  if (!s) throw new ApiError('SESSION_EXPIRED', 'Your session has ended. Sign in again.', 401);
  try {
    const result = await fn(s);
    persist(s); // the jar is updated in place per request; keep the mirror fresh
    return result;
  } catch (e) {
    if (!(e instanceof SessionExpiredError)) throw mapError(e);
    // The cookie died mid-use (~20 min idle). With a saved sign-in this heals
    // itself: drop the dead jar, log in again, retry the request once.
    session = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    const revived = await ensureSession();
    if (!revived) {
      clearToken();
      throw mapError(e);
    }
    try {
      const result = await fn(revived);
      persist(revived);
      return result;
    } catch (retryError) {
      if (retryError instanceof SessionExpiredError) clearToken();
      throw mapError(retryError);
    }
  }
}

// ---- auth ----

export async function login({ domain, username, password }) {
  if (DEMO) return DEMO_STUDENT;
  // A fresh sign-in never inherits the previous session - in particular, a real
  // login must drop a lingering test-session marker, or the sync layer keeps
  // serving the sample snapshot to a genuinely signed-in student.
  clearToken();
  const builtin = isTestCredentials({ domain, username, password })
    ? 'test'
    : isDisplayCredentials({ domain, username, password })
      ? 'display'
      : null;
  if (builtin) {
    builtinSession = builtin;
    try {
      localStorage.setItem(TEST_SESSION_KEY, builtin === 'test' ? 'true' : builtin);
    } catch {
      /* storage unavailable - the session just won't survive a reload */
    }
    clearAuthNotice();
    return builtin === 'display' ? DISPLAY_STUDENT : TEST_STUDENT;
  }
  try {
    session = await portalLogin({ domain, username, password }, options);
    persist(session);
    // Only a portal-accepted sign-in is worth replaying later.
    rememberCredentials({ domain, username, password });
    clearAuthNotice();
    return await fetchStudentInfo(session, options);
  } catch (e) {
    clearToken();
    throw mapError(e);
  }
}

export async function logout() {
  clearToken();
  clearAuthNotice();
}

// ---- resources (return the same domain shapes the app already maps) ----

export function getStudent() {
  return withSession((s) => fetchStudentInfo(s, options));
}

export function getDocuments() {
  return withSession((s) => fetchDocuments(s, backgroundOptions));
}

// Returns { attendance, placeholder }. With VITE_PLACEHOLDER_DATA on and no real
// absences, serves SAMPLE_ATTENDANCE (flagged as sample) so the UI can be seen;
// otherwise returns the real (possibly empty) attendance.
export async function getAttendance() {
  return withSession(async (s) => {
    const attendance = await fetchAttendance(s, backgroundOptions);
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
// has no gradebook to give - NO_ACTIVE_GRADING_PERIOD (out of term) or PARSE_FAILED
// (parser not written yet) - AND VITE_PLACEHOLDER_DATA is on do we serve
// SAMPLE_GRADEBOOK, flagged as sample. Once the parser lands and the term is active,
// this fallback is never reached.
// `onPartial` (optional) hears complete-but-still-filling gradebooks as the
// portal pages land - the landing page first (grades, no assignments), then
// one per class detail - so the sync layer can paint grades immediately.
export async function getGradebook({ onPartial } = {}) {
  return withSession(async (s) => {
    try {
      const hooks = onPartial ? { onPartial } : {};
      return { gradebook: await fetchGradebook(s, undefined, options, hooks), placeholder: false };
    } catch (e) {
      const blocked = e instanceof NoActiveGradingPeriodError || e instanceof ParseError;
      if (PLACEHOLDER_DATA && blocked) return { gradebook: SAMPLE_GRADEBOOK, placeholder: true };
      throw e;
    }
  });
}

export function getMail() {
  return withSession((s) => fetchMail(s, backgroundOptions));
}

// One message with its body and attachments. The list call carries neither, so
// the reader loads them on open for anything the sync did not prefetch.
export function getMailMessage(id, isSystemMessage = false) {
  if (isTestSession() || DEMO) {
    const mailbox = builtinAccount() === 'display' ? DISPLAY_MAIL : TEST_MAIL;
    const message = mailbox.find((m) => m.id === id);
    if (!message) throw new ApiError('NOT_FOUND', 'Message not found.', 404);
    return Promise.resolve(message);
  }
  return withSession((s) => fetchMailMessage(s, id, isSystemMessage, backgroundOptions));
}

export async function downloadMailAttachment(token) {
  if (isTestSession()) {
    const { bytes, mimeType, fileName } =
      builtinAccount() === 'display' ? displayMailAttachmentContent(token) : testMailAttachmentContent(token);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  }
  return withSession(async (s) => {
    const { bytes, mimeType, fileName } = await portalDownloadMailAttachment(s, token, backgroundOptions);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  });
}

export async function downloadDocument(docToken) {
  if (isTestSession()) {
    const { bytes, mimeType, fileName } =
      builtinAccount() === 'display' ? displayDocumentContent(docToken) : testDocumentContent(docToken);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  }
  return withSession(async (s) => {
    const { bytes, mimeType, fileName } = await portalDownloadDocument(s, docToken, backgroundOptions);
    return { blob: new Blob([bytes], { type: mimeType }), fileName };
  });
}
