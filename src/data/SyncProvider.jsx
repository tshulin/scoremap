// SyncProvider - owns the signed-in session and the synced data.
//
// Status: 'signedOut' | 'syncing' | 'ready' | 'error'. On mount, a saved
// sign-in (api.js) paints the mirrored snapshot immediately and refreshes it
// with a background sync - the auto sign-in: stale grades first, fresh grades
// animate in when the sync lands (NumberFlow, the chart sweep, the change
// ticker are all keyed on the data). A 401 clears the sign-in and drops back
// to signedOut; anything else keeps the cached data on screen with an error.
// Pages read data through the hooks below; RequireAuth (App.jsx) redirects to
// /login when signed out.
//
// refresh(scope) syncs only the named resources and merges them over the current
// snapshot, so the Refresh button on a page costs one request for what that page
// shows instead of a full re-sync of everything (see studentvue.js).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import { emptySnapshot } from './snapshot.js';
import { sync as syncStudentVue } from './studentvue.js';

const SyncContext = createContext(null);

// Read once per mount, not per render.
const restored = () => (api.hasToken() ? api.recallSnapshot() : null);

// A boot sync is skipped when the mirror is at most this old - just enough to
// keep held-down F5 from burning the relay's per-minute connection budget;
// any human-paced revisit refreshes.
const AUTO_SYNC_MIN_AGE_MS = 15_000;

// Per-class grade movement between the previous completed sync and the
// latest one: [{ id, name, delta }] for every class whose percentage moved.
// `baseline` is false until a second sync exists to compare against.
function diffClasses(prevClasses, freshClasses) {
  const prevById = new Map(prevClasses.map((c) => [c.id, c.pct]));
  return freshClasses
    .filter((c) => c.pct != null && prevById.get(c.id) != null)
    .map((c) => ({ id: c.id, name: c.name, delta: Math.round((c.pct - prevById.get(c.id)) * 100) / 100 }))
    .filter((c) => c.delta !== 0);
}

export function SyncProvider({ children }) {
  const initial = useRef(null);
  if (initial.current === null) initial.current = { snapshot: restored() };
  const cached = initial.current.snapshot;

  const [data, setData] = useState(cached || emptySnapshot);
  const [status, setStatus] = useState(
    cached ? 'ready' : api.hasToken() ? 'syncing' : 'signedOut',
  );
  const [error, setError] = useState(null);
  const [changes, setChanges] = useState({ list: [], baseline: false });
  // Seeded from the restored mirror so the first refresh after a reload can
  // still report movement against what the student was last shown.
  const prevClassesRef = useRef(cached ? cached.classes : null);
  // Re-arm on every mount: StrictMode's dev-only unmount/remount would
  // otherwise leave this false forever and every sync result would be dropped.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // A scoped sync merges over what the app already holds, and runSync is a
  // stable callback - so it reads the current snapshot from a ref rather than
  // closing over a stale `data`.
  const latest = useRef(cached || emptySnapshot);
  const store = useCallback((snapshot) => {
    latest.current = snapshot;
    api.rememberSnapshot(snapshot);
    setData(snapshot);
  }, []);

  const runSync = useCallback(async (knownStudent, scope) => {
    setStatus('syncing');
    setError(null);
    try {
      const fresh = await syncStudentVue(knownStudent, { scope, previous: latest.current });
      if (!alive.current) return fresh;
      // Deltas only when this sync actually re-fetched the gradebook - a
      // mail/attendance-scoped refresh reuses the merged classes untouched
      // and must not overwrite the last real comparison.
      if (!scope || scope.includes('gradebook')) {
        const prev = prevClassesRef.current;
        setChanges(prev ? { list: diffClasses(prev, fresh.classes), baseline: true } : { list: [], baseline: false });
        prevClassesRef.current = fresh.classes;
      }
      store(fresh);
      setStatus('ready');
      return fresh;
    } catch (e) {
      if (!alive.current) throw e;
      if (e.status === 401) {
        api.clearToken();
        prevClassesRef.current = null;
        setChanges({ list: [], baseline: false });
        store(emptySnapshot);
        setStatus('signedOut');
      } else {
        setError(e);
        setStatus('error');
      }
      throw e;
    }
  }, [store]);

  // Resume on load: cached data has already painted (status 'ready'); a saved
  // sign-in then refreshes it in the background. A snapshot younger than a
  // minute is left alone so rapid reloads don't chew through the relay's
  // per-IP connection budget for nothing.
  useEffect(() => {
    if (!api.hasToken()) return;
    const s = initial.current.snapshot;
    const last = s && s.session ? s.session.lastUpdated : null;
    if (last && Date.now() - last.getTime() < AUTO_SYNC_MIN_AGE_MS) return;
    runSync().catch(() => {});
  }, [runSync]);

  const signIn = useCallback(
    async (credentials) => {
      const student = await api.login(credentials);
      return runSync(student);
    },
    [runSync],
  );

  const signOut = useCallback(async () => {
    await api.logout().catch(() => {});
    if (!alive.current) return;
    prevClassesRef.current = null;
    setChanges({ list: [], baseline: false });
    store(emptySnapshot);
    setStatus('signedOut');
  }, [store]);

  // scope: a resource name, a list of them, or nothing for a full sync.
  const refresh = useCallback(
    (scope) => {
      const only = scope === undefined ? undefined : Array.isArray(scope) ? scope : [scope];
      return runSync(undefined, only).catch(() => {});
    },
    [runSync],
  );

  const value = useMemo(
    () => ({ ...data, status, error, changes, signIn, signOut, refresh }),
    [data, status, error, changes, signIn, signOut, refresh],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within <SyncProvider>');
  return ctx;
}

export const useSession = () => useSync().session;
export const useClasses = () => useSync().classes;
export const useSemesters = () => useSync().semesters;
// { list: [{ id, name, delta }], baseline } - grade movement since the
// previous sync; baseline is false until there has been a second sync.
export const useSyncChanges = () => useSync().changes;
export const useAttendance = () => useSync().attendance;
export const useDocuments = () => useSync().documents;
export const useMail = () => useSync().mail;
export const useSyncMeta = () => useSync().meta;
export const useSyncStatus = () => {
  const { status, error, refresh } = useSync();
  return { status, error, refresh };
};
export const useSignIn = () => useSync().signIn;
export const useSignOut = () => useSync().signOut;

export function useClass(id) {
  const { classes } = useSync();
  return classes.find((c) => c.id === id) || null;
}

export function useAssignments(id) {
  const { assignmentsByClass } = useSync();
  return assignmentsByClass[id] || [];
}
