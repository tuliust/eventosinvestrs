import type { Event, EventAttendance, EventInvite, EventRegistration } from "./types"

export function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

export function activeAttendances(attendances: EventAttendance[]): EventAttendance[] {
  return attendances.filter((attendance) => !attendance.undoneAt)
}

export function attendanceMatchesRegistration(
  registration: EventRegistration,
  attendances: EventAttendance[],
): boolean {
  return activeAttendances(attendances).some(
    (attendance) =>
      attendance.registrationId === registration.id ||
      Boolean(registration.contactId && attendance.contactId === registration.contactId),
  )
}

export type EventMetricsInput = {
  event: Pick<Event, "capacity">
  audienceCount: number
  registrations: EventRegistration[]
  attendances: EventAttendance[]
  invites: EventInvite[]
  newContactsCount?: number
  beforeStart?: boolean
}

export type EventMetrics = {
  audience: number
  invites: number
  lumaRegistrations: number
  confirmed: number
  present: number
  noShow: number
  walkIns: number
  newContacts: number
  capacity: number
  occupancy: number
  rates: {
    audienceToInvite: number
    inviteToRegistration: number
    registrationToPresence: number
    noShow: number
    walkInShare: number
  }
}

export function calculateEventMetrics({
  event,
  audienceCount,
  registrations,
  attendances,
  invites,
  newContactsCount = 0,
  beforeStart = false,
}: EventMetricsInput): EventMetrics {
  const active = activeAttendances(attendances)
  const luma = registrations.filter((registration) => registration.source === "luma")
  const confirmed = registrations.filter((registration) => registration.approvalStatus === "approved")
  const noShow = confirmed.filter(
    (registration) => !attendanceMatchesRegistration(registration, active),
  )
  const walkIns = active.filter((attendance) => attendance.source === "walk_in")
  const occupancyBase = beforeStart ? confirmed.length : active.length

  return {
    audience: audienceCount,
    invites: invites.length,
    lumaRegistrations: luma.length,
    confirmed: confirmed.length,
    present: active.length,
    noShow: noShow.length,
    walkIns: walkIns.length,
    newContacts: newContactsCount,
    capacity: event.capacity,
    occupancy: percent(occupancyBase, event.capacity),
    rates: {
      audienceToInvite: percent(invites.length, audienceCount),
      inviteToRegistration: percent(luma.length, invites.length),
      registrationToPresence: percent(active.length, luma.length),
      noShow: percent(noShow.length, confirmed.length),
      walkInShare: percent(walkIns.length, active.length),
    },
  }
}
