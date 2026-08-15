/**
 * Injectable storage interface mirroring the localStorage subset the save
 * system needs. Production wraps real localStorage; headless tests use an
 * in-memory fake so no global/localStorage dependency leaks into node.
 */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * In-memory SaveStorage backed by a Map. Used by headless tests and anywhere
 * real localStorage is unavailable.
 */
export function createMemoryStorage(): SaveStorage {
  const store = new Map<string, string>();
  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

/**
 * Adapter wrapping the browser localStorage singleton. Should only be called
 * in a browser context where localStorage is available.
 */
export function createLocalStorage(): SaveStorage {
  return {
    getItem(key) {
      return localStorage.getItem(key);
    },
    setItem(key, value) {
      localStorage.setItem(key, value);
    },
    removeItem(key) {
      localStorage.removeItem(key);
    },
  };
}
