import { useState } from "react"
import MailingBuilder from "@/components/mailing/MailingBuilder"
import MailingInviteActions from "@/components/mailing/MailingInviteActions"
import PastedEmailAudience from "@/components/mailing/PastedEmailAudience"
import type { Event } from "@/lib/types"

export default function AudienceTab({ event }: { event: Event }) {
  const [builderVersion, setBuilderVersion] = useState(0)

  return (
    <div className="h-full overflow-y-auto bg-neutral/40">
      <div className="max-w-[1500px] mx-auto px-5 pt-5 space-y-5">
        <PastedEmailAudience
          event={event}
          onSaved={() => setBuilderVersion((value) => value + 1)}
        />
        <MailingInviteActions event={event} refreshKey={builderVersion} />
      </div>
      <MailingBuilder
        key={builderVersion}
        eventId={event.id}
        defaultTitle={`Público — ${event.title}`}
        embedded
      />
    </div>
  )
}
