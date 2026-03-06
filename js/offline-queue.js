const DB_NAME = "field-reference-db";
const DB_VERSION = 1;
const STORE_NAME = "submissionQueue";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true,
        });

        store.createIndex("status", "status", { unique: false });
        store.createIndex("module", "module", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txComplete(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queueSubmission({ module, endpoint, payload }) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  store.add({
    module,
    endpoint,
    payload,
    status: "queued",
    createdAt: new Date().toISOString(),
    lastError: "",
    retryCount: 0,
  });

  await txComplete(tx);
}

export async function getQueuedSubmissions(module = null) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  if (!module) return rows;
  return rows.filter((row) => row.module === module);
}

export async function removeQueuedSubmission(id) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await txComplete(tx);
}

export async function updateQueuedSubmission(id, updates) {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);

  const existing = await new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (!existing) {
    await txComplete(tx);
    return;
  }

  store.put({
    ...existing,
    ...updates,
  });

  await txComplete(tx);
}

export async function flushQueue({ module = null, submitFn, onSuccess, onFailure } = {}) {
  if (typeof submitFn !== "function") {
    throw new Error("flushQueue requires a submitFn function.");
  }

  if (!navigator.onLine) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const queued = await getQueuedSubmissions(module);
  let sent = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      await submitFn(item);
      await removeQueuedSubmission(item.id);
      sent += 1;

      if (typeof onSuccess === "function") {
        onSuccess(item);
      }
    } catch (err) {
      failed += 1;

      await updateQueuedSubmission(item.id, {
        status: "failed",
        retryCount: (item.retryCount || 0) + 1,
        lastError: String(err),
      });

      if (typeof onFailure === "function") {
        onFailure(item, err);
      }
    }
  }

  return { sent, failed, skipped: false };
}

export async function getQueueCount(module = null) {
  const rows = await getQueuedSubmissions(module);
  return rows.length;
}