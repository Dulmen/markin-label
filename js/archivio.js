// archivio.js · ricorda etichette, PDF e foglio fra un'apertura e l'altra (IndexedDB).
// Se il browser non lo concede (navigazione privata), l'app lavora in memoria.

const NOME = 'markin', VERSIONE = 1;
let db = null;

export async function apri() {
  if (db !== null) return db;
  db = await new Promise((ok) => {
    try {
      const req = indexedDB.open(NOME, VERSIONE);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of ['file', 'etichette', 'stato']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(false);
      req.onblocked = () => ok(false);
    } catch { ok(false); }
  });
  return db;
}

function tx(store, modo, fn) {
  return apri().then((d) => d && new Promise((ok) => {
    try {
      const t = d.transaction(store, modo);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => ok(r && 'result' in r ? r.result : true);
      t.onerror = t.onabort = () => ok(null);
    } catch { ok(null); }
  }));
}

export const leggi = (store, chiave) => tx(store, 'readonly', (s) => s.get(chiave));
export const scrivi = (store, chiave, valore) => tx(store, 'readwrite', (s) => s.put(valore, chiave));
export const togli = (store, chiave) => tx(store, 'readwrite', (s) => s.delete(chiave));
export const tutti = (store) => tx(store, 'readonly', (s) => s.getAll());
export const chiavi = (store) => tx(store, 'readonly', (s) => s.getAllKeys());
