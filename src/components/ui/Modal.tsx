import { useEffect } from "react"
import { createPortal } from "react-dom"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl"
  footer?: React.ReactNode
}

const widths = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-4xl",
}

export default function Modal({ open, onClose, title, children, maxWidth = "md", footer }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handler)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handler)
    }
  }, [open, onClose])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: "rgba(60,60,59,0.68)", backdropFilter: "blur(3px)" }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Modal"}
        className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${widths[maxWidth]} flex flex-col max-h-[calc(100dvh-env(safe-area-inset-top))] sm:max-h-[90vh] min-w-0`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex-shrink-0 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-carbon-20">
            <h2 className="font-bold text-carbon text-base sm:text-lg pr-3">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-carbon-60 hover:bg-neutral transition-fast flex-shrink-0"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 sm:py-5">
          {children}
        </div>

        {footer && (
          <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-carbon-20 flex flex-col-reverse sm:flex-row flex-wrap gap-2 sm:gap-3 sm:justify-end bg-white rounded-b-2xl [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
