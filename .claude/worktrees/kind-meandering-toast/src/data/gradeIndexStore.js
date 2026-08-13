// Per-class letter cutoffs, learned from the portal's own letters. The portal
// applies each teacher's scale server-side and only shows results, so we
// OBSERVE (percentage, letter) pairs on every successful sync — the course
// mark and each category's — and keep the extremes per letter. Each new synced
// grade tightens the inferred scale automatically; student overrides live in
// the same store and win over everything (src/calc/letters does the math).
// localStorage, keyed by class id; in-memory fallback when storage is blocked.
import { useMemo, useSyncExternalStore } from 'react';
import { inferScale, mergeObservations } from '../calc/index';

const STORE_KEY = 'grademax-grade-index';

let memory = null; // used only when localStorage is unavailable
const listeners = new Set();
let version = 0;

function readAll() {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    memory = {};
    return memory;
  }
}

function writeAll(all) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch {
    memory = all;
  }
  version += 1;
  for (const listener of listeners) listener();
}

const entryFor = (all, classId) => all[classId] ?? { observations: [], overrides: {} };

// Called after every successful gradebook sync (and by demo mode) with the
// mapped classes. Defensive per the plan: empty letters and zero-possible
// categories are skipped; mergeObservations keeps one observation per letter
// (the lowest %, the only value inference uses) and drops unknown letters.
export function harvestFromClasses(classes) {
  const all = readAll();
  let changed = false;
  for (const cls of classes ?? []) {
    const incoming = [];
    if (cls.grade && cls.grade !== '—' && cls.pct != null) {
      incoming.push({ pct: cls.pct, letter: cls.grade });
    }
    for (const cat of cls.categories ?? []) {
      if (!cat.letter || !(cat.pointsPossible > 0)) continue;
      incoming.push({
        pct: Math.round((cat.pointsEarned / cat.pointsPossible) * 10000) / 100,
        letter: cat.letter,
      });
    }
    if (incoming.length === 0) continue;
    const entry = entryFor(all, cls.id);
    const merged = mergeObservations(entry.observations, incoming);
    if (JSON.stringify(merged) !== JSON.stringify(entry.observations)) {
      all[cls.id] = { ...entry, observations: merged };
      changed = true;
    }
  }
  if (changed) writeAll(all);
}

export function setOverride(classId, letter, lowerBound) {
  const all = readAll();
  const entry = entryFor(all, classId);
  all[classId] = { ...entry, overrides: { ...entry.overrides, [letter]: lowerBound } };
  writeAll(all);
}

export function clearOverride(classId, letter) {
  const all = readAll();
  const entry = entryFor(all, classId);
  if (!entry.overrides || !(letter in entry.overrides)) return;
  const overrides = { ...entry.overrides };
  delete overrides[letter];
  all[classId] = { ...entry, overrides };
  writeAll(all);
}

export function resetOverrides(classId) {
  const all = readAll();
  const entry = entryFor(all, classId);
  if (!entry.overrides || Object.keys(entry.overrides).length === 0) return;
  all[classId] = { ...entry, overrides: {} };
  writeAll(all);
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// The class's inferred scale (observations pulled below the defaults where
// proven, monotonic, overrides on top), live across tabs and edits.
export function useGradeIndex(classId) {
  const v = useSyncExternalStore(subscribe, () => version);
  return useMemo(() => {
    const entry = entryFor(readAll(), classId);
    const overrides = entry.overrides ?? {};
    return {
      observations: entry.observations,
      overrides,
      scale: inferScale(entry.observations, overrides),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, v]);
}
