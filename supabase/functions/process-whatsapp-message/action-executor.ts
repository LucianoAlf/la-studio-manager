/**
 * action-executor.ts
 * Executa ações confirmadas pelo usuário no WhatsApp
 *
 * WA-03: INSERT real em kanban_cards, calendar_items, whatsapp_scheduled_messages
 * Chamado pelo message-router.ts quando usuário confirma com "sim"
 */

import type { ExtractedEntities } from './gemini-classifier.ts'
import { sendTextMessage } from './send-message.ts'

// ============================================
// TIPOS
// ============================================

export interface ExecutionResult {
  success: boolean
  message: string       // Mensagem formatada para WhatsApp
  record_id?: string    // ID do registro criado
  error?: string        // Mensagem de erro técnica (para log)
}

interface ExecutionContext {
  // deno-lint-ignore no-explicit-any
  supabase: any
  profileId: string     // user_profiles.id → whatsapp_* tables
  authUserId: string    // auth.users.id → kanban_cards, calendar_items
  userName: string
  phone: string
  entities: ExtractedEntities
  uazapiUrl?: string    // UAZAPI server URL para notificações
  uazapiToken?: string  // UAZAPI instance token para notificações
}

// ============================================
// MAPEAMENTO DE SLUGS (WA-02 → DB)
// ============================================
// Slugs reais no banco: brainstorm, planning, todo, capturing, editing, awaiting_approval, approved, published, archived
const COLUMN_SLUG_MAP: Record<string, string> = {
  'brainstorm': 'brainstorm',
  'brainstorming': 'brainstorm',
  'planning': 'planning',
  'planejamento': 'planning',
  'todo': 'todo',
  'a_fazer': 'todo',
  'capturing': 'capturing',
  'captando': 'capturing',
  'gravação': 'capturing',
  'gravacao': 'capturing',
  'editing': 'editing',
  'editando': 'editing',
  'awaiting_approval': 'awaiting_approval',
  'aprovação': 'awaiting_approval',
  'aprovacao': 'awaiting_approval',
  'approved': 'approved',
  'aprovado': 'approved',
  'published': 'published',
  'publicado': 'published',
  'archived': 'archived',
  'arquivo': 'archived',
}

// ============================================
// EXECUTOR PRINCIPAL
// ============================================

export async function executeConfirmedAction(
  contextType: string,
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  console.log(`[WA-03] Executing ${contextType} for user ${ctx.userName}`)
  console.log(`[WA-03] Entities:`, JSON.stringify(ctx.entities))

  try {
    switch (contextType) {
      case 'creating_card':
        return await executeCreateCard(ctx)

      case 'creating_calendar':
        return await executeCreateCalendar(ctx)

      case 'creating_reminder':
        return await executeCreateReminder(ctx)

      case 'updating_reminder':
        return await executeUpdateReminder(ctx)

      case 'cancelling_reminder':
        return await executeCancelReminder(ctx)

      case 'updating_calendar':
        return await executeUpdateCalendar(ctx)

      case 'cancelling_calendar':
        return await executeCancelCalendar(ctx)

      default:
        return {
          success: false,
          message: `❌ Tipo de ação desconhecido: ${contextType}`,
          error: `Unknown context_type: ${contextType}`,
        }
    }
  } catch (error) {
    console.error(`[WA-03] Execution error:`, error)
    return {
      success: false,
      message: `❌ Erro ao executar ação. Tente novamente ou entre em contato com o suporte.`,
      error: String(error),
    }
  }
}

// ============================================
// CREATE CARD
// ============================================

async function executeCreateCard(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase, authUserId, entities } = ctx

  // 1. Resolver column_id pelo slug
  const columnSlug = COLUMN_SLUG_MAP[entities.column || 'brainstorm'] || 'brainstorm'

  const { data: column, error: columnError } = await supabase
    .from('kanban_columns')
    .select('id, name')
    .eq('slug', columnSlug)
    .single()

  if (columnError || !column) {
    console.error(`[WA-03] Column lookup failed for slug "${columnSlug}":`, columnError)
    return {
      success: false,
      message: `❌ Não encontrei a coluna "${columnSlug}" no Kanban. Verifique o nome e tente novamente.`,
      error: `Column not found: ${columnSlug}`,
    }
  }

  // 2. Calcular próxima posição na coluna (position_in_column NOT NULL)
  const { data: maxPosResult } = await supabase
    .from('kanban_cards')
    .select('position_in_column')
    .eq('column_id', column.id)
    .is('deleted_at', null)
    .order('position_in_column', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxPosResult?.position_in_column ?? 0) + 1

  // 3. WA-06.8: Resolver responsável (assigned_to) por nome
  let responsibleUserId = authUserId // Default: criador é responsável (auth.users.id)
  let responsibleProfileId = ctx.profileId // Default: profile do criador (user_profiles.id)
  let responsibleName = ctx.userName
  if (entities.assigned_to) {
    const assigneeName = String(entities.assigned_to).trim()
    // Buscar usuário pelo nome (case-insensitive, parcial)
    // id = user_profiles.id, user_id = auth.users.id (FK de kanban_cards)
    const { data: assignee } = await supabase
      .from('user_profiles')
      .select('id, user_id, full_name')
      .eq('is_active', true)
      .ilike('full_name', `%${assigneeName}%`)
      .limit(1)
      .maybeSingle()

    if (assignee) {
      responsibleUserId = assignee.user_id
      responsibleProfileId = assignee.id
      responsibleName = assignee.full_name
      console.log(`[WA-03] Responsável resolvido: "${assigneeName}" → ${assignee.full_name} (auth=${assignee.user_id}, profile=${assignee.id})`)
    } else {
      console.log(`[WA-03] Responsável "${assigneeName}" não encontrado, usando criador`)
    }
  }

  // 4. Preparar dados do card
  // deno-lint-ignore no-explicit-any
  const cardData: Record<string, any> = {
    title: entities.title || 'Card sem título',
    description: entities.description || null,
    card_type: 'single_post',
    column_id: column.id,
    position_in_column: nextPosition,
    created_by: authUserId,              // ← auth.users.id (FK de kanban_cards)
    responsible_user_id: responsibleUserId, // WA-06.8: Responsável resolvido por nome
    priority: entities.priority || 'medium',
    content_type: entities.content_type || null,
    platforms: entities.platforms || [],
    tags: entities.brand ? [entities.brand] : [],
    moved_to_column_at: new Date().toISOString(),
    metadata: {
      created_via: 'whatsapp',
      brand: entities.brand || 'la_music',
      original_message: entities.raw_text || null,
      assigned_to_name: entities.assigned_to || null,
    },
  }

  // 5. Resolver due_date: usar deadline (WA-06.8) ou date como fallback
  const deadlineText = entities.deadline || entities.date
  if (deadlineText) {
    const resolvedDate = resolveRelativeDate(String(deadlineText), entities.time as string | undefined)
    if (resolvedDate) {
      cardData.due_date = resolvedDate.toISOString()
    }
  }

  // 5. INSERT
  const { data: card, error: insertError } = await supabase
    .from('kanban_cards')
    .insert(cardData)
    .select('id, title, priority, column_id')
    .single()

  if (insertError) {
    console.error(`[WA-03] Card insert failed:`, insertError)
    return {
      success: false,
      message: `❌ Erro ao criar card: ${insertError.message}`,
      error: insertError.message,
    }
  }

  console.log(`[WA-03] Card created: ${card.id} - "${card.title}"`)

  // 6. Notificar responsável via WhatsApp (se diferente do criador)
  let notifiedResponsible = false
  if (responsibleUserId !== authUserId) {
    try {
      // Buscar telefone em contacts (fonte única de verdade)
      console.log(`[WA-03] Buscando telefone do responsável: profileId=${responsibleProfileId}`)
      const { data: contactData } = await supabase
        .from('contacts')
        .select('phone')
        .eq('user_profile_id', responsibleProfileId)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      const responsiblePhone = contactData?.phone || null
      console.log(`[WA-03] Telefone resolvido: ${responsiblePhone || 'nenhum'}`)

      if (responsiblePhone && ctx.uazapiUrl && ctx.uazapiToken) {
        const serverUrl = ctx.uazapiUrl
        const token = ctx.uazapiToken

        const notifyParts = [
          `Fala ${responsibleName}! 👋`,
          `\n${ctx.userName} criou uma tarefa pra você:`,
          `\n📝 *${card.title}*`,
          `📋 ${column.name}`,
        ]
        if (deadlineText) notifyParts.push(`📅 Prazo: ${deadlineText}`)
        if (entities.priority && entities.priority !== 'medium') notifyParts.push(formatPriority(entities.priority as string))
        if (entities.content_type) notifyParts.push(`🎬 ${entities.content_type}`)
        notifyParts.push(`\nQualquer dúvida, fala comigo! 🤙`)

        const sendResult = await sendTextMessage({
          serverUrl,
          token,
          to: responsiblePhone,
          text: notifyParts.join('\n'),
        })

        if (sendResult.success) {
          notifiedResponsible = true
          console.log(`[WA-03] ✅ Responsável ${responsibleName} notificado via WhatsApp (${responsiblePhone})`)
        } else {
          console.error(`[WA-03] Falha ao notificar responsável:`, sendResult.error)
        }
      } else {
        console.log(`[WA-03] Responsável ${responsibleName} sem WhatsApp cadastrado, pulando notificação`)
      }
    } catch (notifyErr) {
      console.error(`[WA-03] Erro ao notificar responsável:`, notifyErr)
    }
  }

  // 7. Montar resposta de sucesso (tom Mike)
  const successParts = [
    `Pronto, criei a tarefa!\n`,
    `📝 *${card.title}*`,
    `📋 ${column.name}`,
  ]
  if (entities.priority && entities.priority !== 'medium') successParts.push(formatPriority(entities.priority as string))
  if (responsibleName) successParts.push(`👤 ${responsibleName}`)
  if (deadlineText) successParts.push(`📅 Prazo: ${deadlineText}`)
  if (entities.content_type) successParts.push(`🎬 ${entities.content_type}`)
  if (notifiedResponsible) successParts.push(`\nNotifiquei ${responsibleName} pelo WhatsApp.`)

  return {
    success: true,
    record_id: card.id,
    message: successParts.join('\n'),
  }
}

// ============================================
// CREATE CALENDAR
// ============================================

async function executeCreateCalendar(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase, authUserId, entities } = ctx

  // 1. Resolver data e horário
  const startTime = resolveRelativeDate(entities.date || 'hoje', entities.time)
  if (!startTime) {
    return {
      success: false,
      message: `❌ Não consegui resolver a data "${entities.date}". Tente um formato como "amanhã", "sexta", "15/02" ou "2026-02-15".`,
      error: `Date resolution failed for: ${entities.date}`,
    }
  }

  // 2. Calcular end_time
  let endTime: Date | null = null
  const calendarType = entities.calendar_type || 'task'
  const durationMinutes = entities.duration_minutes || getDefaultDuration(calendarType)

  // Se não tem horário definido, marcar como all_day
  const allDay = !entities.time

  if (allDay) {
    // all_day: start 00:00, end 23:59 (em SP, convertido para UTC)
    startTime.setUTCHours(3, 0, 0, 0)  // 00:00 SP = 03:00 UTC
    endTime = new Date(startTime)
    endTime.setUTCHours(26, 59, 59, 999) // 23:59 SP = 02:59+1 UTC
  } else if (durationMinutes) {
    endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
  }

  // 3. Preparar dados do item
  // deno-lint-ignore no-explicit-any
  const calendarData: Record<string, any> = {
    title: entities.title || 'Evento sem título',
    description: entities.description || null,
    type: calendarType,
    status: 'pending',
    start_time: startTime.toISOString(),
    end_time: endTime ? endTime.toISOString() : null,
    all_day: allDay,
    created_by: authUserId,          // ← auth.users.id
    responsible_user_id: authUserId,
    content_type: entities.content_type || null,
    platforms: entities.platforms || [],
    color: getCalendarTypeColor(calendarType),
    metadata: {
      created_via: 'whatsapp',
      brand: entities.brand || 'la_music',
      original_date_text: entities.date || null,
      original_time_text: entities.time || null,
    },
  }

  // 4. INSERT
  const { data: item, error: insertError } = await supabase
    .from('calendar_items')
    .insert(calendarData)
    .select('id, title, type, start_time, all_day')
    .single()

  if (insertError) {
    console.error(`[WA-03] Calendar insert failed:`, insertError)
    return {
      success: false,
      message: `❌ Erro ao criar evento: ${insertError.message}`,
      error: insertError.message,
    }
  }

  console.log(`[WA-03] Calendar item created: ${item.id} - "${item.title}"`)

  // 5. Montar resposta de sucesso (tom Mike)
  const dateStr = formatDateBR(startTime)
  const timeStr = entities.time ? ` às ${entities.time}` : ' (dia todo)'

  return {
    success: true,
    record_id: item.id,
    message: `Pronto, agendei!\n\n` +
      `📝 *${item.title}*\n` +
      `◆ ${dateStr}${timeStr}` +
      (durationMinutes && !allDay ? `\n⏱️ ${durationMinutes} min` : '') +
      (entities.location ? `\n📍 ${entities.location}` : ''),
  }
}

// ============================================
// CREATE REMINDER
// ============================================

async function executeCreateReminder(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase, profileId, phone, entities } = ctx

  // 1. Resolver data/hora do lembrete
  const scheduledFor = resolveRelativeDate(
    entities.reminder_date || entities.date || 'hoje',
    entities.reminder_time || entities.time || '09:00'
  )

  if (!scheduledFor) {
    return {
      success: false,
      message: `❌ Não consegui resolver a data do lembrete "${entities.reminder_date || entities.date}". Tente "amanhã às 9h" ou "sexta às 14h".`,
      error: `Date resolution failed for reminder`,
    }
  }

  // Se a data já passou, avisar
  if (scheduledFor.getTime() < Date.now()) {
    return {
      success: false,
      message: `⚠️ A data/hora do lembrete (${formatDateBR(scheduledFor)} às ${formatTimeBR(scheduledFor)}) já passou. Tente uma data futura.`,
      error: `Scheduled time is in the past`,
    }
  }

  // 2. Montar conteúdo do lembrete (texto limpo, sem formatação — formatação vai na hora de enviar)
  const reminderText = String(entities.reminder_text || entities.title || 'Lembrete sem descrição')

  // 3. Resolver recorrência
  const recurrence = entities.reminder_recurrence || null

  // 4. INSERT
  const { data: reminder, error: insertError } = await supabase
    .from('whatsapp_scheduled_messages')
    .insert({
      target_type: 'user',
      target_user_id: profileId,    // ← user_profiles.id (FK de scheduled_messages)
      target_phone: phone,
      message_type: 'text',
      content: reminderText,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      source: 'manual',             // Criado pelo usuário via WhatsApp
      recurrence,                   // null = único, 'daily'|'weekdays'|'weekly'|'monthly'
      metadata: {
        created_via: 'whatsapp',
        original_date_text: entities.reminder_date || entities.date || null,
        original_time_text: entities.reminder_time || entities.time || null,
        original_recurrence_text: entities.reminder_recurrence || null,
      },
    })
    .select('id, scheduled_for')
    .single()

  if (insertError) {
    console.error(`[WA-03] Reminder insert failed:`, insertError)
    return {
      success: false,
      message: `❌ Erro ao criar lembrete: ${insertError.message}`,
      error: insertError.message,
    }
  }

  console.log(`[WA-03] Reminder created: ${reminder.id} for ${scheduledFor.toISOString()} recurrence=${recurrence}`)

  // 5. Montar resposta de sucesso
  const dateStr = formatDateBR(scheduledFor)
  const timeStr = formatTimeBR(scheduledFor)

  const recLabels: Record<string, string> = {
    daily: 'todo dia', weekdays: 'dias úteis (seg-sex)',
    weekly: 'toda semana', monthly: 'todo mês',
  }
  const recText = recurrence ? `\n🔄 Repete: ${recLabels[recurrence] || recurrence}` : ''

  return {
    success: true,
    record_id: reminder.id,
    message: `Pronto, lembrete criado! ⏰\n\n` +
      `📝 *${entities.reminder_text || entities.title || 'Lembrete'}*\n` +
      `📅 ${dateStr} às ${timeStr}${recText}`,
  }
}

// ============================================
// WA-06.8: VERIFICAÇÃO DE CONFLITOS (chamada pelo router ANTES de criar)
// ============================================

export interface ConflictCheckResult {
  hasConflict: boolean
  conflictMessage: string  // Mensagem para o usuário
}

/**
 * Verifica conflitos de horário no mesmo dia ANTES de criar o evento.
 * Chamada pelo router quando o usuário confirma "sim" para creating_calendar.
 */
export async function checkCalendarConflicts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  authUserId: string,
  entities: ExtractedEntities
): Promise<ConflictCheckResult> {
  try {
    const startTime = resolveRelativeDate(entities.date || 'hoje', entities.time)
    if (!startTime) return { hasConflict: false, conflictMessage: '' }

    const dayStart = new Date(startTime)
    dayStart.setUTCHours(0, 0, 0, 0)
    const dayEnd = new Date(startTime)
    dayEnd.setUTCHours(23, 59, 59, 999)

    const { data: existingEvents } = await supabase
      .from('calendar_items')
      .select('id, title, start_time, end_time')
      .eq('created_by', authUserId)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
      .is('deleted_at', null)

    if (!existingEvents || existingEvents.length === 0) {
      return { hasConflict: false, conflictMessage: '' }
    }

    const participantName = entities.participants
      ? String(entities.participants).split(/[,&]|\be\b/)[0].trim()
      : null

    // Verificar conflito com mesmo participante
    if (participantName) {
      const conflicts = existingEvents.filter((ev: { title: string }) =>
        ev.title.toLowerCase().includes(participantName.toLowerCase())
      )

      if (conflicts.length > 0) {
        const conflictList = conflicts.map((ev: { title: string; start_time: string }) => {
          const t = new Date(ev.start_time)
          const spHour = t.getUTCHours() - 3 < 0 ? t.getUTCHours() + 21 : t.getUTCHours() - 3
          return `• *${ev.title}* às ${spHour}:${String(t.getUTCMinutes()).padStart(2, '0')}`
        }).join('\n')

        return {
          hasConflict: true,
          conflictMessage: `⚠️ *Conflito de agenda*\n\nVocê já tem ${conflicts.length > 1 ? 'compromissos' : 'compromisso'} com *${participantName}* nesse dia:\n\n${conflictList}\n\nQuer marcar mesmo assim? (sim/não)`,
        }
      }
    }

    // Verificar sobreposição de horário
    if (entities.time) {
      const calendarType = entities.calendar_type || 'task'
      const durationMinutes = entities.duration_minutes || getDefaultDuration(calendarType)
      const newStart = startTime.getTime()
      const newEnd = newStart + (durationMinutes || 60) * 60 * 1000

      const overlaps = existingEvents.filter((ev: { start_time: string; end_time: string | null }) => {
        const evStart = new Date(ev.start_time).getTime()
        const evEnd = ev.end_time ? new Date(ev.end_time).getTime() : evStart + 60 * 60 * 1000
        return newStart < evEnd && newEnd > evStart
      })

      if (overlaps.length > 0) {
        const overlapList = overlaps.map((ev: { title: string; start_time: string }) => {
          const t = new Date(ev.start_time)
          const spHour = t.getUTCHours() - 3 < 0 ? t.getUTCHours() + 21 : t.getUTCHours() - 3
          return `• *${ev.title}* às ${spHour}:${String(t.getUTCMinutes()).padStart(2, '0')}`
        }).join('\n')

        return {
          hasConflict: true,
          conflictMessage: `⚠️ *Conflito de horário*\n\nEsse horário bate com:\n\n${overlapList}\n\nQuer marcar mesmo assim? (sim/não)`,
        }
      }
    }

    return { hasConflict: false, conflictMessage: '' }
  } catch (err) {
    console.error('[WA-03] Conflict check error:', err)
    return { hasConflict: false, conflictMessage: '' }
  }
}

// ============================================
// RESOLUÇÃO DE DATAS RELATIVAS
// ============================================

/**
 * Resolve datas relativas em português para Date objects
 * Exemplos: "hoje", "amanhã", "sexta", "dia 15", "15/02", "2026-02-15"
 * Timezone: America/Sao_Paulo (UTC-3)
 * Retorna Date em UTC (pronto para salvar no banco)
 */
export function resolveRelativeDate(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null

  // Normalizar termos em inglês que o Gemini pode retornar
  const EN_TO_PT: Record<string, string> = {
    'next_friday': 'sexta', 'next_monday': 'segunda', 'next_tuesday': 'terça',
    'next_wednesday': 'quarta', 'next_thursday': 'quinta', 'next_saturday': 'sábado',
    'next_sunday': 'domingo', 'next friday': 'sexta', 'next monday': 'segunda',
    'next tuesday': 'terça', 'next wednesday': 'quarta', 'next thursday': 'quinta',
    'next saturday': 'sábado', 'next sunday': 'domingo',
    'friday': 'sexta', 'monday': 'segunda', 'tuesday': 'terça',
    'wednesday': 'quarta', 'thursday': 'quinta', 'saturday': 'sábado', 'sunday': 'domingo',
    'today': 'hoje', 'tomorrow': 'amanhã', 'day after tomorrow': 'depois de amanhã',
    'next week': 'próxima semana',
  }

  const rawLower = dateStr.toLowerCase().trim()
  const normalizedDate = EN_TO_PT[rawLower] || rawLower

  // Calcular "agora" em São Paulo (UTC-3)
  const now = new Date()
  const spOffset = -3 // horas
  const spNow = new Date(now.getTime() + (spOffset * 60 + now.getTimezoneOffset()) * 60000)

  let result: Date | null = null

  // --- RELATIVAS ---
  if (normalizedDate === 'hoje' || normalizedDate === 'today') {
    result = new Date(spNow)
  }
  else if (normalizedDate === 'amanhã' || normalizedDate === 'amanha' || normalizedDate === 'tomorrow') {
    result = new Date(spNow)
    result.setDate(result.getDate() + 1)
  }
  else if (normalizedDate === 'depois de amanhã' || normalizedDate === 'depois de amanha') {
    result = new Date(spNow)
    result.setDate(result.getDate() + 2)
  }
  // --- DIAS DA SEMANA ---
  else if (isDayOfWeek(normalizedDate)) {
    result = getNextWeekday(spNow, normalizedDate)
  }
  // --- "dia X" ou "dia X/MM" ---
  else if (normalizedDate.startsWith('dia ')) {
    const parts = normalizedDate.replace('dia ', '').split('/')
    const day = parseInt(parts[0])
    const month = parts[1] ? parseInt(parts[1]) - 1 : spNow.getMonth()
    const year = parts[2] ? parseInt(parts[2]) : spNow.getFullYear()

    if (!isNaN(day)) {
      result = new Date(year, month, day)
      // Se a data já passou neste mês, avançar para o próximo mês
      if (result < spNow && !parts[1]) {
        result.setMonth(result.getMonth() + 1)
      }
    }
  }
  // --- DD/MM ou DD/MM/YYYY ---
  else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(normalizedDate)) {
    const parts = normalizedDate.split('/')
    const day = parseInt(parts[0])
    const month = parseInt(parts[1]) - 1
    let year = parts[2] ? parseInt(parts[2]) : spNow.getFullYear()
    if (year < 100) year += 2000 // 26 → 2026

    result = new Date(year, month, day)
    // Se a data já passou neste ano, avançar para o próximo ano
    if (result < spNow && !parts[2]) {
      result.setFullYear(result.getFullYear() + 1)
    }
  }
  // --- YYYY-MM-DD (ISO) ---
  else if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    const parts = normalizedDate.split('-')
    let isoYear = parseInt(parts[0])
    const isoMonth = parseInt(parts[1]) - 1
    const isoDay = parseInt(parts[2])
    // Fix: Gemini às vezes retorna ano errado (2024/2025 em vez do ano atual)
    // Se o ano for anterior ao atual, corrigir para o ano atual
    const currentYear = spNow.getFullYear()
    if (isoYear < currentYear) {
      console.warn(`[WA-03] ISO date year ${isoYear} < current ${currentYear}, fixing to ${currentYear}`)
      isoYear = currentYear
    }
    result = new Date(isoYear, isoMonth, isoDay, 12, 0, 0)
  }
  // --- "próxima semana", "semana que vem" ---
  else if (normalizedDate.includes('próxima semana') || normalizedDate.includes('proxima semana') || normalizedDate.includes('semana que vem')) {
    result = new Date(spNow)
    result.setDate(result.getDate() + (8 - result.getDay())) // Próxima segunda
  }

  if (!result) return null

  // Aplicar horário
  if (timeStr) {
    const timeParsed = parseTime(timeStr)
    if (timeParsed) {
      result.setHours(timeParsed.hours, timeParsed.minutes, 0, 0)
    }
  } else {
    // Default: 09:00 (horário comercial)
    result.setHours(9, 0, 0, 0)
  }

  // Converter de SP para UTC: SP é UTC-3, então UTC = SP + 3h
  const utcResult = new Date(result.getTime() - spOffset * 60 * 60000)
  return utcResult
}

function isDayOfWeek(str: string): boolean {
  const days = [
    'segunda', 'terça', 'terca', 'quarta', 'quinta', 'sexta',
    'sábado', 'sabado', 'domingo',
    'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'sab', 'dom',
  ]
  return days.some(d => str.includes(d))
}

function getNextWeekday(fromDate: Date, dayStr: string): Date {
  const dayMap: Record<string, number> = {
    'domingo': 0, 'dom': 0,
    'segunda': 1, 'seg': 1,
    'terça': 2, 'terca': 2, 'ter': 2,
    'quarta': 3, 'qua': 3,
    'quinta': 4, 'qui': 4,
    'sexta': 5, 'sex': 5,
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'sab': 6,
  }

  let targetDay: number | undefined
  for (const [key, value] of Object.entries(dayMap)) {
    if (dayStr.includes(key)) {
      targetDay = value
      break
    }
  }

  if (targetDay === undefined) return fromDate

  const result = new Date(fromDate)
  const currentDay = result.getDay()
  let daysToAdd = targetDay - currentDay
  if (daysToAdd <= 0) daysToAdd += 7 // Sempre avançar para a próxima semana

  result.setDate(result.getDate() + daysToAdd)
  return result
}

function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null

  const normalized = timeStr.toLowerCase().replace(/\s/g, '')

  // "14h", "14h30", "14:30", "14"
  let match = normalized.match(/^(\d{1,2})[h:]?(\d{2})?$/)
  if (match) {
    return {
      hours: parseInt(match[1]),
      minutes: match[2] ? parseInt(match[2]) : 0,
    }
  }

  // "9h da manhã", "3h da tarde"
  match = normalized.match(/^(\d{1,2})h?\s*(da\s*manhã|da\s*manha|da\s*tarde|da\s*noite)?$/)
  if (match) {
    let hours = parseInt(match[1])
    if (match[2]?.includes('tarde') && hours < 12) hours += 12
    if (match[2]?.includes('noite') && hours < 12) hours += 12
    return { hours, minutes: 0 }
  }

  return null
}

// ============================================
// FORMATADORES
// ============================================

function formatDateBR(date: Date): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  // Converter UTC para SP para exibição
  const sp = new Date(date.getTime() - 3 * 60 * 60000)
  return `${days[sp.getUTCDay()]}, ${sp.getUTCDate()} de ${months[sp.getUTCMonth()]}`
}

function formatTimeBR(date: Date): string {
  const sp = new Date(date.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCHours().toString().padStart(2, '0')}:${sp.getUTCMinutes().toString().padStart(2, '0')}`
}

function formatPriority(p: string): string {
  const map: Record<string, string> = {
    urgent: '🔴 Urgente', high: '🟠 Alta', medium: '🟡 Média', low: '⚪ Baixa',
  }
  return map[p] || p
}

function getPriorityEmoji(p: string): string {
  const map: Record<string, string> = {
    urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪',
  }
  return map[p] || '🟡'
}

function getCalendarTypeEmoji(t: string): string {
  const map: Record<string, string> = {
    event: '🎉', delivery: '📦', creation: '🎨', task: '✅', meeting: '🤝',
  }
  return map[t] || '📅'
}

function getCalendarTypeColor(t: string): string {
  const map: Record<string, string> = {
    event: '#FF6B6B',
    delivery: '#FFE66D',
    creation: '#4ECDC4',
    task: '#95E1D3',
    meeting: '#A8D8EA',
  }
  return map[t] || '#95E1D3'
}

function getDefaultDuration(calendarType?: string): number {
  const map: Record<string, number> = {
    event: 120,    // 2h
    delivery: 0,   // Sem duração
    creation: 180, // 3h (gravação)
    task: 60,      // 1h
    meeting: 60,   // 1h
  }
  return map[calendarType || 'task'] || 60
}

// ============================================
// UPDATE REMINDER
// ============================================

async function executeUpdateReminder(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase } = ctx
  const ents = ctx.entities as unknown as Record<string, unknown>
  const reminderId = ents.reminder_id as string
  const updates = ents.updates as Record<string, unknown> | undefined

  if (!reminderId || !updates || Object.keys(updates).length === 0) {
    return {
      success: false,
      message: '❌ Não consegui identificar o lembrete ou as alterações.',
      error: 'Missing reminder_id or updates',
    }
  }

  const { error } = await supabase
    .from('whatsapp_scheduled_messages')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
    .eq('status', 'pending')

  if (error) {
    console.error('[WA-03] Update reminder error:', error)
    return {
      success: false,
      message: '❌ Erro ao alterar o lembrete. Tenta de novo?',
      error: String(error),
    }
  }

  const changeDesc = (ents.change_description as string) || 'alterações aplicadas'
  const cleanContent = ((ents.reminder_content as string) || 'Lembrete')
    .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, '')
    .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, '')
    .substring(0, 60)

  console.log(`[WA-03] ✅ Reminder updated: ${reminderId}`)

  return {
    success: true,
    message: `Pronto, alterei o lembrete! ✏️\n\n📝 *${cleanContent}*\n${changeDesc}`,
    record_id: reminderId,
  }
}

// ============================================
// CANCEL REMINDER
// ============================================

async function executeCancelReminder(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase } = ctx
  const ents = ctx.entities as unknown as Record<string, unknown>
  const reminderId = ents.reminder_id as string

  if (!reminderId) {
    return {
      success: false,
      message: '❌ Não consegui identificar o lembrete pra cancelar.',
      error: 'Missing reminder_id',
    }
  }

  const { error } = await supabase
    .from('whatsapp_scheduled_messages')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reminderId)
    .eq('status', 'pending')

  if (error) {
    console.error('[WA-03] Cancel reminder error:', error)
    return {
      success: false,
      message: '❌ Erro ao cancelar o lembrete. Tenta de novo?',
      error: String(error),
    }
  }

  const cleanContent = ((ents.reminder_content as string) || 'Lembrete')
    .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, '')
    .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, '')
    .substring(0, 60)

  console.log(`[WA-03] ✅ Reminder cancelled: ${reminderId}`)

  return {
    success: true,
    message: `Pronto, cancelei o lembrete *${cleanContent}*. 🗑️`,
    record_id: reminderId,
  }
}

// ============================================
// WA-09: UPDATE CALENDAR EVENT
// ============================================

async function executeUpdateCalendar(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase } = ctx
  const ents = ctx.entities as Record<string, unknown>
  const eventId = ents.event_id as string
  const eventTitle = (ents.event_title as string) || 'Evento'

  if (!eventId) {
    return { success: false, message: '❌ Não encontrei o ID do evento pra alterar.', error: 'Missing event_id' }
  }

  // Buscar evento atual para calcular novos valores
  const { data: currentEvent, error: fetchError } = await supabase
    .from('calendar_items')
    .select('id, title, start_time, end_time, location')
    .eq('id', eventId)
    .single()

  if (fetchError || !currentEvent) {
    return { success: false, message: '❌ Não encontrei o evento no banco.', error: fetchError?.message || 'Event not found' }
  }

  const updates: Record<string, unknown> = {}
  const changeLines: string[] = []

  // Novo título
  if (ents.event_new_title) {
    updates.title = ents.event_new_title
    changeLines.push(`📝 Título: ${ents.event_new_title}`)
  }

  // Novo local
  if (ents.event_new_location) {
    updates.location = ents.event_new_location
    changeLines.push(`📍 Local: ${ents.event_new_location}`)
  }

  // Nova data e/ou horário — precisa resolver datas relativas
  const currentStart = new Date(currentEvent.start_time)
  let newStart: Date | null = null

  if (ents.event_new_date || ents.event_new_time) {
    newStart = new Date(currentStart)

    // Resolver nova data
    if (ents.event_new_date) {
      const dateStr = String(ents.event_new_date).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const today = new Date()

      const dayMap: Record<string, number> = {
        'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
        'quinta': 4, 'sexta': 5, 'sabado': 6,
      }

      if (dateStr.includes('amanha')) {
        newStart.setFullYear(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      } else if (dateStr.includes('hoje')) {
        newStart.setFullYear(today.getFullYear(), today.getMonth(), today.getDate())
      } else if (dateStr.includes('semana que vem') || dateStr.includes('proxima semana')) {
        newStart.setDate(currentStart.getDate() + 7)
      } else {
        // Tentar match por dia da semana
        for (const [dayName, dayNum] of Object.entries(dayMap)) {
          if (dateStr.includes(dayName)) {
            const currentDay = today.getDay()
            let daysAhead = dayNum - currentDay
            if (daysAhead <= 0) daysAhead += 7
            newStart.setFullYear(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead)
            break
          }
        }

        // Tentar parse de data DD/MM
        const dateMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})/)
        if (dateMatch) {
          const day = parseInt(dateMatch[1])
          const month = parseInt(dateMatch[2]) - 1
          newStart.setMonth(month, day)
          if (newStart.getTime() < today.getTime()) {
            newStart.setFullYear(newStart.getFullYear() + 1)
          }
        }
      }
    }

    // Resolver novo horário
    if (ents.event_new_time) {
      const timeStr = String(ents.event_new_time)
      const timeMatch = timeStr.match(/(\d{1,2})[:\s]*(\d{2})?/)
      if (timeMatch) {
        let hours = parseInt(timeMatch[1])
        const minutes = parseInt(timeMatch[2] || '0')
        // Horário comercial: se < 7, assumir PM
        if (hours < 7 && hours > 0) hours += 12
        newStart.setHours(hours, minutes, 0, 0)
      }
    }

    updates.start_time = newStart.toISOString()

    // Ajustar end_time mantendo a mesma duração
    if (currentEvent.end_time) {
      const currentEnd = new Date(currentEvent.end_time)
      const durationMs = currentEnd.getTime() - currentStart.getTime()
      updates.end_time = new Date(newStart.getTime() + durationMs).toISOString()
    }

    const newDateStr = newStart.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    const newTimeStr = newStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    changeLines.push(`🗓️ ${newDateStr} às ${newTimeStr}`)
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: '⚠️ Não identifiquei o que alterar no evento. Pode especificar?', error: 'No updates' }
  }

  // Aplicar update
  const { error: updateError } = await supabase
    .from('calendar_items')
    .update(updates)
    .eq('id', eventId)

  if (updateError) {
    console.error(`[WA-09] Calendar update failed:`, updateError)
    return { success: false, message: '❌ Erro ao alterar o evento.', error: updateError.message }
  }

  console.log(`[WA-09] ✅ Calendar event updated: ${eventId}`, updates)

  return {
    success: true,
    message: `Pronto, alterei o evento! ✏️\n\n📅 *${eventTitle}*\n${changeLines.join('\n')}`,
    record_id: eventId,
  }
}

// ============================================
// WA-09: CANCEL CALENDAR EVENT
// ============================================

async function executeCancelCalendar(ctx: ExecutionContext): Promise<ExecutionResult> {
  const { supabase } = ctx
  const ents = ctx.entities as Record<string, unknown>
  const eventId = ents.event_id as string
  const eventTitle = (ents.event_title as string) || 'Evento'

  if (!eventId) {
    return { success: false, message: '❌ Não encontrei o ID do evento pra cancelar.', error: 'Missing event_id' }
  }

  // Hard delete (mesmo padrão do frontend — RLS permite DELETE para authenticated)
  const { error: deleteError } = await supabase
    .from('calendar_items')
    .delete()
    .eq('id', eventId)

  if (deleteError) {
    console.error(`[WA-09] Calendar delete failed:`, deleteError)
    return { success: false, message: '❌ Erro ao cancelar o evento.', error: deleteError.message }
  }

  console.log(`[WA-09] ✅ Calendar event deleted: ${eventId}`)

  return {
    success: true,
    message: `Pronto, cancelei o evento *${eventTitle}*. 🗑️`,
    record_id: eventId,
  }
}
