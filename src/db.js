// Banco do próprio celular (IndexedDB): projetos, áudio das tomadas e vídeos.
const NAME = 'estudio', VER = 1;
let dbp = null;

function open() {
  return dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const n of ['proj', 'pcm', 'vid']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    let out;
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export const put = (store, key, val) => run(store, 'readwrite', s => s.put(val, key));
export const get = (store, key) => run(store, 'readonly', s => s.get(key));
export const del = (store, key) => run(store, 'readwrite', s => s.delete(key));
export const all = store => run(store, 'readonly', s => s.getAll());
