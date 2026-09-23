import logoWhite from "@/imports/Logo_Invest_RS_-_Branco.png"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export default function Logo({ size = "md", className = "" }: LogoProps) {
  const heights = { sm: "h-6", md: "h-8", lg: "h-10" }
  return (
    <img
      src={logoWhite}
      alt="Invest RS"
      className={`${heights[size]} w-auto object-contain ${className}`}
    />
  )
}
