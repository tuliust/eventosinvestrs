import MailingBuilder from "@/components/mailing/MailingBuilder"

export default function MailingPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="flex-shrink-0 bg-white border-b border-carbon-20 px-6 py-5">
        <div className="max-w-[1500px] mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-green uppercase tracking-wide">Base de relacionamento</p>
              <h1 className="text-2xl font-bold text-carbon mt-1">Mailing</h1>
              <p className="text-sm text-carbon-60 mt-1">Crie e salve listas personalizadas de contatos usando segmentação econômica, institucional, geográfica e histórico de eventos.</p>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <MailingBuilder />
      </div>
    </div>
  )
}
