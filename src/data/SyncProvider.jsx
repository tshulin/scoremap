// SyncProvider — owns the signed-in session and the synced data.
//
// Status: 'signedOut' | 'syncing' | 'ready' | 'error'. On mount, an existing
// token (page reload) triggers a background sync; a 401 from any resource
// clears the token and drops back to signedOut. Pages read data through the
// hooks below; RequireAuth (App.jsx) redirects to /login when signed out.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api.js';
import { emptySnapshot } from './snapshot.js';
import { sync as syncStudentVue } from './studentvue.js';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [data, setData] = useState(emptySnapshot);
  const [status, setStatus] = useState(api.hasToken() ? 'syncing' : 'signedOut');
  const [error, setError] = useState(null);
  // Re-arm on every mount: StrictMode's dev-only unmount/remount would
  // otherwise leave this false forever and every sync result would be dropped.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const runSync = useCallback(async (knownStudent) => {
    setStatus('syncing');
    setError(null);
    try {
      const fresh = await syncStudentVue(knownStudent);
      if (!alive.current) return fresh;
      setData(fresh);
      setStatus('ready');
      return fresh;
    } catch (e) {
      if (!alive.current) throw e;
      if (e.status === 401) {
        api.clearToken();
        setData(emptySnapshot);
        setStatus('signedOut');
      } else {
        setError(e);
        setStatus('error');
      }
      throw e;
    }
  }, []);

  // Resume the session on reload.
  useEffect(() => {
    if (api.hasToken()) runSync().catch(() => {});
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
    setData(emptySnapshot);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(() => runSync().catch(() => {}), [runSync]);

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
