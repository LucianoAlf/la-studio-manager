/**
 * action-executor.ts
 * Executa ações confirmadas pelo usuário no WhatsApp
 *
 * WA-03: INSERT real em kanban_cards, calendar_items, whatsapp_scheduled_messages
 * Chamado pelo message-router.ts quando usuário confirma com "sim"
 */

import type { ExtractedEntities } from './gemini-classifier.ts'

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
}

// ============================================
// MAPEAMENTO DE SLUGS (WA-02 → DB)
// ============================================
// O NLP do WA-02 classifica como 'brainstorm', DB tem 'brainstorming'
const COLUMN_SLUG_MAP: Record<string, string> = {
  'brainstorm': 'brainstorming',
  'brainstorming': 'brainstorming',
  'planning': 'planning',
  'todo': 'todo',
  'capturing': 'capturing',
  'editing': 'editing',
  'awaiting_approval': 'awaiting_approval',
  'approved': 'approved',
  'published': 'published',
  'archived': 'archived',
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
  const columnSlug = COLUMN_SLUG_MAP[entities.column || 'brainstorm'] || 'brainstorming'

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

  // 3. Preparar dados do card
  // deno-lint-ignore no-explicit-any
  const cardData: Record<string, any> = {
    title: entities.title || 'Card sem título',
    description: entities.description || null,
    card_type: 'single_post',
    column_id: column.id,
    position_in_column: nextPosition,
    created_by: authUserId,          // ← auth.users.id (FK de kanban_cards)
    responsible_user_id: authUserId, // Criador é também responsável
    priority: entities.priority || 'medium',
    content_type: entities.content_type || null,
    platforms: entities.platforms || [],
    tags: entities.brand ? [entities.brand] : [],
    moved_to_column_at: new Date().toISOString(),
    metadata: {
      created_via: 'whatsapp',
      brand: entities.brand || 'la_music',
      original_message: entities.raw_text || null,
    },
  }

  // 4. Resolver due_date se houver data nas entidades
  if (entities.date) {
    const resolvedDate = resolveRelativeDate(entities.date, entities.time)
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

  // 6. Montar resposta de sucesso
  const emoji = getPriorityEmoji(entities.priority || 'medium')
  return {
    success: true,
    record_id: card.id,
    message: `✅ Card criado com sucesso!\n\n` +
      `📝 *${card.title}*\n` +
      `${emoji} Prioridade: ${formatPriority(entities.priority || 'medium')}\n` +
      `📋 Coluna: ${column.name}\n` +
      (entities.content_type ? `🎬 Tipo: ${entities.content_type}\n` : '') +
      (entities.brand ? `🏷️ Marca: ${entities.brand === 'la_kids' ? 'LA Kids' : 'LA Music'}\n` : '') +
      `\n🔮 O card já apareceu no dashboard!`,
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

  // 5. Montar resposta de sucesso
  const dateStr = formatDateBR(startTime)
  const timeStr = entities.time ? ` às ${entities.time}` : ' (dia todo)'
  const typeEmoji = getCalendarTypeEmoji(calendarType)

  return {
    success: true,
    record_id: item.id,
    message: `✅ Item criado no calendário!\n\n` +
      `${typeEmoji} *${item.title}*\n` +
      `📆 ${dateStr}${timeStr}\n` +
      (durationMinutes && !allDay ? `⏱️ Duração: ${durationMinutes} min\n` : '') +
      (entities.content_type ? `🎬 Tipo: ${entities.content_type}\n` : '') +
      `\n🔮 O evento já apareceu no calendário do dashboard!`,
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

  // 2. Montar conteúdo do lembrete
  const reminderContent = `⏰ *Lembrete!*\n\n${entities.reminder_text || entities.title || 'Lembrete sem descrição'}`

  // 3. INSERT
  const { data: reminder, error: insertError } = await supabase
    .from('whatsapp_scheduled_messages')
    .insert({
      target_type: 'user',
      target_user_id: profileId,    // ← user_profiles.id (FK de scheduled_messages)
      target_phone: phone,
      message_type: 'text',
      content: reminderContent,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
      source: 'manual',             // Criado pelo usuário via WhatsApp
      metadata: {
        created_via: 'whatsapp',
        original_date_text: entities.reminder_date || entities.date || null,
        original_time_text: entities.reminder_time || entities.time || null,
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

  console.log(`[WA-03] Reminder created: ${reminder.id} for ${scheduledFor.toISOString()}`)

  // 4. Montar resposta de sucesso
  const dateStr = formatDateBR(scheduledFor)
  const timeStr = formatTimeBR(scheduledFor)

  return {
    success: true,
    record_id: reminder.id,
    message: `✅ Lembrete criado!\n\n` +
      `📝 *${entities.reminder_text || entities.title || 'Lembrete'}*\n` +
      `📆 ${dateStr} às ${timeStr}\n` +
      `\n📱 Vou te mandar uma mensagem nesse horário!`,
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
    result = new Date(normalizedDate + 'T12:00:00')
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
