// The snapshot mirror. A reload used to cost a full sync every time; these
// pin the rules that make skipping it safe — it must expire, it must never
// overwrite good data with an empty snapshot, and signing out must erase it
// (it holds grades and messages).
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { rememberSnapshot, recallSnapshot, clearToken } = await import('./api.js');

const SNAPSHOT_KEY = 'grademax-snapshot';

const snapshotAt = (date) => ({
  classes: [{ id: 'algebra-2', name: 'Algebra 2', grade: 'A' }],
  documents: [{ id: 'DOC-1', title: 'Report Card' }],
  mail: { messages: [{ id: 'M-1', subject: 'Picture day' }], unreadableMessages: 0 },
  session: { studentName: 'Ada Lovelace', grade: '11', lastUpdated: date },
  meta: { gradebook: { ok: true, placeholder: false, message: '' } },
});

beforeEach(() => {
  globalThis.sessionStorage = fakeStorage();
  vi.useRealTimers();
});

describe('snapshot mirror', () => {
  it('round-trips a snapshot with lastUpdated revived as a Date', () => {
    // Relative to now: an absolute date would silently start expiring.
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

  it('expires a snapshot older than the portal session', () => {
    rememberSnapshot(snapshotAt(new Date(Date.now() - 21 * 60_000)));
    expect(recallSnapshot()).toBeNull();
  });

  it('still serves a snapshot inside the window', () => {
    rememberSnapshot(snapshotAt(new Date(Date.now() - 5 * 60_000)));
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
    sessionStorage.setItem(SNAPSHOT_KEY, '{not json');
    expect(recallSnapshot()).toBeNull();
  });

  it('drops the stale record when the write fails', () => {
    rememberSnapshot(snapshotAt(new Date()));
    expect(sessionStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();

    sessionStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    rememberSnapshot(snapshotAt(new Date()));

    // A missing mirror only costs a sync; a half-written one could be served.
    expect(sessionStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });

  // It holds grades and messages, so it must not outlive the session.
  it('is erased on sign-out', () => {
    rememberSnapshot(snapshotAt(new Date()));
    expect(recallSnapshot()).not.toBeNull();

    clearToken();

    expect(recallSnapshot()).toBeNull();
    expect(sessionStorage.getItem(SNAPSHOT_KEY)).toBeNull();
  });
});
