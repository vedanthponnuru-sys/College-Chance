export const DOC_TYPES = [
  "Transcript",
  "Resume",
  "Brag Sheet",
  "Essay",
  "Rec Letter",
  "Award",
  "Other"
];

export const CHECKLIST_DOC_TYPES = DOC_TYPES.filter((type) => type !== "Other");

const DB_NAME = "collegeChanceDocs";
const DB_VERSION = 1;
const STORE_NAME = "documents";

const ALLOWED_MIME_PREFIXES = ["image/"];
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export function isAllowedFileType(file) {
  if (!file || !file.type) return false;
  if (ALLOWED_MIME_TYPES.includes(file.type)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix));
}

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("This browser doesn't support IndexedDB."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

export async function addDocument({ file, docType, collegeIds }) {
  const db = await openDb();
  const record = {
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    docType,
    collegeIds: collegeIds || [],
    blob: file,
    uploadedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllDocuments() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const docs = request.result || [];
      docs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      resolve(docs);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateDocumentLinks(id, collegeIds) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject(new Error("Document not found."));
        return;
      }
      record.collegeIds = collegeIds;
      const putRequest = store.put(record);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function deleteDocument(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function getDocumentsForCollege(allDocuments, collegeId) {
  return allDocuments.filter((doc) => doc.collegeIds.includes(collegeId));
}

export function downloadDocument(doc) {
  const url = URL.createObjectURL(doc.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
