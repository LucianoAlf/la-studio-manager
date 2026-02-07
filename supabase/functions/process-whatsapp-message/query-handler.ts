/**
 * query-handler.ts — WA-04
 * Executa consultas reais ao banco para responder perguntas via WhatsApp.
 * 
 * ⚠️ responsible_user_id referencia auth.users, NÃO user_profiles.
 * Para obter nomes, fazemos lookup manual via user_profiles.user_id.
 */

import type { ExtractedEntities } from './gemini-classifier.ts'

// ============================================
// TIPOS
// ============================================

export interface QueryResult {
  text: string            // Mensagem formatada para WhatsApp
  resultCount: number     // Quantos itens retornaram
  queryType: string       // Para episódio de memória
}

export interface QueryContext {
  // deno-lint-ignore no-explicit-any
  supabase: any
  profileId: string       // user_profiles.id
  authUserId: string      // auth.users.id (vem do WA-03, já resolvido)
  userName: string
  entities: ExtractedEntities
}

// ============================================
// HELPER: Resolver nomes de auth_user_ids
// ============================================

/**
 * Recebe array de auth.users.id e retorna mapa { auth_user_id → full_name }.
 * Usa user_profiles.user_id para o lookup (user_id = auth_user_id).
 */
async function resolveUserNames(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  authUserIds: string[]
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {}
  if (!authUserIds || authUserIds.length === 0) return nameMap

  // Deduplicar e filtrar nulls
  const uniqueIds = [...new Set(authUserIds.filter(Boolean))]
  if (uniqueIds.length === 0) return nameMap

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', uniqueIds)

  if (error || !profiles) {
    console.error('[WA-04] resolveUserNames error:', error)
    return nameMap
  }

  // deno-lint-ignore no-explicit-any
  for (const p of profiles as any[]) {
    if (p.user_id && p.full_name) {
      nameMap[p.user_id] = p.full_name
    }
  }

  return nameMap
}

// ============================================
// HELPERS DE DATA — Timezone São Paulo (UTC-3)
// Usa Date.now() e Date.UTC() — funciona em qualquer runtime
// ============================================

/**
 * "Agora" em São Paulo. Funciona independente do timezone do runtime.
 */
function getSPNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60000)
}

/**
 * Retorna { start, end } em UTC para o período solicitado.
 * Cálculos feitos em "hora SP", convertidos para UTC via Date.UTC(h+3).
 */
function getDateRange(period: string): { start: Date; end: Date } {
  const sp = getSPNow()
  const spYear = sp.getUTCFullYear()
  const spMonth = sp.getUTCMonth()
  const spDate = sp.getUTCDate()
  const spDay = sp.getUTCDay() // 0=dom

  // Cria timestamp UTC a partir de "hora SP" (soma 3h para converter SP→UTC)
  function spToUtc(y: number, m: number, d: number, h: number, min: number): Date {
    return new Date(Date.UTC(y, m, d, h + 3, min))
  }

  switch (period) {
    case 'today':
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }

    case 'tomorrow': {
      const tmrDate = spDate + 1 // Date.UTC normaliza overflow automaticamente
      return {
        start: spToUtc(spYear, spMonth, tmrDate, 0, 0),
        end: spToUtc(spYear, spMonth, tmrDate, 23, 59),
      }
    }

    case 'this_week': {
      // Segunda a Domingo da semana atual
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const mondayDate = spDate + mondayOffset
      return {
        start: spToUtc(spYear, spMonth, mondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, mondayDate + 6, 23, 59),
      }
    }

    case 'next_week': {
      const daysToNextMon = spDay === 0 ? 1 : 8 - spDay
      const nextMondayDate = spDate + daysToNextMon
      return {
        start: spToUtc(spYear, spMonth, nextMondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, nextMondayDate + 6, 23, 59),
      }
    }

    case 'this_month':
      return {
        start: spToUtc(spYear, spMonth, 1, 0, 0),
        end: spToUtc(spYear, spMonth + 1, 0, 23, 59), // dia 0 do mês seguinte = último dia
      }

    default: // fallback: hoje
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }
  }
}

function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[sp.getUTCDay()]} ${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')} ${sp.getUTCHours().toString().padStart(2, '0')}:${sp.getUTCMinutes().toString().padStart(2, '0')}`
}

function formatDateOnlyBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')}`
}

function getPeriodLabel(period: string): string {
  return ({ today: 'hoje', tomorrow: 'amanhã', this_week: 'esta semana', next_week: 'semana que vem', this_month: 'este mês' } as Record<string, string>)[period] || period
}

function getPriorityEmoji(p: string): string {
  return ({ urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' } as Record<string, string>)[p] || '🟡'
}

function getCalendarTypeEmoji(t: string): string {
  return ({ event: '🎉', delivery: '📦', creation: '🎨', task: '✅', meeting: '🤝' } as Record<string, string>)[t] || '📅'
}

// ============================================
// QUERY: CALENDÁRIO
// ============================================

export async function handleQueryCalendar(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx
  const period = entities.query_period || 'today'
  const { start, end } = getDateRange(period)

  console.log(`[WA-04] Query calendar: period=${period}, range=${start.toISOString()} → ${end.toISOString()}`)

  // Buscar itens SEM join de responsible (FK → auth.users, não user_profiles)
  let query = supabase
    .from('calendar_items')
    .select('id, title, type, status, start_time, end_time, all_day, content_type, platforms, responsible_user_id')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time', { ascending: true })
    .limit(20)

  // Filtro por tipo se especificado
  if (entities.query_filter) {
    const filter = entities.query_filter.toLowerCase()
    if (['event', 'delivery', 'creation', 'task', 'meeting'].includes(filter)) {
      query = query.eq('type', filter)
    }
  }

  const { data: items, error } = await query

  if (error) {
    console.error('[WA-04] Calendar query error:', error)
    return { text: `❌ Erro ao consultar agenda, ${userName}. Tente novamente.`, resultCount: 0, queryType: 'query_calendar' }
  }

  if (!items || items.length === 0) {
    return {
      text: `📅 Nenhum item na agenda para ${getPeriodLabel(period)}, ${userName}.\n\nQuer adicionar algo? Ex: "agenda reunião pra sexta às 14h"`,
      resultCount: 0, queryType: 'query_calendar',
    }
  }

  // Resolver nomes via lookup manual
  // deno-lint-ignore no-explicit-any
  const responsibleIds = items.map((i: any) => i.responsible_user_id).filter(Boolean)
  const nameMap = await resolveUserNames(supabase, responsibleIds)

  const header = `📅 *Agenda ${getPeriodLabel(period)}* (${items.length} ${items.length === 1 ? 'item' : 'itens'}):\n`

  // deno-lint-ignore no-explicit-any
  const lines = items.map((item: any, i: number) => {
    const emoji = getCalendarTypeEmoji(item.type)
    const time = item.all_day ? '🕐 Dia inteiro' : formatDateTimeBR(item.start_time)
    const responsible = item.responsible_user_id ? nameMap[item.responsible_user_id] : null
    const responsibleText = responsible ? ` → ${responsible}` : ''
    const statusEmoji = item.status === 'completed' ? ' ✅' : item.status === 'in_progress' ? ' 🔄' : ''
    return `${i + 1}. ${emoji} *${item.title}*${statusEmoji}\n   ${time}${responsibleText}`
  })

  return { text: header + lines.join('\n\n'), resultCount: items.length, queryType: 'query_calendar' }
}

// ============================================
// QUERY: CARDS / KANBAN
// ============================================

export async function handleQueryCards(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx

  console.log(`[WA-04] Query cards: filter=${entities.query_filter}, priority=${entities.priority}, column=${entities.column}`)

  // Join de column OK (kanban_cards.column_id → kanban_columns.id é FK direta)
  // SEM join de responsible (FK → auth.users)
  let query = supabase
    .from('kanban_cards')
    .select(`
      id, title, priority, due_date, content_type, platforms, tags,
      responsible_user_id,
      column:kanban_columns!kanban_cards_column_id_fkey(name, slug)
    `)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(15)

  // Filtro por prioridade
  if (entities.priority) {
    query = query.eq('priority', entities.priority)
  }

  // Filtro por coluna (resolver slug → column_id)
  if (entities.column) {
    const slugMap: Record<string, string> = {
      'brainstorm': 'brainstorming', 'brainstorming': 'brainstorming',
      'planning': 'planning', 'todo': 'todo', 'capturing': 'capturing',
      'editing': 'editing', 'awaiting_approval': 'awaiting_approval',
      'approved': 'approved', 'published': 'published', 'archived': 'archived',
    }
    const realSlug = slugMap[entities.column] || entities.column

    const { data: col } = await supabase
      .from('kanban_columns').select('id').eq('slug', realSlug).single()

    if (col?.id) {
      query = query.eq('column_id', col.id)
    }
  }

  // Filtro por marca (tag)
  if (entities.brand) {
    query = query.contains('tags', [entities.brand])
  }

  // Excluir archived + published por padrão (quando não filtrando coluna específica)
  if (!entities.column) {
    const { data: excludedCols } = await supabase
      .from('kanban_columns').select('id').in('slug', ['archived', 'published'])

    if (excludedCols && excludedCols.length > 0) {
      // deno-lint-ignore no-explicit-any
      for (const exCol of excludedCols as any[]) {
        query = query.neq('column_id', exCol.id)
      }
    }
  }

  const { data: cards, error } = await query

  if (error) {
    console.error('[WA-04] Cards query error:', error)
    return { text: `❌ Erro ao consultar cards, ${userName}. Tente novamente.`, resultCount: 0, queryType: 'query_cards' }
  }

  if (!cards || cards.length === 0) {
    const filterDesc = entities.priority
      ? `com prioridade ${entities.priority}`
      : entities.column ? `na coluna ${entities.column}` : 'ativos'
    return {
      text: `📋 Nenhum card ${filterDesc} encontrado, ${userName}.\n\nQuer criar um? Ex: "cria card urgente pra gravar vídeo"`,
      resultCount: 0, queryType: 'query_cards',
    }
  }

  // Resolver nomes via lookup manual
  // deno-lint-ignore no-explicit-any
  const responsibleIds = cards.map((c: any) => c.responsible_user_id).filter(Boolean)
  const nameMap = await resolveUserNames(supabase, responsibleIds)

  const filterLabel = entities.priority
    ? `prioridade ${entities.priority}`
    : entities.column ? `coluna ${entities.column}` : 'ativos'

  const header = `📋 *Cards ${filterLabel}* (${cards.length}):\n`

  // deno-lint-ignore no-explicit-any
  const lines = cards.map((card: any, i: number) => {
    const emoji = getPriorityEmoji(card.priority)
    const colName = card.column?.name || '?'
    const responsible = card.responsible_user_id ? nameMap[card.responsible_user_id] : null
    const dueText = card.due_date ? `\n   📅 ${formatDateOnlyBR(card.due_date)}` : ''
    const responsibleText = responsible ? ` → ${responsible}` : ''
    return `${i + 1}. ${emoji} *${card.title}*\n   📍 ${colName}${responsibleText}${dueText}`
  })

  return { text: header + lines.join('\n\n'), resultCount: cards.length, queryType: 'query_cards' }
}

// ============================================
// QUERY: STATUS DO PROJETO
// Usa RPC get_cards_count_by_column() — 1 query em vez de N
// ============================================

export async function handleQueryProjects(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName } = ctx

  console.log(`[WA-04] Query projects`)

  // Buscar colunas
  const { data: columns, error: colError } = await supabase
    .from('kanban_columns')
    .select('id, name, slug, position')
    .order('position', { ascending: true })

  if (colError || !columns) {
    return { text: `❌ Erro ao consultar projeto, ${userName}.`, resultCount: 0, queryType: 'query_projects' }
  }

  // Uma única query via RPC em vez de N queries sequenciais
  const { data: cardCounts, error: countError } = await supabase.rpc('get_cards_count_by_column')

  const countMap: Record<string, number> = {}
  if (!countError && cardCounts) {
    // deno-lint-ignore no-explicit-any
    for (const row of cardCounts as any[]) {
      countMap[row.column_id] = Number(row.card_count)
    }
  }

  let totalCards = 0
  // deno-lint-ignore no-explicit-any
  const counts = columns.map((col: any) => {
    const c = countMap[col.id] || 0
    totalCards += c
    return { name: col.name, count: c, slug: col.slug }
  })

  // Cards urgentes (1 query)
  const { count: urgentCount } = await supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .eq('priority', 'urgent')
    .is('deleted_at', null)

  // Cards com prazo vencido (excluindo published/archived)
  // deno-lint-ignore no-explicit-any
  const finishedIds = columns
    .filter((c: any) => ['published', 'archived'].includes(c.slug))
    .map((c: any) => c.id)

  let overdueQuery = supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .lt('due_date', new Date().toISOString())
    .is('deleted_at', null)

  for (const fId of finishedIds) {
    overdueQuery = overdueQuery.neq('column_id', fId)
  }
  const { count: overdueCount } = await overdueQuery

  // Formatar
  const header = `📊 *Status do Projeto* (${totalCards} cards total):\n`

  // deno-lint-ignore no-explicit-any
  const colLines = counts
    .filter((c: any) => c.count > 0)
    .map((c: any) => {
      const bar = '█'.repeat(Math.min(c.count, 10)) + (c.count > 10 ? '…' : '')
      return `  ${c.name}: ${c.count} ${bar}`
    })

  const alerts: string[] = []
  if (urgentCount && urgentCount > 0) alerts.push(`🔴 ${urgentCount} card(s) urgente(s)`)
  if (overdueCount && overdueCount > 0) alerts.push(`⚠️ ${overdueCount} card(s) com prazo vencido`)

  const alertSection = alerts.length > 0 ? `\n\n*Alertas:*\n${alerts.join('\n')}` : ''

  return { text: header + colLines.join('\n') + alertSection, resultCount: totalCards, queryType: 'query_projects' }
}

// ============================================
// QUERY: RELATÓRIO / RESUMO
// ============================================

export async function handleGenerateReport(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx
  const period = entities.query_period || 'this_week'
  const { start, end } = getDateRange(period)

  console.log(`[WA-04] Generate report: period=${period}`)

  // Cards criados no período
  const { data: newCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, column:kanban_columns!kanban_cards_column_id_fkey(name)')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // Cards publicados no período
  const { data: publishedCol } = await supabase
    .from('kanban_columns').select('id').eq('slug', 'published').single()

  let publishedCount = 0
  if (publishedCol?.id) {
    const { count } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('column_id', publishedCol.id)
      .gte('moved_to_column_at', start.toISOString())
      .lte('moved_to_column_at', end.toISOString())
      .is('deleted_at', null)
    publishedCount = count ?? 0
  }

  // Calendar items no período
  const { data: events } = await supabase
    .from('calendar_items')
    .select('id, title, type, status')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  // deno-lint-ignore no-explicit-any
  const completedEvents = events?.filter((e: any) => e.status === 'completed').length ?? 0
  const totalEvents = events?.length ?? 0
  const newCardsCount = newCards?.length ?? 0

  const header = `📈 *Resumo ${getPeriodLabel(period)}*\n`

  const sections = [
    `📋 *Cards criados:* ${newCardsCount}`,
    `✅ *Cards publicados:* ${publishedCount}`,
    `📅 *Eventos:* ${totalEvents} (${completedEvents} concluído${completedEvents !== 1 ? 's' : ''})`,
  ]

  if (newCards && newCards.length > 0) {
    // deno-lint-ignore no-explicit-any
    const topCards = newCards.slice(0, 5).map((c: any, i: number) =>
      `   ${i + 1}. ${getPriorityEmoji(c.priority)} ${c.title} → ${c.column?.name || '?'}`
    ).join('\n')
    sections.push(`\n📝 *Últimos cards criados:*\n${topCards}`)
  }

  return { text: header + sections.join('\n'), resultCount: newCardsCount + totalEvents, queryType: 'generate_report' }
}
