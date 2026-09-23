type StoredImportFile = {
  key: string
  name: string
  type: string
  lastModified: number
  blob: Blob
  savedAt: number
}

const DB_NAME = "invest-rs-import-drafts"
const STORE_NAME = "files"
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB indisponível neste navegador."))
      return
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir o armazenamento local."))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = operation(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error("Falha ao acessar o armazenamento local."))
      transaction.onabort = () => reject(transaction.error || new Error("A operação local foi cancelada."))
    })
  } finally {
    database.close()
  }
}

export async function saveImportFileDraft(key: string, file: File) {
  const record: StoredImportFile = {
    key,
    name: file.name,
    type: file.type,
    lastModified: file.lastModified,
    blob: file,
    savedAt: Date.now(),
  }
  await withStore("readwrite", (store) => store.put(record))
}

export async function loadImportFileDraft(key: string): Promise<File | null> {
  const record = await withStore<StoredImportFile | undefined>("readonly", (store) => store.get(key))
  if (!record?.blob) return null
  return new File([record.blob], record.name, {
    type: record.type || record.blob.type,
    lastModified: record.lastModified || record.savedAt,
  })
}

export async function clearImportFileDraft(key: string) {
  await withStore("readwrite", (store) => store.delete(key))
}
