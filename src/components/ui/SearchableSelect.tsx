import { useEffect, useMemo, useRef, useState } from "react"

export interface SelectOption {
  value: string
  label: string
  group?: string
}

interface SearchableSelectProps {
  id: string
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

interface MultiSearchableSelectProps {
  id: string
  label: string
  values: string[]
  options: SelectOption[]
  onChange: (values: string[]) => void
  placeholder?: string
}

const fieldClass =
  "w-full rounded-xl border border-carbon-20 bg-white px-3.5 py-2.5 text-sm text-carbon focus:border-green focus:outline-none focus:ring-2 focus:ring-green/20 disabled:bg-neutral disabled:text-carbon-40"

export function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar",
  disabled = false,
}: SearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return options
    return options.filter((option) =>
      `${option.group || ""} ${option.label}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    )
  }, [options, query])

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-carbon-60">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          disabled={disabled}
          value={open ? query : selected?.label || ""}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true)
            setActiveIndex(0)
          }}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault()
              setOpen(true)
              setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
            } else if (event.key === "ArrowUp") {
              event.preventDefault()
              setActiveIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === "Enter" && open && filtered[activeIndex]) {
              event.preventDefault()
              onChange(filtered[activeIndex].value)
              setOpen(false)
            } else if (event.key === "Escape") {
              setOpen(false)
            }
          }}
          className={`${fieldClass} pr-16`}
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label={`Limpar ${label}`}
            onClick={() => onChange("")}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-1 text-carbon-40 hover:text-carbon"
          >
            ×
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Abrir opções de ${label}`}
          onClick={() => setOpen((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-carbon-40 disabled:opacity-30"
        >
          ▾
        </button>
      </div>

      {open && !disabled && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-40 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-carbon-20 bg-white p-1.5 shadow-xl"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-carbon-60">Nenhuma opção encontrada.</p>
          ) : (
            filtered.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs transition-fast ${
                  index === activeIndex ? "bg-neutral" : "hover:bg-neutral"
                } ${option.value === value ? "font-bold text-green" : "text-carbon"}`}
              >
                {option.group && (
                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-carbon-40">
                    {option.group}
                  </span>
                )}
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function MultiSearchableSelect({
  id,
  label,
  values,
  options,
  onChange,
  placeholder = "Selecionar",
}: MultiSearchableSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    if (!normalized) return options
    return options.filter((option) =>
      option.label.toLocaleLowerCase("pt-BR").includes(normalized),
    )
  }, [options, query])

  return (
    <div ref={wrapperRef} className="relative">
      <label id={`${id}-label`} className="mb-1.5 block text-xs font-semibold text-carbon-60">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center justify-between text-left`}
      >
        <span className={values.length ? "text-carbon" : "text-carbon-40"}>
          {values.length ? `${values.length} selecionada${values.length > 1 ? "s" : ""}` : placeholder}
        </span>
        <span className="text-carbon-40">▾</span>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-xl border border-carbon-20 bg-white p-2 shadow-xl">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar…"
            className={`${fieldClass} mb-2 py-2`}
            aria-label={`Buscar em ${label}`}
          />
          <div role="listbox" aria-multiselectable="true" className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-2 text-xs text-carbon-60">Nenhuma opção encontrada.</p>
            ) : (
              filtered.map((option) => {
                const checked = values.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-carbon hover:bg-neutral"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onChange(
                          checked
                            ? values.filter((item) => item !== option.value)
                            : [...values, option.value],
                        )
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                )
              })
            )}
          </div>
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-2 w-full rounded-lg px-2 py-2 text-xs font-bold text-magenta hover:bg-light-magenta"
            >
              Limpar seleção
            </button>
          )}
        </div>
      )}
    </div>
  )
}
