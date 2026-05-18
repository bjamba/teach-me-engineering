// A small IndexedDB wrapper for storing recording Blobs.
//
// IndexedDB has a famously verbose API; this 70-line wrapper covers the three
// operations we need (save, list, delete). For more comprehensive use, the
// `idb` library on npm wraps the API in promises with less boilerplate.

import { browser } from '$app/environment';
import type { Recording } from './engine.svelte';

const DB_NAME = 'svelte-daw';
const STORE = 'recordings';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!browser) {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSave(recording: Recording): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(recording);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbList(): Promise<Recording[]> {
  if (!browser) return [];
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const list = (req.result as Recording[]) ?? [];
      // Newest first.
      list.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
