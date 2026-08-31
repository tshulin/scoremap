import React from 'react';

export const PROFILE_PREFERENCES_KEY = 'scoremap-profile-preferences-v1';

export const DEFAULT_PROFILE_PREFERENCES = {
  showMaxMinGrade: true,
  showGradeIndex: true,
  showOverview: true,
  showTargetCalculator: true,
};

const PREFERENCES_CHANGED_EVENT = 'scoremap-profile-preferences-changed';

export function readProfilePreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_PREFERENCES_KEY));
    if (!saved || typeof saved !== 'object') return DEFAULT_PROFILE_PREFERENCES;
    return {
      showMaxMinGrade: typeof saved.showMaxMinGrade === 'boolean'
        ? saved.showMaxMinGrade
        : DEFAULT_PROFILE_PREFERENCES.showMaxMinGrade,
      showGradeIndex: typeof saved.showGradeIndex === 'boolean'
        ? saved.showGradeIndex
        : DEFAULT_PROFILE_PREFERENCES.showGradeIndex,
      showOverview: typeof saved.showOverview === 'boolean'
        ? saved.showOverview
        : DEFAULT_PROFILE_PREFERENCES.showOverview,
      showTargetCalculator: typeof saved.showTargetCalculator === 'boolean'
        ? saved.showTargetCalculator
        : DEFAULT_PROFILE_PREFERENCES.showTargetCalculator,
    };
  } catch {
    return DEFAULT_PROFILE_PREFERENCES;
  }
}

export function useProfilePreferences() {
  const [preferences, setPreferences] = React.useState(readProfilePreferences);

  React.useEffect(() => {
    const sync = (event) => {
      if (event?.type === PREFERENCES_CHANGED_EVENT && event.detail) {
        setPreferences(event.detail);
        return;
      }
      if (!event || event.type !== 'storage' || event.key === PROFILE_PREFERENCES_KEY) {
        setPreferences(readProfilePreferences());
      }
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setPreference = React.useCallback((key, enabled) => {
    const next = { ...readProfilePreferences(), [key]: Boolean(enabled) };
    try {
      localStorage.setItem(PROFILE_PREFERENCES_KEY, JSON.stringify(next));
    } catch {
      // The setting still works for this session when storage is unavailable.
    }
    setPreferences(next);
    window.dispatchEvent(new CustomEvent(PREFERENCES_CHANGED_EVENT, { detail: next }));
  }, []);

  return { preferences, setPreference };
}
