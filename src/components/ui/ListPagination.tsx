interface Props {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export default function ListPagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  const go = (next: number) => {
    const bounded = Math.min(totalPages, Math.max(1, next))
    onPageChange(bounded)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 text-xs text-carbon-60">
      <span>
        Exibindo <strong className="text-carbon">{start.toLocaleString("pt-BR")}–{end.toLocaleString("pt-BR")}</strong> de {total.toLocaleString("pt-BR")}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} className="px-3 py-2 rounded-lg border border-carbon-20 bg-white text-carbon font-bold disabled:opacity-40">← Anterior</button>
        <span className="min-w-20 text-center font-semibold text-carbon">{page} / {totalPages}</span>
        <button type="button" onClick={() => go(page + 1)} disabled={page >= totalPages} className="px-3 py-2 rounded-lg border border-carbon-20 bg-white text-carbon font-bold disabled:opacity-40">Próxima →</button>
      </div>
    </div>
  )
}
