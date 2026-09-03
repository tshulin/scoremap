// SyncProvider - owns the open demo and its bundled data.
//
// Status: 'signedOut' | 'syncing' | 'ready' | 'error'. On mount, a saved
// demo marker (api.js) paints the mirrored snapshot immediately and refreshes it
// animate in when the sync lands (NumberFlow, the chart sweep, the change
// ticker are all keyed on the data). A 401 clears the demo and drops back
// to signedOut; anything else keeps the cached data on screen with an error.
// Pages read data through the hooks below; RequireAuth (App.jsx) redirects to
// the landing page when signed out.
//
// refresh(scope) syncs only the named resources and merges them over the current
// snapshot, so the Refresh button on a page rebuilds only what that page shows
// instead of the whole snapshot (see sync.js).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import { emptySnapshot } from './snapshot.js';
import { ALL_RESOURCES, sync as syncSnapshot } from './sync.js';

const SyncContext = createContext(null);

// Read once per mount, not per render.
const restored = () => (api.hasDemo() ? api.recallSnapshot() : null);

// A boot sync is skipped when the mirror is at most this old - just enough to
// avoid rebuilding the same immutable sample snapshot on rapid reloads.
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
    cached ? 'ready' : api.hasDemo() ? 'syncing' : 'signedOut',
  );
  const [error, setError] = useState(null);
  // Which sync stage is in flight ('grades' | 'assignments' | 'attendance' |
  // 'documents' | 'mail' | null) - the pill narrates it live.
  const [stage, setStage] = useState(null);
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

  const runSync = useCallback(async (knownStudent, scope, { onGrades } = {}) => {
    setStatus('syncing');
    setError(null);
    try {
      const fresh = await syncSnapshot(knownStudent, {
        scope,
        previous: latest.current,
        onGrades: () => {
          if (onGrades) onGrades();
        },
        // Partial snapshots paint as they land - grades seconds before the
        // sync completes. They update the screen and the merge base only; the
        // localStorage mirror waits for the completed snapshot below.
        onUpdate: (partial) => {
          if (!alive.current) return;
          latest.current = partial;
          setData(partial);
        },
        onStage: (s) => {
          if (alive.current) setStage(s);
        },
      });
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
      setStage(null);
      return fresh;
    } catch (e) {
      if (!alive.current) throw e;
      setStage(null);
      if (e.status === 401) {
        api.clearDemoSession();
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

  // Resume on load: cached data has already painted. A recent immutable
  // sample snapshot does not need to be rebuilt on every reload.
  useEffect(() => {
    if (!api.hasDemo()) return;
    const s = initial.current.snapshot;
    const last = s && s.session ? s.session.lastUpdated : null;
    if (last && Date.now() - last.getTime() < AUTO_SYNC_MIN_AGE_MS) return;
    runSync().catch(() => {});
  }, [runSync]);

  const openDemo = useCallback(
    async (account = 'display') => {
      const student = await api.openDemo(account);
      return new Promise((resolve, reject) => {
        let settled = false;
        const settle = (fn) => (value) => {
          if (!settled) {
            settled = true;
            fn(value);
          }
        };
        runSync(student, undefined, { onGrades: settle(resolve) }).then(
          settle(resolve),
          settle(reject),
        );
      });
    },
    [runSync],
  );

  const signOut = useCallback(async () => {
    await api.closeDemo().catch(() => {});
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
    () => ({ ...data, status, stage, error, changes, openDemo, signOut, refresh }),
    [data, status, stage, error, changes, openDemo, signOut, refresh],
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
  const { status, stage, error, refresh } = useSync();
  return { status, stage, error, refresh };
};
export const useOpenDemo = () => useSync().openDemo;
export const useSignOut = () => useSync().signOut;

export function useClass(id) {
  const { classes } = useSync();
  return classes.find((c) => c.id === id) || null;
}

export function useAssignments(id) {
  const { assignmentsByClass } = useSync();
  return assignmentsByClass[id] || [];
}
