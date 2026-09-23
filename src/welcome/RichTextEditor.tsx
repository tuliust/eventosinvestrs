import { useEffect, useRef, useState } from "react"
import { sanitizeWelcomeRichHtml } from "./welcomeGuide"

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
}

type ToolbarPosition = { top: number; left: number }

export default function RichTextEditor({ value, onChange, label }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<ToolbarPosition | null>(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    if (editor.innerHTML !== value) editor.innerHTML = value
  }, [value])

  function emit() {
    const editor = editorRef.current
    if (!editor) return
    onChange(sanitizeWelcomeRichHtml(editor.innerHTML))
  }

  function updateToolbar() {
    const editor = editorRef.current
    const wrapper = wrapperRef.current
    const selection = window.getSelection()
    if (!editor || !wrapper || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setToolbar(null)
      return
    }

    const range = selection.getRangeAt(0)
    const common = range.commonAncestorContainer
    const commonElement = common.nodeType === Node.ELEMENT_NODE ? common : common.parentNode
    if (!commonElement || !editor.contains(commonElement)) {
      setToolbar(null)
      return
    }

    const rangeRect = range.getBoundingClientRect()
    const wrapperRect = wrapper.getBoundingClientRect()
    const toolbarWidth = 132
    const rawLeft = rangeRect.left - wrapperRect.left + rangeRect.width / 2 - toolbarWidth / 2
    setToolbar({
      top: Math.max(4, rangeRect.top - wrapperRect.top - 42),
      left: Math.max(4, Math.min(rawLeft, wrapperRect.width - toolbarWidth - 4)),
    })
  }

  function format(command: "bold" | "italic" | "underline") {
    document.execCommand(command, false)
    emit()
    requestAnimationFrame(updateToolbar)
  }

  return (
    <div className="welcome-rich-wrapper" ref={wrapperRef}>
      {toolbar && (
        <div className="welcome-rich-toolbar" style={{ top: toolbar.top, left: toolbar.left }}>
          <button type="button" aria-label="Negrito" title="Negrito" onMouseDown={(event) => { event.preventDefault(); format("bold") }}><strong>B</strong></button>
          <button type="button" aria-label="Itálico" title="Itálico" onMouseDown={(event) => { event.preventDefault(); format("italic") }}><em>I</em></button>
          <button type="button" aria-label="Sublinhado" title="Sublinhado" onMouseDown={(event) => { event.preventDefault(); format("underline") }}><u>U</u></button>
        </div>
      )}
      <div
        ref={editorRef}
        className="welcome-rich-editor"
        contentEditable
        suppressContentEditableWarning
        aria-label={label}
        dangerouslySetInnerHTML={{ __html: value }}
        onInput={emit}
        onMouseUp={updateToolbar}
        onKeyUp={updateToolbar}
        onFocus={updateToolbar}
        onBlur={() => { emit(); setToolbar(null) }}
        onPaste={(event) => {
          event.preventDefault()
          const text = event.clipboardData.getData("text/plain")
          document.execCommand("insertText", false, text)
          emit()
        }}
      />
    </div>
  )
}
