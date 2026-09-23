interface StubPageProps {
  title: string
}

export default function StubPage({ title }: StubPageProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-5"
        style={{ background: "#FFF4D6" }}
      >
        🔧
      </div>
      <h1 className="text-xl font-bold text-carbon mb-2">{title}</h1>
      <p className="text-sm text-carbon-60 max-w-xs leading-relaxed">
        Este módulo está em desenvolvimento e será disponibilizado em versão futura da plataforma.
      </p>
      <span
        className="mt-4 text-xs font-bold px-3 py-1.5 rounded-full"
        style={{ background: "#FFF4D6", color: "#9B6E00" }}
      >
        PENDENTE
      </span>
    </div>
  )
}
