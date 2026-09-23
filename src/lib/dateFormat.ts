export function formatDateBR(dateStr: string): string {
  if (!dateStr) return ""

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return `${day}/${month}/${year}`
  }

  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function isEventBeforeStart(dateStr: string, startTime: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  const timeMatch = /^(\d{1,2}):(\d{2})/.exec(startTime || "")

  if (!dateMatch) return false

  const [, year, month, day] = dateMatch
  const hour = timeMatch ? Number(timeMatch[1]) : 0
  const minute = timeMatch ? Number(timeMatch[2]) : 0
  const startsAt = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour,
    minute,
    0,
    0,
  )

  return Date.now() < startsAt.getTime()
}
