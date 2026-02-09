/**
 * realtime-alerts.ts — WA-08
 * Gera alertas em tempo real via WhatsApp para:
 * 1. Cards marcados como urgentes (urgent_alerts_enabled)
 * 2. Prazos vencendo em D-1 ou D-0 (deadline_alerts_enabled)
 * 3. Novas atribuições de cards (assignment_alerts_enabled)
 *
 * Rodado pelo pg_cron a cada 15 minutos.
 *
 * Deduplicação: usa metadata.source_reference para evitar alertas duplicados.
 * Formato: "alert:{tipo}:{card_id}:{data}" onde data é YYYY-MM-DD.
 *
 * Fluxo:
 * 1. Busca usuários com alertas habilitados
 * 2. Para cada tipo de alerta, verifica condições
 * 3. Gera mensagem e insere em whatsapp_scheduled_messages (scheduled_for = agora)
 * 4. O cron send-reminders (cada 5min) cuida do envio real
 */

import {
  getUserPhone, getSPNow, formatDateOnlyBR, getPriorityEmoji,
} from './report-helpers.ts'

export async function processRealtimeAlerts(
  supabase: any,
): Promise<{ processed: number; errors: number; skipped: number; details?: string }> {
  let processed = 0
  let errors = 0
  let skipped = 0

  // Buscar todos os usuários com pelo menos um tipo de alerta habilitado
  const { data: subscribers, error } = await supabase
    .from('user_notification_settings')
    .select(`
      user_id,
      urgent_alerts_enabled,
      deadline_alerts_enabled,
      assignment_alerts_enabled,
      user:user_profiles!user_notification_settings_user_id_fkey(
        id, full_name, user_id
      )
    `)
    .or('urgent_alerts_enabled.eq.true,deadline_alerts_enabled.eq.true,assignment_alerts_enabled.eq.true')

  if (error) {
    console.error('[WA-08] Error fetching alert subscribers:', error)
    return { processed: 0, errors: 1, skipped: 0, details: error.message }
  }

  if (!subscribers || subscribers.length === 0) {
    console.log('[WA-08] No alert subscribers found')
    return { processed: 0, errors: 0, skipped: 0 }
  }

  console.log(`[WA-08] Processing realtime alerts for ${subscribers.length} user(s)`)

  // Data de hoje em SP para referência de deduplicação
  const spNow = getSPNow()
  const todayStr = `${spNow.getUTCFullYear()}-${String(spNow.getUTCMonth() + 1).padStart(2, '0')}-${String(spNow.getUTCDate()).padStart(2, '0')}`

  // Buscar colunas finalizadas (published/archived) para excluir
  const { data: finishedCols } = await supabase
    .from('kanban_columns')
    .select('id')
    .in('slug', ['published', 'archived'])
  const finishedIds = (finishedCols || []).map((c: any) => c.id)

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) continue

      // === 1. ALERTAS DE CARDS URGENTES ===
      if (sub.urgent_alerts_enabled) {
        const r = await processUrgentAlerts(supabase, profile, phone, finishedIds, todayStr)
        processed += r.created
        skipped += r.skipped
        errors += r.errors
      }

      // === 2. ALERTAS DE PRAZOS (D-1 e D-0) ===
      if (sub.deadline_alerts_enabled) {
        const r = await processDeadlineAlerts(supabase, profile, phone, finishedIds, todayStr)
        processed += r.created
        skipped += r.skipped
        errors += r.errors
      }

      // === 3. ALERTAS DE ATRIBUIÇÕES ===
      if (sub.assignment_alerts_enabled) {
        const r = await processAssignmentAlerts(supabase, profile, phone, todayStr)
        processed += r.created
        skipped += r.skipped
        errors += r.errors
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[WA-08] Error processing alerts for ${sub.user_id}:`, errMsg)
      errors++
    }
  }

  return { processed, errors, skipped }
}


// ============================================
// ALERTAS DE CARDS URGENTES
// ============================================

async function processUrgentAlerts(
  supabase: any,
  profile: any,
  phone: string,
  finishedIds: string[],
  todayStr: string,
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0, skippedCount = 0, errCount = 0

  // Buscar cards urgentes ativos (criados ou movidos para urgente nas últimas 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString()

  let query = supabase
    .from('kanban_cards')
    .select('id, title, due_date, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
    .eq('priority', 'urgent')
    .is('deleted_at', null)
    .gte('updated_at', oneDayAgo)
    .limit(10)

  // Excluir colunas finalizadas
  for (const fId of finishedIds) {
    query = query.neq('column_id', fId)
  }

  const { data: urgentCards, error } = await query

  if (error) {
    console.error('[WA-08] Error fetching urgent cards:', error)
    return { created: 0, skipped: 0, errors: 1 }
  }

  if (!urgentCards || urgentCards.length === 0) return { created: 0, skipped: 0, errors: 0 }

  for (const card of urgentCards) {
    const sourceRef = `alert:urgent:${card.id}:${todayStr}`
    const result = await insertAlertIfNew(supabase, profile, phone, sourceRef, () => {
      const due = card.due_date ? `\n📅 Prazo: ${formatDateOnlyBR(card.due_date)}` : ''
      return [
        `🔴 *Card urgente*`,
        ``,
        `*${card.title}*`,
        `📋 ${card.column?.name || '?'}${due}`,
        ``,
        `Atenção necessária!`,
      ].join('\n')
    })

    if (result === 'created') created++
    else if (result === 'skipped') skippedCount++
    else errCount++
  }

  return { created, skipped: skippedCount, errors: errCount }
}


// ============================================
// ALERTAS DE PRAZOS (D-1 e D-0)
// ============================================

async function processDeadlineAlerts(
  supabase: any,
  profile: any,
  phone: string,
  finishedIds: string[],
  todayStr: string,
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0, skippedCount = 0, errCount = 0

  const spNow = getSPNow()
  // Calcular D-0 (hoje) e D-1 (amanhã) em SP
  const todayStart = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), spNow.getUTCDate(), 0, 0, 0))
  const todayEnd = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), spNow.getUTCDate(), 23, 59, 59))
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60000)
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60000)

  // Converter para UTC (+3h)
  const toUTC = (d: Date) => new Date(d.getTime() + 3 * 60 * 60000)

  // D-0: cards com prazo hoje
  let queryD0 = supabase
    .from('kanban_cards')
    .select('id, title, due_date, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
    .gte('due_date', toUTC(todayStart).toISOString())
    .lte('due_date', toUTC(todayEnd).toISOString())
    .is('deleted_at', null)
    .limit(10)

  for (const fId of finishedIds) {
    queryD0 = queryD0.neq('column_id', fId)
  }

  const { data: d0Cards } = await queryD0

  for (const card of (d0Cards || [])) {
    const sourceRef = `alert:deadline-d0:${card.id}:${todayStr}`
    const result = await insertAlertIfNew(supabase, profile, phone, sourceRef, () => {
      return [
        `⚠️ *Prazo hoje!*`,
        ``,
        `*${card.title}*`,
        `📋 ${card.column?.name || '?'}`,
        `📅 Vence hoje (${formatDateOnlyBR(card.due_date)})`,
      ].join('\n')
    })

    if (result === 'created') created++
    else if (result === 'skipped') skippedCount++
    else errCount++
  }

  // D-1: cards com prazo amanhã
  let queryD1 = supabase
    .from('kanban_cards')
    .select('id, title, due_date, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
    .gte('due_date', toUTC(tomorrowStart).toISOString())
    .lte('due_date', toUTC(tomorrowEnd).toISOString())
    .is('deleted_at', null)
    .limit(10)

  for (const fId of finishedIds) {
    queryD1 = queryD1.neq('column_id', fId)
  }

  const { data: d1Cards } = await queryD1

  for (const card of (d1Cards || [])) {
    const sourceRef = `alert:deadline-d1:${card.id}:${todayStr}`
    const result = await insertAlertIfNew(supabase, profile, phone, sourceRef, () => {
      return [
        `⏰ *Prazo amanhã*`,
        ``,
        `*${card.title}*`,
        `📋 ${card.column?.name || '?'}`,
        `📅 Vence amanhã (${formatDateOnlyBR(card.due_date)})`,
      ].join('\n')
    })

    if (result === 'created') created++
    else if (result === 'skipped') skippedCount++
    else errCount++
  }

  return { created, skipped: skippedCount, errors: errCount }
}


// ============================================
// ALERTAS DE ATRIBUIÇÕES
// ============================================

async function processAssignmentAlerts(
  supabase: any,
  profile: any,
  phone: string,
  todayStr: string,
): Promise<{ created: number; skipped: number; errors: number }> {
  let created = 0, skippedCount = 0, errCount = 0

  // Buscar cards atribuídos ao usuário nas últimas 2h
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString()

  const { data: assignedCards, error } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
    .eq('responsible_user_id', profile.user_id)
    .is('deleted_at', null)
    .gte('updated_at', twoHoursAgo)
    .limit(10)

  if (error) {
    console.error('[WA-08] Error fetching assigned cards:', error)
    return { created: 0, skipped: 0, errors: 1 }
  }

  if (!assignedCards || assignedCards.length === 0) return { created: 0, skipped: 0, errors: 0 }

  for (const card of assignedCards) {
    const sourceRef = `alert:assign:${card.id}:${todayStr}`
    const result = await insertAlertIfNew(supabase, profile, phone, sourceRef, () => {
      const emoji = getPriorityEmoji(card.priority)
      return [
        `👤 *Nova atribuição*`,
        ``,
        `${emoji} *${card.title}*`,
        `📋 ${card.column?.name || '?'}`,
        ``,
        `Este card foi atribuído a você.`,
      ].join('\n')
    })

    if (result === 'created') created++
    else if (result === 'skipped') skippedCount++
    else errCount++
  }

  return { created, skipped: skippedCount, errors: errCount }
}


// ============================================
// HELPER: INSERT COM DEDUPLICAÇÃO
// ============================================

async function insertAlertIfNew(
  supabase: any,
  profile: any,
  phone: string,
  sourceReference: string,
  buildContent: () => string,
): Promise<'created' | 'skipped' | 'error'> {
  // Verificar se já existe alerta com este source_reference
  const { data: existing } = await supabase
    .from('whatsapp_scheduled_messages')
    .select('id')
    .eq('target_user_id', profile.id)
    .eq('source', 'realtime_alert')
    .contains('metadata', { source_reference: sourceReference })
    .in('status', ['pending', 'sent'])
    .limit(1)

  if (existing && existing.length > 0) {
    return 'skipped'
  }

  const content = buildContent()

  const { error } = await supabase
    .from('whatsapp_scheduled_messages')
    .insert({
      target_type: 'user',
      target_user_id: profile.id,
      target_phone: phone,
      message_type: 'text',
      content,
      scheduled_for: new Date().toISOString(), // Enviar imediatamente
      status: 'pending',
      source: 'realtime_alert',
      metadata: {
        source_reference: sourceReference,
        created_via: 'realtime_alerts_processor',
      },
    })

  if (error) {
    console.error(`[WA-08] Insert alert failed for ${sourceReference}:`, error)
    return 'error'
  }

  console.log(`[WA-08] ✅ Alert created: ${sourceReference} for ${profile.full_name}`)
  return 'created'
}
