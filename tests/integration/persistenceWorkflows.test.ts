import { beforeEach, describe, expect, it, vi } from "vitest"
import { contact, invite, registration } from "../fixtures/domain"

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  upsertRegistrations: vi.fn(),
  upsertInvites: vi.fn(),
  insertedContacts: [] as Record<string, unknown>[],
}))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
  isSupabaseConfigured: true,
  getSupabaseConfigurationError: () => null,
}))

import {
  saveAttendance,
  saveContact,
  saveInvites,
  saveRegistrations,
  undoAttendanceRemote,
} from "@/lib/api"
import { saveMailingList, DEFAULT_MAILING_FILTERS } from "@/lib/mailingApi"
import { buildLumaRegistrations, createLumaMappings, matchLumaRows } from "@/lib/lumaImport"

describe("fluxos persistidos", () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.from.mockReset()
    mocks.upsertRegistrations.mockReset()
    mocks.upsertInvites.mockReset()
    mocks.insertedContacts.length = 0

    mocks.from.mockImplementation((table: string) => {
      if (table === "contacts") {
        return {
          insert: (payload: Record<string, unknown>) => {
            mocks.insertedContacts.push(payload)
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    ...payload,
                    created_at: "2026-09-01T12:00:00Z",
                    updated_at: "2026-09-01T12:00:00Z",
                  },
                  error: null,
                }),
              }),
            }
          },
        }
      }
      if (table === "event_registrations") return { upsert: mocks.upsertRegistrations }
      if (table === "event_invites") return { upsert: mocks.upsertInvites }
      throw new Error(`Tabela não simulada: ${table}`)
    })

    mocks.upsertRegistrations.mockResolvedValue({ error: null })
    mocks.upsertInvites.mockResolvedValue({ error: null })
  })

  it("persiste check-in e usa o usuário retornado pelo banco", async () => {
    mocks.rpc.mockImplementation(async (name: string, params: Record<string, unknown>) => {
      expect(name).toBe("check_in_event")
      return {
        data: {
          id: params.p_attendance_id,
          event_id: params.p_event_id,
          contact_id: params.p_contact_id,
          registration_id: params.p_registration_id,
          name: params.p_name,
          company: params.p_company,
          position: params.p_position,
          checked_in_at: "2026-09-01T13:00:00Z",
          checked_in_by: "server-user",
          source: params.p_source,
        },
        error: null,
      }
    })

    const saved = await saveAttendance({
      id: "attendance-1",
      eventId: "event-1",
      contactId: "contact-1",
      registrationId: "registration-1",
      name: "Ana Silva",
      checkedInAt: "client-time",
      checkedInBy: "client-user",
      source: "luma",
    })

    expect(saved.checkedInBy).toBe("server-user")
    expect(saved.checkedInAt).toBe("2026-09-01T13:00:00Z")
  })

  it("persiste undo sem apagar o registro original", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        id: "attendance-1",
        event_id: "event-1",
        contact_id: "contact-1",
        registration_id: "registration-1",
        name: "Ana Silva",
        checked_in_at: "2026-09-01T13:00:00Z",
        checked_in_by: "user-1",
        source: "luma",
        undone_at: "2026-09-01T13:05:00Z",
        undone_by: "user-2",
      },
      error: null,
    })

    const undone = await undoAttendanceRemote("event-1", "attendance-1")
    expect(mocks.rpc).toHaveBeenCalledWith("undo_event_checkin", {
      p_event_id: "event-1",
      p_attendance_id: "attendance-1",
    })
    expect(undone.undoneAt).toBe("2026-09-01T13:05:00Z")
  })

  it("persiste walk-in incompleto como contato identificado para complementação posterior", async () => {
    const saved = await saveContact(
      contact({
        id: "walk-in-1",
        firstName: "Pessoa",
        lastName: "Espontânea",
        email: undefined,
        organization: undefined,
        origin: "walk_in",
        incompleteProfile: true,
      }),
      "reception-user",
    )

    expect(saved.id).toBe("walk-in-1")
    expect(saved.incompleteProfile).toBe(true)
    expect(mocks.insertedContacts[0]).toMatchObject({
      origin: "walk_in",
      incomplete_profile: true,
      created_by: "reception-user",
    })
  })

  it("persiste convites com chave idempotente event_id,email", async () => {
    await saveInvites("event-1", [invite({ id: "invite-1" })])
    expect(mocks.upsertInvites).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ event_id: "event-1", email: "ana@example.com" })]),
      { onConflict: "event_id,email" },
    )
  })

  it("executa importação Luma completa e preserva JSON de origem", async () => {
    const rows = [{ name: "Ana Silva", email: "ana@example.com", guest_id: "guest-99", "Campo livre": "valor" }]
    const matched = matchLumaRows(rows, createLumaMappings(Object.keys(rows[0])), [contact()])
    const registrations = buildLumaRegistrations("event-1", matched, [])

    await saveRegistrations(registrations)

    expect(mocks.upsertRegistrations).toHaveBeenCalledWith(
      [expect.objectContaining({
        event_id: "event-1",
        luma_guest_id: "guest-99",
        custom_data: { "Campo livre": "valor" },
        raw_import_data: rows[0],
      })],
      { onConflict: "id" },
    )
  })

  it("salva mailing por RPC com filtros e contatos selecionados", async () => {
    mocks.rpc.mockResolvedValue({ data: "mailing-1", error: null })
    const id = await saveMailingList({
      title: "Diretores Agro",
      eventId: "event-1",
      filters: { ...DEFAULT_MAILING_FILTERS, positions: ["Diretora"] },
      contactIds: ["contact-1", "contact-2"],
    })

    expect(id).toBe("mailing-1")
    expect(mocks.rpc).toHaveBeenCalledWith("save_mailing_list", expect.objectContaining({
      p_title: "Diretores Agro",
      p_event_id: "event-1",
      p_contact_ids: ["contact-1", "contact-2"],
    }))
  })
})
