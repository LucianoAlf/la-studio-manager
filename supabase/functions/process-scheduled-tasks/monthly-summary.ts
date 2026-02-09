/**
 * monthly-summary.ts — WA-08
 * Gera e envia resumo mensal via WhatsApp.
 * Rodado pelo pg_cron todo dia às 12:00 UTC (9h SP).
 * Verifica se o dia atual corresponde ao monthly_summary_day do usuário.
 * 
 * Conteúdo:
 * 1. Produção mensal (cards criados vs publicados)
 * 2. Eventos do mês (total, concluídos, cancelados)
 * 3. Fluxo Kanban (snapshot atual)
 * 4. Top tipos de conteúdo
 * 5. Comparativo com mês anterior
 * 6. Alertas
 */

import {
  sendWhatsApp, getDateRangeForPeriod, formatDateShort,
  getUserPhone, getSPNow, isInQuietHours, isWithinScheduledTime,
  getPriorityEmoji,
} from './report-helpers.ts'

export async function processMonthlySummary(
  supabase: any,
  uazapiUrl: string,
  uazapiToken: string
): Promise<{ processed: number; errors: number }> {
  // Buscar usuários com monthly summary habilitado
  const { data: subscribers, error } = await supabase
    .from('user_notification_settings')
    .select(`
      user_id,
      monthly_summary_enabled,
      monthly_summary_day,
      monthly_summary_time,
      user:user_profiles!user_notification_settings_user_id_fkey(
        id, full_name, user_id, role
      )
    `)
    .eq('monthly_summary_enabled', true)

  if (error || !subscribers || subscribers.length === 0) {
    console.log('[WA-08] No monthly summary subscribers found')
    return { processed: 0, errors: 0 }
  }

  console.log(`[WA-08] Generating monthly summary for ${subscribers.length} user(s)`)

  // Dia do mês atual em SP
  const spNow = getSPNow()
  const currentDayOfMonth = spNow.getUTCDate()

  let processed = 0
  let errors = 0

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      // Verificar se o dia configurado corresponde ao dia atual
      const configuredDay = sub.monthly_summary_day ?? 1 // default: dia 1
      if (currentDayOfMonth !== configuredDay) {
        continue
      }

      // Verificar se o horário configurado corresponde ao horário atual
      if (!isWithinScheduledTime(sub.monthly_summary_time)) {
        console.log(`[WA-08] Skipping ${profile.full_name}: monthly time ${sub.monthly_summary_time} not matching`)
        continue
      }

      // Verificar quiet hours
      const isQuiet = await isInQuietHours(supabase, profile.id)
      if (isQuiet) {
        console.log(`[WA-08] Skipping ${profile.full_name}: in quiet hours`)
        continue
      }

      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) continue

      const summaryText = await generateMonthlyContent(supabase, profile)

      const result = await sendWhatsApp(uazapiUrl, uazapiToken, phone, summaryText)

      if (result.success) {
        console.log(`[WA-08] ✅ Monthly summary sent to ${profile.full_name}`)

        const { error: memError } = await supabase.rpc('save_memory_episode', {
          p_user_id: profile.id,
          p_summary: `Enviei resumo mensal para ${profile.full_name}.`,
          p_entities: { report_type: 'monthly_summary' },
          p_outcome: 'info_provided',
          p_importance: 0.4,
          p_source: 'whatsapp',
        })
        if (memError) console.error('[WA-08] Episode save error:', memError)

        processed++
      } else {
        console.error(`[WA-08] ❌ Failed to send monthly to ${profile.full_name}: ${result.error}`)
        errors++
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      console.error(`[WA-08] Error generating monthly for ${sub.user_id}:`, err)
      errors++
    }
  }

  return { processed, errors }
}


// ============================================
// GERAÇÃO DE CONTEÚDO MENSAL
// ============================================

async function generateMonthlyContent(supabase: any, profile: any): Promise<string> {
  const firstName = profile.full_name.split(' ')[0]
  const spNow = getSPNow()

  // Mês anterior (o relatório é sobre o mês que acabou)
  const lastMonthEnd = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), 0, 23, 59, 59))
  const lastMonthStart = new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1, 0, 0, 0))

  // Mês retrasado (para comparativo)
  const prevMonthEnd = new Date(Date.UTC(lastMonthStart.getUTCFullYear(), lastMonthStart.getUTCMonth(), 0, 23, 59, 59))
  const prevMonthStart = new Date(Date.UTC(prevMonthEnd.getUTCFullYear(), prevMonthEnd.getUTCMonth(), 1, 0, 0, 0))

  // Converter para UTC (SP é UTC-3, então UTC = SP + 3h)
  const toUTC = (d: Date) => new Date(d.getTime() + 3 * 60 * 60000)
  const lmStartUTC = toUTC(lastMonthStart)
  const lmEndUTC = toUTC(lastMonthEnd)
  const pmStartUTC = toUTC(prevMonthStart)
  const pmEndUTC = toUTC(prevMonthEnd)

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  const monthLabel = monthNames[lastMonthEnd.getUTCMonth()]
  const yearLabel = lastMonthEnd.getUTCFullYear()

  const sections: string[] = []
  sections.push(`📊 *Relatório Mensal — ${monthLabel} ${yearLabel}*\n`)
  sections.push(`Olá, ${firstName}! Aqui vai o balanço completo do mês:\n`)

  // ── PRODUÇÃO ──
  const { data: newCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, content_type')
    .gte('created_at', lmStartUTC.toISOString())
    .lte('created_at', lmEndUTC.toISOString())
    .is('deleted_at', null)

  const { data: prevCards } = await supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', pmStartUTC.toISOString())
    .lte('created_at', pmEndUTC.toISOString())
    .is('deleted_at', null)

  const { data: publishedCol } = await supabase
    .from('kanban_columns').select('id').eq('slug', 'published').single()

  let publishedCount = 0
  let prevPublishedCount = 0
  if (publishedCol?.id) {
    const { count: pubCount } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('column_id', publishedCol.id)
      .gte('moved_to_column_at', lmStartUTC.toISOString())
      .lte('moved_to_column_at', lmEndUTC.toISOString())
      .is('deleted_at', null)
    publishedCount = pubCount ?? 0

    const { count: prevPubCount } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('column_id', publishedCol.id)
      .gte('moved_to_column_at', pmStartUTC.toISOString())
      .lte('moved_to_column_at', pmEndUTC.toISOString())
      .is('deleted_at', null)
    prevPublishedCount = prevPubCount ?? 0
  }

  const newCardsCount = newCards?.length ?? 0
  const prevCardsCount = prevCards?.count ?? 0
  const pubRate = newCardsCount > 0 ? Math.round((publishedCount / newCardsCount) * 100) : 0

  sections.push(`📋 *Produção:*`)
  sections.push(`  Cards criados: ${newCardsCount} ${getCompareArrow(newCardsCount, prevCardsCount)}`)
  sections.push(`  Cards publicados: ${publishedCount} ${getCompareArrow(publishedCount, prevPublishedCount)}`)
  sections.push(`  Taxa de publicação: ${pubRate}%`)

  // ── TOP TIPOS DE CONTEÚDO ──
  if (newCards && newCards.length > 0) {
    const typeCounts: Record<string, number> = {}
    for (const c of newCards) {
      const ct = c.content_type || 'outro'
      typeCounts[ct] = (typeCounts[ct] || 0) + 1
    }
    const sortedTypes = Object.entries(typeCounts).sort(([, a], [, b]) => b - a).slice(0, 3)
    if (sortedTypes.length > 0) {
      const typeLines = sortedTypes.map(([type, count]) =>
        `  • ${type}: ${count} (${Math.round((count / newCardsCount) * 100)}%)`
      )
      sections.push(`\n🎬 *Top conteúdos:*`)
      sections.push(typeLines.join('\n'))
    }
  }

  // ── EVENTOS ──
  const { data: events } = await supabase
    .from('calendar_items')
    .select('id, status')
    .gte('start_time', lmStartUTC.toISOString())
    .lte('start_time', lmEndUTC.toISOString())
    .is('deleted_at', null)

  const totalEvents = events?.length ?? 0
  const completedEvents = events?.filter((e: any) => e.status === 'completed').length ?? 0
  const cancelledEvents = events?.filter((e: any) => e.status === 'cancelled').length ?? 0
  const eventRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0

  sections.push(`\n📅 *Eventos:*`)
  sections.push(`  Total: ${totalEvents}`)
  sections.push(`  Concluídos: ${completedEvents} (${eventRate}%)`)
  if (cancelledEvents > 0) {
    sections.push(`  Cancelados: ${cancelledEvents}`)
  }

  // ── KANBAN SNAPSHOT ──
  const { data: columns } = await supabase
    .from('kanban_columns')
    .select('id, name, slug, position')
    .order('position', { ascending: true })

  const { data: cardCounts } = await supabase.rpc('get_cards_count_by_column')

  if (cardCounts && columns) {
    const countMap: Record<string, number> = {}
    for (const row of cardCounts) {
      countMap[row.column_id] = Number(row.card_count)
    }

    const colLines = columns
      .filter((c: any) => !['archived'].includes(c.slug) && (countMap[c.id] || 0) > 0)
      .map((c: any) => {
        const count = countMap[c.id] || 0
        const bar = '█'.repeat(Math.min(count, 10))
        return `  ${c.name}: ${count} ${bar}`
      })

    if (colLines.length > 0) {
      sections.push(`\n📊 *Kanban (snapshot atual):*`)
      sections.push(colLines.join('\n'))
    }
  }

  // ── ALERTAS ──
  const finishedIds = (columns || [])
    .filter((c: any) => ['published', 'archived'].includes(c.slug))
    .map((c: any) => c.id)

  let urgentQuery = supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .eq('priority', 'urgent')
    .is('deleted_at', null)
  for (const fId of finishedIds) {
    urgentQuery = urgentQuery.neq('column_id', fId)
  }
  const { count: urgentCount } = await urgentQuery

  let overdueQuery = supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .lt('due_date', new Date().toISOString())
    .is('deleted_at', null)
  for (const fId of finishedIds) {
    overdueQuery = overdueQuery.neq('column_id', fId)
  }
  const { count: overdueCount } = await overdueQuery

  const alerts: string[] = []
  if (urgentCount && urgentCount > 0) alerts.push(`  🔴 ${urgentCount} card(s) urgente(s) ativo(s)`)
  if (overdueCount && overdueCount > 0) alerts.push(`  ⚠️ ${overdueCount} card(s) com prazo vencido`)

  if (alerts.length > 0) {
    sections.push(`\n🚨 *Atenção:*`)
    sections.push(alerts.join('\n'))
  }

  sections.push(`\nBom mês! 🎵`)

  return sections.join('\n')
}


/**
 * Retorna seta de comparação com mês anterior
 */
function getCompareArrow(current: number, previous: number): string {
  if (previous === 0) return ''
  const diff = current - previous
  const pct = Math.round((diff / previous) * 100)
  if (diff > 0) return `(↑${pct}%)`
  if (diff < 0) return `(↓${Math.abs(pct)}%)`
  return '(=)'
}
