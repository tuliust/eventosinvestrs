type DraftEnvelope<T> = {
  version: 1
  savedAt: string
  data: T
}

export function loadDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftEnvelope<T>
    if (parsed?.version !== 1 || !parsed.data) return null
    return parsed.data
  } catch {
    return null
  }
}

export function saveDraft<T>(key: string, data: T) {
  if (typeof window === "undefined") return
  try {
    const envelope: DraftEnvelope<T> = {
      version: 1,
      savedAt: new Date().toISOString(),
      data,
    }
    window.localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // Falha de armazenamento local não deve interromper o preenchimento do formulário.
  }
}

export function clearDraft(key: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Sem efeito colateral para o fluxo principal.
  }
}
