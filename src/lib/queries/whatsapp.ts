// ============================================
// WhatsApp Queries — Frontend
// ============================================

import { createClient } from '@/lib/supabase/client'

// ----- Messages (para futura página de histórico) -----

export const getWhatsAppMessages = async (filters?: {
  userId?: string
  direction?: 'inbound' | 'outbound'
  limit?: number
  offset?: number
}) => {
  const supabase = createClient()
  let query = supabase
    .from('whatsapp_messages')
    .select(`
      *,
      user:user_profiles(id, full_name, avatar_url)
    `)
    .order('created_at', { ascending: false })
    .limit(filters?.limit || 50)

  if (filters?.userId) query = query.eq('user_id', filters.userId)
  if (filters?.direction) query = query.eq('direction', filters.direction)
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)

  return query
}

// ----- Notification Settings -----

export const getNotificationSettings = async (userId: string) => {
  const supabase = createClient()
  return supabase
    .from('whatsapp_notification_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
}

export const updateNotificationSettings = async (userId: string, settings: Partial<{
  calendar_reminders_enabled: boolean
  calendar_reminder_days: number[]
  calendar_reminder_time: string
  daily_summary_enabled: boolean
  daily_summary_time: string
  weekly_summary_enabled: boolean
  weekly_summary_day: number
  weekly_summary_time: string
  monthly_summary_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
}>) => {
  const supabase = createClient()
  return supabase
    .from('whatsapp_notification_settings')
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: 'user_id' })
    .select()
    .single()
}

// ----- Scheduled Messages -----

export const getScheduledMessages = async (filters?: {
  status?: string
  source?: string
}) => {
  const supabase = createClient()
  let query = supabase
    .from('whatsapp_scheduled_messages')
    .select(`
      *,
      user:user_profiles(id, full_name, avatar_url)
    `)
    .order('scheduled_for', { ascending: true })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.source) query = query.eq('source', filters.source)

  return query
}

// ----- Groups -----

export const getWhatsAppGroups = async () => {
  const supabase = createClient()
  return supabase
    .from('whatsapp_groups')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
}
