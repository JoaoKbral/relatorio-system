// IndexedDB storage for offline use (browser only): reports waiting to be sent
// ("outbox") and a per-church copy of the people list for the form.
import type { ReportInput } from "@/lib/report-schema";

const DB_NAME = "relatorio-culto-offline";
const DB_VERSION = 1;
const OUTBOX = "outbox";
const PEOPLE = "people";

export interface CachedPerson {
  id: number;
  name: string;
  roles: string[];
}

/** A report saved on the device that the server has not accepted yet. */
export interface PendingReport {
  clientId: string;
  churchId: number;
  payload: ReportInput & { clientId: string };
  createdAt: number;
  /** "error": the server rejected it (400); it needs to be fixed before it is sent again. */
  status: "pending" | "error";
  error?: string;
}

interface PeopleEntry {
  churchId: number;
  savedAt: number;
  people: CachedPerson[];
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: "clientId" }).createIndex("churchId", "churchId");
      }
      if (!db.objectStoreNames.contains(PEOPLE)) {
        db.createObjectStore(PEOPLE, { keyPath: "churchId" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab upgraded the schema: drop this connection so it can proceed.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    // Resolve on commit, not on the request: a write is only safe once committed.
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transação cancelada"));
  });
}

// ─── Outbox ─────────────────────────────────────────────────────────────────

const CHANGE_EVENT = "outbox-change";
const channel =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("relatorio-culto-outbox") : null;

function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
  channel?.postMessage("change");
}

/** Calls `listener` when the outbox changes in this tab or another one. */
export function onOutboxChange(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  channel?.addEventListener("message", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    channel?.removeEventListener("message", listener);
  };
}

/** The church's pending reports, oldest first. */
export async function listPending(churchId: number): Promise<PendingReport[]> {
  const items = await run<PendingReport[]>(OUTBOX, "readonly", (s) =>
    s.index("churchId").getAll(churchId)
  );
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getPending(clientId: string): Promise<PendingReport | undefined> {
  return run<PendingReport | undefined>(OUTBOX, "readonly", (s) => s.get(clientId));
}

export async function savePending(item: PendingReport): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.put(item));
  notifyChange();
}

export async function deletePending(clientId: string): Promise<void> {
  await run(OUTBOX, "readwrite", (s) => s.delete(clientId));
  notifyChange();
}

// ─── People cache ───────────────────────────────────────────────────────────

export async function savePeople(churchId: number, people: CachedPerson[]): Promise<void> {
  await run(PEOPLE, "readwrite", (s) => s.put({ churchId, savedAt: Date.now(), people } satisfies PeopleEntry));
}

export async function loadPeople(churchId: number): Promise<CachedPerson[] | null> {
  const entry = await run<PeopleEntry | undefined>(PEOPLE, "readonly", (s) => s.get(churchId));
  return entry?.people ?? null;
}
