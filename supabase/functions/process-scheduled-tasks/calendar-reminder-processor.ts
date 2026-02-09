/**
 * calendar-reminder-processor.ts — WA-08
 * Gera lembretes automáticos de eventos do calendário baseados nas
 * preferências do usuário (calendar_reminder_days, calendar_reminder_time).
 * 
 * Rodado pelo pg_cron a cada hora.
 * 
 * Deduplicação: usa metadata.source_reference = "cal:{event_id}:d-{days}"
 * para evitar gerar o mesmo lembrete duas vezes.
 * 
 * Fluxo:
 * 1. Busca usuários com calendar_reminders_enabled = true
 * 2. Para cada usuário, busca eventos futuros (próximos 8 dias)
 * 3. Para cada evento × dia de antecedência, verifica se já existe lembrete
 * 4. Se não existe, insere em whatsapp_scheduled_messages com status 'pending'
 * 5. O cron send-reminders (cada 5min) cuida do envio real
 */

import {
  getUserPhone, getSPNow, formatDateTimeBR, getCalendarTypeEmoji,
} from './report-helpers.ts'

export async function processCalendarReminders(
  supabase: any,
): Promise<{ processed: number; errors: number; skipped: number; details?: string }> {
  // 1. Buscar usuários com lembretes de calendário habilitados
  const { data: subscribers, error } = await supabase
    .from('user_notification_settings')
    .select(`
      user_id,
      calendar_reminders_enabled,
      calendar_reminder_days,
      calendar_reminder_time,
      user:user_profiles!user_notification_settings_user_id_fkey(
        id, full_name, user_id
      )
    `)
    .eq('calendar_reminders_enabled', true)

  if (error) {
    console.error('[WA-08] Error fetching calendar reminder subscribers:', error)
    return { processed: 0, errors: 1, skipped: 0, details: error.message }
  }

  if (!subscribers || subscribers.length === 0) {
    console.log('[WA-08] No calendar reminder subscribers found')
    return { processed: 0, errors: 0, skipped: 0 }
  }

  console.log(`[WA-08] Processing calendar reminders for ${subscribers.length} user(s)`)

  let processed = 0
  let errors = 0
  let skipped = 0

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      const reminderDays: number[] = sub.calendar_reminder_days || [3, 1]
      const reminderTime: string = sub.calendar_reminder_time || '09:00'

      // Buscar telefone do usuário
      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) {
        console.log(`[WA-08] No phone for user ${profile.full_name}, skipping`)
        continue
      }

      // Buscar eventos futuros (próximos 8 dias) — cobre o maior reminder_day (7) + 1 margem
      const spNow = getSPNow()
      const maxDaysAhead = Math.max(...reminderDays) + 1
      const futureLimit = new Date(spNow.getTime() + maxDaysAhead * 24 * 60 * 60000)

      const { data: events, error: eventsError } = await supabase
        .from('calendar_items')
        .select('id, title, type, start_time, end_time, all_day, responsible_user_id, location')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .gte('start_time', new Date().toISOString())
        .lte('start_time', futureLimit.toISOString())
        .order('start_time', { ascending: true })
        .limit(50)

      if (eventsError) {
        console.error(`[WA-08] Error fetching events for ${profile.full_name}:`, eventsError)
        errors++
        continue
      }

      if (!events || events.length === 0) continue

      // Para cada evento × dia de antecedência, verificar e gerar lembrete
      for (const event of events) {
        for (const daysBeforeNum of reminderDays) {
          const result = await generateCalendarReminder(
            supabase, profile, phone, event, daysBeforeNum, reminderTime
          )

          if (result === 'created') processed++
          else if (result === 'skipped') skipped++
          else if (result === 'error') errors++
        }
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[WA-08] Error processing user ${sub.user_id}:`, errMsg)
      errors++
    }
  }

  return { processed, errors, skipped }
}


/**
 * Gera um lembrete individual para um evento × dias de antecedência.
 * Retorna 'created', 'skipped' (já existe ou fora da janela), ou 'error'.
 */
async function generateCalendarReminder(
  supabase: any,
  profile: any,
  phone: string,
  event: any,
  daysBefore: number,
  reminderTime: string,
): Promise<'created' | 'skipped' | 'error'> {
  const sourceReference = `cal:${event.id}:d-${daysBefore}`

  // 1. Verificar se já existe lembrete para este evento + antecedência
  const { data: existing } = await supabase
    .from('whatsapp_scheduled_messages')
    .select('id')
    .eq('target_user_id', profile.id)
    .eq('source', 'calendar_reminder')
    .contains('metadata', { source_reference: sourceReference })
    .in('status', ['pending', 'sent'])
    .limit(1)

  if (existing && existing.length > 0) {
    return 'skipped' // Já existe, deduplicação
  }

  // 2. Calcular quando o lembrete deve ser enviado
  const eventDate = new Date(event.start_time)
  const [rH, rM] = reminderTime.split(':').map(Number)

  // Data do lembrete = data do evento - daysBefore, no horário configurado (SP)
  // Converter event start_time (UTC) para SP
  const eventSP = new Date(eventDate.getTime() - 3 * 60 * 60000)
  const reminderDateSP = new Date(Date.UTC(
    eventSP.getUTCFullYear(),
    eventSP.getUTCMonth(),
    eventSP.getUTCDate() - daysBefore,
    rH, rM, 0
  ))

  // Converter de SP para UTC: SP é UTC-3, então UTC = SP + 3h
  const scheduledForUTC = new Date(reminderDateSP.getTime() + 3 * 60 * 60000)

  // 3. Se a data de envio já passou, pular (não gerar lembretes retroativos)
  if (scheduledForUTC.getTime() < Date.now()) {
    return 'skipped'
  }

  // 4. Montar conteúdo do lembrete
  const emoji = getCalendarTypeEmoji(event.type)
  const eventTimeFormatted = formatDateTimeBR(event.start_time)
  const daysLabel = daysBefore === 0 ? 'hoje' : daysBefore === 1 ? 'amanhã' : `em ${daysBefore} dias`
  const locationLine = event.location ? `\n📍 ${event.location}` : ''

  const content = [
    `📅 *Lembrete de evento*`,
    ``,
    `${emoji} *${event.title}*`,
    `🗓️ ${eventTimeFormatted}${locationLine}`,
    ``,
    daysBefore === 0
      ? `📌 Este evento é *hoje*!`
      : `⏰ Este evento é ${daysLabel}!`,
  ].join('\n')

  // 5. INSERT com deduplicação via metadata.source_reference
  const { error: insertError } = await supabase
    .from('whatsapp_scheduled_messages')
    .insert({
      target_type: 'user',
      target_user_id: profile.id,
      target_phone: phone,
      message_type: 'text',
      content,
      scheduled_for: scheduledForUTC.toISOString(),
      status: 'pending',
      source: 'calendar_reminder',
      source_id: event.id,
      metadata: {
        source_reference: sourceReference,
        event_title: event.title,
        event_type: event.type,
        event_start_time: event.start_time,
        days_before: daysBefore,
        created_via: 'calendar_reminder_processor',
      },
    })

  if (insertError) {
    console.error(`[WA-08] Insert failed for ${sourceReference}:`, insertError)
    return 'error'
  }

  console.log(`[WA-08] ✅ Reminder created: ${sourceReference} for ${profile.full_name}`)
  return 'created'
}
