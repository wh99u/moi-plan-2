import { uid } from './ids';

const DB = 'planner-images';
const STORE = 'images';

interface Stored {
  type: string;
  buf: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = op(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function imagesAvailable() {
  try {
    await db();
    return true;
  } catch {
    return false;
  }
}

/** Stored as bytes + type: Blobs inside IndexedDB were flaky on older iOS. */
export async function putImage(blob: Blob): Promise<string> {
  const id = uid();
  const value: Stored = { type: blob.type, buf: await blob.arrayBuffer() };
  await run('readwrite', (s) => s.put(value, id));
  return id;
}

/** A picture that came from another device, under the id it has there. */
export async function putImageAs(id: string, blob: Blob): Promise<void> {
  const value: Stored = { type: blob.type, buf: await blob.arrayBuffer() };
  await run('readwrite', (s) => s.put(value, id));
}

export async function hasImage(id: string): Promise<boolean> {
  return (await run('readonly', (s) => s.count(id))) > 0;
}

const changed = new Set<() => void>();
/** New pictures have arrived: whatever is waiting for one looks again. */
export const imagesChanged = () => changed.forEach((fn) => fn());
export const onImagesChanged = (fn: () => void) => {
  changed.add(fn);
  return () => changed.delete(fn);
};

export async function getImageBlob(id: string): Promise<Blob | null> {
  const v = (await run('readonly', (s) => s.get(id))) as Stored | undefined;
  return v ? new Blob([v.buf], { type: v.type }) : null;
}

const urls = new Map<string, string>();

export async function getImageUrl(id: string): Promise<string | null> {
  const cached = urls.get(id);
  if (cached) return cached;
  const blob = await getImageBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export async function deleteImage(id: string): Promise<void> {
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  await run('readwrite', (s) => s.delete(id));
}
