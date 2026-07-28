// SyncProvider — owns the signed-in session and the synced data.
//
// Status: 'signedOut' | 'syncing' | 'ready' | 'error'. On mount, an existing
// token (page reload) triggers a background sync; a 401 from any resource
// clears the token and drops back to signedOut. Pages read data through the
// hooks below; RequireAuth (App.jsx) redirects to /login when signed out.
//
// refresh(scope) syncs only the named resources and merges them over the current
// snapshot, so the Refresh button on a page costs one request for what that page
// shows instead of a full re-sync of everything (see studentvue.js).
//
// A reload restores the mirrored snapshot rather than re-syncing (api.js). The
// pill always shows how old the data is and Refresh is one click away, so the
// student is never shown stale data without being told.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import { emptySnapshot } from './snapshot.js';
import { sync as syncStudentVue } from './studentvue.js';

const SyncContext = createContext(null);

// Read once per mount, not per render.
const restored = () => (api.hasToken() ? api.recallSnapshot() : null);

export function SyncProvider({ children }) {
  const initial = useRef(null);
  if (initial.current === null) initial.current = { snapshot: restored() };
  const cached = initial.current.snapshot;

  const [data, setData] = useState(cached || emptySnapshot);
  const [status, setStatus] = useState(
    cached ? 'ready' : api.hasToken() ? 'syncing' : 'signedOut',
  );
  const [error, setError] = useState(null);
  // Re-arm on every mount: StrictMode's dev-only unmount/remount would
  // otherwise leave this false forever and every sync result would be dropped.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // A scoped sync merges over what the app already holds, and runSync is a
  // stable callback — so it reads the current snapshot from a ref rather than
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
      store(fresh);
      setStatus('ready');
      return fresh;
    } catch (e) {
      if (!alive.current) throw e;
      if (e.status === 401) {
        api.clearToken();
        store(emptySnapshot);
        setStatus('signedOut');
      } else {
        setError(e);
        setStatus('error');
      }
      throw e;
    }
  }, [store]);

  // Resume the session on reload — but only sync when there was nothing to
  // restore. A reload with a fresh mirror costs zero portal requests.
  useEffect(() => {
    if (api.hasToken() && !initial.current.snapshot) runSync().catch(() => {});
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
    () => ({ ...data, status, error, signIn, signOut, refresh }),
    [data, status, error, signIn, signOut, refresh],
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
