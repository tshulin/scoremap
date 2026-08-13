// The saved sign-in and the snapshot mirror. These pin the rules that make
// auto sign-in safe: the snapshot must never overwrite good data with an empty
// one, signing out must erase everything durable (it holds grades, messages,
// and the password), and the credentials are replayed only until the portal
// rejects them - a dead relay must not log anyone out.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, SessionExpiredError, PortalHttpError } from '../portal/errors';

vi.mock('../transport/fetchShim', () => ({
  createRelayFetch: () => async () => {
    throw new Error('no network in tests');
  },
}));
vi.mock('../portal/login', () => ({ login: vi.fn() }));
vi.mock('../portal/pages/studentInfo', () => ({ fetchStudentInfo: vi.fn() }));
vi.mock('../portal/pages/documents', () => ({
  fetchDocuments: vi.fn(),
  downloadDocument: vi.fn(),
}));

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    _map: map,
  };
}

globalThis.sessionStorage = fakeStorage();
globalThis.localStorage = fakeStorage();

const api = await import('./api.js');
const {
  rememberSnapshot,
  recallSnapshot,
  rememberCredentials,
  recallCredentials,
  recallAuthNotice,
  clearToken,
  hasToken,
} = api;
const { login: portalLogin } = await import('../portal/login');
const { fetchStudentInfo } = await import('../portal/pages/studentInfo');
const { fetchDocuments } = await import('../portal/pages/documents');

const SNAPSHOT_KEY = 'grademax-snapshot';
const CREDS = { domain: 'ca-pleas-psv.edupoint.com', username: 'ada', password: 'pw' };

const snapshotAt = (date) => ({
  classes: [{ id: 'algebra-2', name: 'Algebra 2', grade: 'A' }],
  documents: [{ id: 'DOC-1', title: 'Report Card' }],
  mail: { messages: [{ id: 'M-1', subject: 'Picture day' }], unreadableMessages: 0 },
  session: { studentName: 'Ada Lovelace', grade: '11', lastUpdated: date },
  meta: { gradebook: { ok: true, placeholder: false, message: '' } },
});

const fakePortalSession = () => ({
  domain: CREDS.domain,
  jar: { header: () => 'ASP.NET_SessionId=abc' },
});

beforeEach(() => {
  globalThis.sessionStorage = fakeStorage();
  globalThis.localStorage = fakeStorage();
  clearToken(); // also resets the module-level in-memory session
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('snapshot mirror', () => {
  it('round-trips a snapshot with lastUpdated revived as a Date', () => {
    const at = new Date(Date.now() - 60_000);
    rememberSnapshot(snapshotAt(at));

    const back = recallSnapshot();
    expect(back.session.lastUpdated).toBeInstanceOf(Date);
    expect(back.session.lastUpdated.getTime()).toBe(at.getTime());
    expect(back.classes).toEqual([{ id: 'algebra-2', name: 'Algebra 2', grade: 'A' }]);
    expect(back.mail.messages).toHaveLength(1);
    expect(back.session.studentName).toBe('Ada Lovelace');
  });

  it('returns null when nothing was stored', () => {
    expect(recallSnapshot()).toBeNull();
  });

  // The mirror has no expiry: with a saved sign-in the boot sync refreshes it
  // anyway, and week-old grades beat a blank dashboard while that runs.
  it('survives far past the old portal-session window', () => {
    rememberSnapshot(snapshotAt(new Date(Date.now() - 7 * 24 * 60 * 60_000)));
    expect(recallSnapshot()).not.toBeNull();
  });

  // Sign-out sets the app back to the empty snapshot; storing that would
  // replace a good mirror with nothing.
  it('refuses to store a snapshot that was never synced', () => {
    rememberSnapshot(snapshotAt(new Date()));
    rememberSnapshot({ classes: [], session: { studentName: '', lastUpdated: null } });

    expect(recallSnapshot().classes).toHaveLength(1);
  });

  it('ignores a null or malformed snapshot', () => {
    rememberSnapshot(null);
    rememberSnapshot({});
    expect(recallSnapshot()).toBeNull();
  });

  it('returns null rather than throwing on a corrupt record', () => {
    localStorage.setItem(SNAPSHOT_KEY, '{not json');
    expect(recallSnapshot()).toBeNull();
  });

  it('drops the stale record when the write fails', () => {
    rememberSnapshot(snapshotAt(new Date()));
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();

    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    rememberSnapshot(snapshotAt(new Date()));

    // A missing mirror only costs a sync; a half-written one could be served.
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  it('is erased on sign-out', () => {
    rememberSnapshot(snapshotAt(new Date()));
    expect(recallSnapshot()).not.toBeNull();

    clearToken();

    expect(recallSnapshot()).toBeNull();
    expect(localStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });
});

describe('saved sign-in', () => {
  it('round-trips credentials and counts as a token', () => {
    expect(hasToken()).toBe(false);
    rememberCredentials(CREDS);
    expect(recallCredentials()).toEqual(CREDS);
    expect(hasToken()).toBe(true);
  });

  it('rejects a corrupt or incomplete record', () => {
    localStorage.setItem('grademax-credentials', '{not json');
    expect(recallCredentials()).toBeNull();
    localStorage.setItem('grademax-credentials', JSON.stringify({ username: 'ada' }));
    expect(recallCredentials()).toBeNull();
  });

  it('is stored by a portal-accepted login', async () => {
    portalLogin.mockResolvedValue(fakePortalSession());
    fetchStudentInfo.mockResolvedValue({ name: 'Ada Lovelace', grade: '11' });

    await api.login(CREDS);

    expect(recallCredentials()).toEqual(CREDS);
  });

  it('is not stored when the portal rejects the login', async () => {
    portalLogin.mockRejectedValue(new AuthError('Login failed. Check the username and password.'));

    await expect(api.login(CREDS)).rejects.toMatchObject({ code: 'AUTH_FAILED', status: 401 });
    expect(recallCredentials()).toBeNull();
  });

  it('is erased on sign-out', () => {
    rememberCredentials(CREDS);
    clearToken();
    expect(recallCredentials()).toBeNull();
    expect(hasToken()).toBe(false);
  });
});

describe('auth notice', () => {
  it('carries the non-secret fields when the sign-in is cleared for auth failure', () => {
    rememberCredentials(CREDS);
    clearToken({ authFailed: true });

    expect(recallCredentials()).toBeNull();
    expect(recallAuthNotice()).toEqual({ username: 'ada', domain: 'ca-pleas-psv.edupoint.com' });
    // Non-destructive: the login page may mount twice (StrictMode).
    expect(recallAuthNotice()).not.toBeNull();
  });

  // The provider's 401 handler runs a plain clearToken() right after the api
  // layer's authFailed one; the notice must outlive that to reach the login page.
  it('survives the ordinary clear that follows the auth-failed one', () => {
    rememberCredentials(CREDS);
    clearToken({ authFailed: true });
    clearToken();
    expect(recallAuthNotice()).not.toBeNull();
  });

  it('ends with a completed sign-in', async () => {
    rememberCredentials(CREDS);
    clearToken({ authFailed: true });
    portalLogin.mockResolvedValue(fakePortalSession());
    fetchStudentInfo.mockResolvedValue({ name: 'Ada Lovelace', grade: '11' });

    await api.login(CREDS);

    expect(recallAuthNotice()).toBeNull();
  });

  it('ends with an explicit sign-out', async () => {
    rememberCredentials(CREDS);
    clearToken({ authFailed: true });
    await api.logout();
    expect(recallAuthNotice()).toBeNull();
  });
});

describe('auto sign-in policy', () => {
  it('mints a session from saved credentials and retries once after mid-use expiry', async () => {
    rememberCredentials(CREDS);
    portalLogin.mockResolvedValue(fakePortalSession());
    fetchDocuments
      .mockRejectedValueOnce(new SessionExpiredError('Session expired.'))
      .mockResolvedValueOnce([{ id: 'DOC-1' }]);

    const docs = await api.getDocuments();

    expect(docs).toEqual([{ id: 'DOC-1' }]);
    expect(portalLogin).toHaveBeenCalledTimes(2); // boot login + the heal
    expect(recallCredentials()).toEqual(CREDS); // still saved - it worked
  });

  it('clears the saved sign-in when the portal rejects it', async () => {
    rememberCredentials(CREDS);
    portalLogin.mockRejectedValue(new AuthError('Login failed. Check the username and password.'));

    await expect(api.getDocuments()).rejects.toMatchObject({ code: 'AUTH_FAILED', status: 401 });
    expect(recallCredentials()).toBeNull();
    expect(recallAuthNotice()).toEqual({ username: 'ada', domain: 'ca-pleas-psv.edupoint.com' });
  });

  it('keeps the saved sign-in through a relay or portal outage', async () => {
    rememberCredentials(CREDS);
    portalLogin.mockRejectedValue(
      new PortalHttpError('Request to https://x failed', { url: 'https://x' }),
    );

    await expect(api.getDocuments()).rejects.toMatchObject({ code: 'PORTAL_UNAVAILABLE' });
    expect(recallCredentials()).toEqual(CREDS);
    expect(recallAuthNotice()).toBeNull();
  });

  it('shares one login between concurrent fetchers', async () => {
    rememberCredentials(CREDS);
    let release;
    portalLogin.mockImplementation(
      () => new Promise((resolve) => {
        release = () => resolve(fakePortalSession());
      }),
    );
    fetchDocuments.mockResolvedValue([]);

    const both = Promise.all([api.getDocuments(), api.getDocuments()]);
    await Promise.resolve(); // let both reach ensureSession
    release();
    await both;

    expect(portalLogin).toHaveBeenCalledTimes(1);
  });

  it('still fails plainly when nothing is saved', async () => {
    await expect(api.getDocuments()).rejects.toMatchObject({ code: 'SESSION_EXPIRED', status: 401 });
    expect(portalLogin).not.toHaveBeenCalled();
  });

  // The production bundle is minified and esbuild mangles class names; the
  // error mapping must key on identity, not `constructor.name`, or the 401
  // sign-out policy silently dies in prod (it did - this is the regression).
  it('maps errors by identity even when the class name is mangled', async () => {
    rememberCredentials(CREDS);
    const Mangled = class extends AuthError {};
    Object.defineProperty(Mangled, 'name', { value: 'x7' });
    portalLogin.mockRejectedValue(new Mangled('nope'));

    await expect(api.getDocuments()).rejects.toMatchObject({ code: 'AUTH_FAILED', status: 401 });
    expect(recallCredentials()).toBeNull();
  });

  // Auto sign-in is for actual accounts. The sample (display) account signs in
  // for the tab only - nothing durable is written, so a later visit lands on
  // the landing page, not Hisori Gotou's dashboard.
  it('keeps the sample (display) sign-in out of durable storage', async () => {
    await api.login({ domain: 'hustler-uni-psv.edupoint.com', username: 'display', password: 'display' });

    expect(hasToken()).toBe(true);
    expect(sessionStorage.getItem('grademax-display-session')).toBe('true');
    expect(localStorage.getItem('grademax-test-session')).toBeNull();
    expect(recallCredentials()).toBeNull();
  });

  it('still persists the test account marker durably', async () => {
    await api.login({ domain: 'hustler-uni-psv.edupoint.com', username: 'test', password: 'test' });

    expect(hasToken()).toBe(true);
    expect(localStorage.getItem('grademax-test-session')).toBe('true');
  });

  // Earlier versions persisted the display marker; it must no longer grant a
  // session on load.
  it('ignores a lingering persisted display marker', () => {
    localStorage.setItem('grademax-test-session', 'display');
    expect(hasToken()).toBe(false);
  });
});
