import React from 'react';
import { displayCourseName } from '../lib/courseNames.js';

export const COURSE_NAME_OVERRIDES_KEY = 'scoremap-course-name-overrides-v1';

const COURSE_NAMES_CHANGED_EVENT = 'scoremap-course-names-changed';
let memoryOverrides = {};

const cleanOverrides = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([id, name]) => id && typeof name === 'string' && name.trim())
      .map(([id, name]) => [id, name.trim().slice(0, 80)]),
  );
};

export function readCourseNameOverrides() {
  try {
    memoryOverrides = cleanOverrides(JSON.parse(localStorage.getItem(COURSE_NAME_OVERRIDES_KEY)));
    return memoryOverrides;
  } catch {
    return memoryOverrides;
  }
}

export function courseDisplayName(course, overrides = {}) {
  const id = course?.id == null ? '' : String(course.id);
  const customName = id && typeof overrides[id] === 'string' ? overrides[id].trim() : '';
  return customName || displayCourseName(course?.name);
}

export function useCourseNameOverrides() {
  const [overrides, setOverrides] = React.useState(readCourseNameOverrides);

  React.useEffect(() => {
    const sync = (event) => {
      if (event?.type === COURSE_NAMES_CHANGED_EVENT && event.detail) {
        setOverrides(event.detail);
        return;
      }
      if (!event || event.type !== 'storage' || event.key === COURSE_NAME_OVERRIDES_KEY) {
        setOverrides(readCourseNameOverrides());
      }
    };
    window.addEventListener(COURSE_NAMES_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(COURSE_NAMES_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const store = React.useCallback((next) => {
    const cleaned = cleanOverrides(next);
    memoryOverrides = cleaned;
    try {
      localStorage.setItem(COURSE_NAME_OVERRIDES_KEY, JSON.stringify(cleaned));
    } catch {
      // The custom names still work for this session when storage is unavailable.
    }
    setOverrides(cleaned);
    window.dispatchEvent(new CustomEvent(COURSE_NAMES_CHANGED_EVENT, { detail: cleaned }));
  }, []);

  const renameCourse = React.useCallback((courseId, name) => {
    const id = courseId == null ? '' : String(courseId);
    const customName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
    if (!id || !customName) return;
    store({ ...readCourseNameOverrides(), [id]: customName });
  }, [store]);

  const resetCourseName = React.useCallback((courseId) => {
    const id = courseId == null ? '' : String(courseId);
    if (!id) return;
    const next = { ...readCourseNameOverrides() };
    delete next[id];
    store(next);
  }, [store]);

  return { overrides, renameCourse, resetCourseName };
}
