// ブラウザの中（IndexedDB）に全データを1件として保存する。使えないときは localStorage に保存する。
const DB_NAME = 'timelog';
const STORE = 'kv';
const KEY = 'data';

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  return request(req);
}

function idbBackend() {
  let db = null;
  const getDb = async () => (db ??= await openDb());
  return {
    async load() {
      const d = await getDb();
      return (await request(d.transaction(STORE, 'readonly').objectStore(STORE).get(KEY))) ?? null;
    },
    async save(data) {
      const d = await getDb();
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, KEY);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}

function localStorageBackend() {
  const key = 'timelog-data';
  return {
    load: async () => {
      const text = localStorage.getItem(key);
      return text ? JSON.parse(text) : null;
    },
    save: async (data) => localStorage.setItem(key, JSON.stringify(data)),
  };
}

/** 保存先を選ぶ。IndexedDB が開けなければ localStorage を使う */
export async function browserBackend() {
  try {
    const backend = idbBackend();
    await backend.load();
    return backend;
  } catch {
    return localStorageBackend();
  }
}
