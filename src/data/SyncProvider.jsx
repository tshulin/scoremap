// SyncProvider — makes the StudentVUE-synced snapshot available to the app.
//
// The provider shows the cached snapshot immediately (no loading flicker — the
// design has none) and re-syncs in the background, which is exactly what the
// "Last updated … · Refresh" pill communicates. Pages read the data through the
// hooks below instead of hardcoded arrays.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { snapshot as initialSnapshot } from './snapshot.js';
import { sync as syncStudentVue } from './studentvue.js';

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [data, setData] = useState(initialSnapshot);

  // Background refresh from the sync layer on mount.
  useEffect(() => {
    let alive = true;
    syncStudentVue().then((fresh) => {
      if (alive) setData(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Sign in / re-sync against a StudentVUE domain (used by the login flow).
  const signIn = useCallback(async (credentials) => {
    const fresh = await syncStudentVue(credentials);
    setData(fresh);
    return fresh;
  }, []);

  const value = useMemo(() => ({ ...data, signIn }), [data, signIn]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within <SyncProvider>');
  return ctx;
}

export const useSession = () => useSync().session;
export const useClasses = () => useSync().classes;
export const useSignIn = () => useSync().signIn;

export function useClass(id) {
  const { classes } = useSync();
  return classes.find((c) => c.id === id) || null;
}

export function useAssignments(id) {
  const { assignmentsByClass } = useSync();
  return assignmentsByClass[id] || assignmentsByClass.__default || [];
}

export function useGradeHistory(id) {
  const { historyByClass } = useSync();
  return historyByClass[id] || historyByClass.__default || { dates: [], values: [] };
}
