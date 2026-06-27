const DB_NAME = 'trainer-db';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

const cache = new Map();
let db = null;
const pending = new Set();

const LEGACY_KEYS = ['trainer_v1', 'trainer_github_token', 'trainer_github_user'];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(key, value) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(value, key);
  const write = new Promise((resolve) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  pending.add(write);
  write.finally(() => pending.delete(write));
  return write;
}

export async function flush() {
  await Promise.all([...pending]);
}

function idbDelete(key) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(key);
}

function idbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const entries = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push([cursor.key, cursor.value]);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function init() {
  db = await openDB();
  const entries = await idbGetAll();

  if (entries.length === 0) {
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
        cache.set(key, value);
        idbPut(key, value);
        localStorage.removeItem(key);
      }
    }
  } else {
    for (const [key, value] of entries) {
      cache.set(key, value);
    }
  }
}

export function get(key) {
  return cache.get(key) ?? null;
}

export function set(key, value) {
  cache.set(key, value);
  if (db) idbPut(key, value);
}

export function remove(key) {
  cache.delete(key);
  if (db) idbDelete(key);
}

export function clearAll() {
  cache.clear();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
}
