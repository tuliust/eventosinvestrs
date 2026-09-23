import { supabase } from "./supabase"

async function invokeBeehiiv(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("beehiiv-integration", { body })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)
  return data
}

export type BeehiivStatus = {
  configured: boolean
  healthy?: boolean
  publication?: { id?: string; name?: string; organizationName?: string }
}

export async function getBeehiivStatus(): Promise<any> {
  return invokeBeehiiv({ action: "status" })
}

export async function syncBeehiivCampaign(postId: string) {
  return invokeBeehiiv({ action: "sync_campaign", postId })
}

export async function createBeehiivCampaign(input: {
  title: string
  subject: string
  bodyContent: string
  emails: string[]
  sendNow: boolean
}) {
  return invokeBeehiiv({ action: "create_campaign", ...input })
}
