import { useOnlineStatus } from "@/hooks/useOnlineStatus"

interface OnlineStatusProps {
  className?: string
  compact?: boolean
}

export default function OnlineStatus({ className = "", compact = false }: OnlineStatusProps) {
  const isOnline = useOnlineStatus()

  if (compact) {
    return (
      <span
        title={isOnline ? "Online" : "Offline — conexão necessária"}
        className={`inline-block w-2 h-2 rounded-full ${isOnline ? "bg-green" : "bg-magenta"} ${className}`}
      />
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-green" : "bg-magenta"}`}
      />
      <span className={isOnline ? "text-green" : "text-magenta"}>
        {isOnline ? "Online" : "Offline"}
      </span>
    </span>
  )
}
