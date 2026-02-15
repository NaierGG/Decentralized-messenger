const DB_NAME = 'veil_messenger_db';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const APP_STATE_KEY = 'app_state_v3';
export const LEGACY_STORAGE_KEY = 'veil_state_v2';
const FALLBACK_STORAGE_KEY = 'veil_state_fallback_v3';
const hasIndexedDb = typeof indexedDB !== 'undefined';

const openDb = () =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });

const withStore = async (mode, callback) => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);

    callback(store, resolve, reject);

    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.oncomplete = () => db.close();
  });
};

export const normalizeState = (raw) => ({
  profile: raw?.profile || null,
  peers: Array.isArray(raw?.peers) ? raw.peers : [],
  pendingConnections: Array.isArray(raw?.pendingConnections)
    ? raw.pendingConnections
    : [],
  messagesByPeer:
    raw?.messagesByPeer && typeof raw.messagesByPeer === 'object'
      ? raw.messagesByPeer
      : {}
});

export const readLegacyState = () => {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const getPersistedState = async () =>
  (hasIndexedDb
    ? withStore('readonly', (store, resolve, reject) => {
      const request = store.get(APP_STATE_KEY);
      request.onsuccess = () => resolve(request.result ? normalizeState(request.result) : null);
      request.onerror = () => reject(request.error || new Error('Failed to read app state'));
    })
    : (() => {
      try {
        const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
        return Promise.resolve(raw ? normalizeState(JSON.parse(raw)) : null);
      } catch {
        return Promise.resolve(null);
      }
    })());

export const setPersistedState = async (state) =>
  (hasIndexedDb
    ? withStore('readwrite', (store, resolve, reject) => {
      const request = store.put(normalizeState(state), APP_STATE_KEY);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error('Failed to write app state'));
    })
    : (() => {
      try {
        localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(normalizeState(state)));
        return Promise.resolve(true);
      } catch {
        return Promise.reject(new Error('Failed to write app state'));
      }
    })());

export const clearLegacyState = () => {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    return;
  }
};

export const makeBackupPayload = (state) => ({
  version: 1,
  exportedAt: new Date().toISOString(),
  ...normalizeState(state)
});

export const parseBackupPayload = (raw) => normalizeState(raw);
