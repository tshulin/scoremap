// The grade index is a session-scoped cache: one anonymous localStorage key,
// erased by clearGradeIndex when the sign-in changes, so letters learned from
// one account's classes can never label another's.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORE_KEY = 'grademax-grade-index';
const CALC = { id: 'ap-calculus-bc', grade: 'A', pct: 96, categories: [] };

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get keys() {
      return [...map.keys()];
    },
  };
}

// The namespaced-layout sweep runs at import, so each test loads the module
// fresh against its own storage.
async function loadStore(seed) {
  const storage = fakeStorage(seed);
  const proxy = new Proxy(storage, {
    ownKeys: () => storage.keys,
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
  globalThis.localStorage = proxy;
  vi.resetModules();
  return { store: await import('./gradeIndexStore.js'), storage };
}

beforeEach(() => vi.resetModules());

describe('grade index cache', () => {
  it('harvests into the single cache key and clears with the session', async () => {
    const { store, storage } = await loadStore();
    store.harvestFromClasses([CALC]);
    expect(JSON.parse(storage.getItem(STORE_KEY))['ap-calculus-bc'].observations).toEqual([
      { pct: 96, letter: 'A' },
    ]);

    store.clearGradeIndex();
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  it('sweeps the briefly-shipped per-account keys, keeping a real account’s data', async () => {
    const entry = JSON.stringify({ chemistry: { observations: [], overrides: { A: 90 } } });
    const { storage } = await loadStore({
      [`${STORE_KEY}:school.org|ada`]: entry,
      [`${STORE_KEY}:test`]: JSON.stringify({ chemistry: { observations: [], overrides: {} } }),
    });

    expect(storage.getItem(STORE_KEY)).toBe(entry);
    expect(storage.getItem(`${STORE_KEY}:school.org|ada`)).toBeNull();
    expect(storage.getItem(`${STORE_KEY}:test`)).toBeNull();
  });
});
