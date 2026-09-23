import { useEffect, useMemo } from "react"

interface Props {
  file: File | null
  currentUrl?: string
  removeCurrent?: boolean
  onFileChange: (file: File | null) => void
  onRemoveCurrent?: () => void
  error?: string
}

const MAX_SIZE = 8 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function validateEventCard(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Use uma imagem JPG, PNG ou WebP."
  }
  if (file.size > MAX_SIZE) {
    return "O card deve ter no máximo 8 MB."
  }
  return null
}

export default function EventCardField({
  file,
  currentUrl,
  removeCurrent = false,
  onFileChange,
  onRemoveCurrent,
  error,
}: Props) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const displayUrl = previewUrl || (!removeCurrent ? currentUrl : undefined)

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-semibold text-carbon-60 mb-1.5">
          Card do evento
        </span>
        <span className="flex items-center justify-between gap-4 rounded-xl border-2 border-dashed border-carbon-20 bg-neutral/50 px-5 py-5 cursor-pointer hover:border-green/50 transition-fast">
          <span>
            <strong className="block text-sm text-carbon">
              {file?.name || (currentUrl && !removeCurrent ? "Card atual" : "Selecionar imagem")}
            </strong>
            <span className="block text-xs text-carbon-60 mt-1">
              JPG, PNG ou WebP · até 8 MB
            </span>
          </span>
          <span className="px-4 py-2 rounded-lg bg-white border border-carbon-20 text-sm font-bold text-green whitespace-nowrap">
            Escolher arquivo
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
        </span>
      </label>

      {error && (
        <p className="text-xs font-semibold text-magenta" role="alert">
          {error}
        </p>
      )}

      {displayUrl && (
        <div className="rounded-xl border border-carbon-20 bg-neutral/40 p-3">
          <img
            src={displayUrl}
            alt="Pré-visualização do card do evento"
            className="w-full max-h-80 object-contain rounded-lg bg-white"
          />
          <div className="mt-3 flex justify-end gap-2">
            {file && (
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-carbon-60 hover:bg-white"
              >
                Remover novo arquivo
              </button>
            )}
            {!file && currentUrl && onRemoveCurrent && (
              <button
                type="button"
                onClick={onRemoveCurrent}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-magenta hover:bg-light-magenta"
              >
                Remover card atual
              </button>
            )}
          </div>
        </div>
      )}

      {removeCurrent && !file && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-light-magenta px-3 py-2.5">
          <span className="text-xs font-semibold text-magenta">
            O card atual será removido ao salvar.
          </span>
          <button
            type="button"
            onClick={onRemoveCurrent}
            className="text-xs font-bold text-magenta underline"
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  )
}
