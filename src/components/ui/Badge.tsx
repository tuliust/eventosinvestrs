interface BadgeProps {
  variant?: "green" | "magenta" | "yellow" | "carbon" | "neutral"
  size?: "sm" | "md"
  children: React.ReactNode
  className?: string
}

const variants = {
  green: "badge-green",
  magenta: "badge-magenta",
  yellow: "badge-yellow",
  carbon: "badge-carbon",
  neutral: "bg-neutral/60 text-carbon-60 border border-carbon-20",
}

const sizes = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-xs",
}

export default function Badge({ variant = "carbon", size = "md", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  )
}
