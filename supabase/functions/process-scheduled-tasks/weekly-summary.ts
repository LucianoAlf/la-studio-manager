/**
 * weekly-summary.ts — WA-05
 * Gera e envia resumo semanal via WhatsApp.
 * Rodado pelo pg_cron toda segunda 9:00 SP (12:00 UTC).
 * 
 * Conteúdo:
 * 1. Produção (cards criados vs publicados)
 * 2. Eventos (total, concluídos)
 * 3. Fluxo Kanban (contagem por coluna)
 * 4. Alertas
 * 5. Insight personalizado (memória)
 */

import {
  sendWhatsApp, getDateRangeForPeriod, formatDateShort,
  getUserPhone, getSPNow, isInQuietHours, isWithinScheduledTime,
} from './report-helpers.ts'

export async function processWeeklySummary(
  supabase: any,
  uazapiUrl: string,
  uazapiToken: string
): Promise<{ processed: number; errors: number }> {
  // Buscar usuários com weekly summary habilitado
  const { data: subscribers, error } = await supabase
    .from('user_notification_preferences')
    .select(`
      user_id,
      weekly_summary_enabled,
      weekly_summary_day,
      weekly_summary_time,
      user:user_profiles!user_notification_preferences_user_id_fkey(
        id, full_name, user_id, role
      )
    `)
    .eq('weekly_summary_enabled', true)

  if (error || !subscribers || subscribers.length === 0) {
    console.log('[WA-05] No weekly summary subscribers found')
    return { processed: 0, errors: 0 }
  }

  console.log(`[WA-05] Generating weekly summary for ${subscribers.length} user(s)`)

  // Dia da semana atual em SP (0=Dom, 1=Seg, ..., 6=Sáb)
  const spNow = getSPNow()
  const currentDayOfWeek = spNow.getUTCDay()

  let processed = 0
  let errors = 0

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      // Verificar se o dia configurado corresponde ao dia atual
      const configuredDay = sub.weekly_summary_day ?? 1 // default: segunda
      if (currentDayOfWeek !== configuredDay) {
        console.log(`[WA-05] Skipping ${profile.full_name}: summary day ${configuredDay} != current ${currentDayOfWeek}`)
        continue
      }

      // Verificar se o horário configurado corresponde ao horário atual
      if (!isWithinScheduledTime(sub.weekly_summary_time)) {
        console.log(`[WA-05] Skipping ${profile.full_name}: summary time ${sub.weekly_summary_time} not matching`)
        continue
      }

      // Verificar quiet hours
      const isQuiet = await isInQuietHours(supabase, profile.id)
      if (isQuiet) {
        console.log(`[WA-05] Skipping ${profile.full_name}: in quiet hours`)
        continue
      }

      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) continue

      const summaryText = await generateWeeklyContent(supabase, profile)

      const result = await sendWhatsApp(uazapiUrl, uazapiToken, phone, summaryText)

      if (result.success) {
        console.log(`[WA-05] ✅ Weekly summary sent to ${profile.full_name}`)

        const { error: memError } = await supabase.rpc('save_memory_episode', {
          p_user_id: profile.id,
          p_summary: `Enviei resumo semanal para ${profile.full_name}.`,
          p_entities: { report_type: 'weekly_summary' },
          p_outcome: 'info_provided',
          p_importance: 0.3,
          p_source: 'whatsapp',
        })
        if (memError) console.error('[WA-05] Episode save error:', memError)

        processed++
      } else {
        errors++
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (err) {
      console.error(`[WA-05] Error generating weekly for ${sub.user_id}:`, err)
      errors++
    }
  }

  return { processed, errors }
}


async function generateWeeklyContent(supabase: any, profile: any): Promise<string> {
  const firstName = profile.full_name.split(' ')[0]

  // Semana passada (segunda a domingo)
  const { start, end } = getDateRangeForPeriod('last_week')

  const startLabel = formatDateShort(start)
  const endLabel = formatDateShort(end)

  const sections: string[] = []
  sections.push(`📊 *Resumo Semanal* — ${startLabel} a ${endLabel}\n`)
  sections.push(`Olá, ${firstName}! Aqui vai o balanço da semana:\n`)

  // ── PRODUÇÃO ──
  const { data: newCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .is('deleted_at', null)

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

  const newCardsCount = newCards?.length ?? 0
  const pubRate = newCardsCount > 0 ? Math.round((publishedCount / newCardsCount) * 100) : 0

  sections.push(`📋 *Produção:*`)
  sections.push(`  Cards criados: ${newCardsCount}`)
  sections.push(`  Cards publicados: ${publishedCount}`)
  sections.push(`  Taxa de publicação: ${pubRate}%`)

  // ── EVENTOS ──
  const { data: events } = await supabase
    .from('calendar_items')
    .select('id, status')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  const totalEvents = events?.length ?? 0
  const completedEvents = events?.filter((e: any) => e.status === 'completed').length ?? 0
  const eventRate = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0

  sections.push(`\n📅 *Eventos:*`)
  sections.push(`  Total: ${totalEvents}`)
  sections.push(`  Concluídos: ${completedEvents} (${eventRate}%)`)

  // ── FLUXO KANBAN ──
  const { data: cardCounts } = await supabase.rpc('get_cards_count_by_column')
  const { data: columns } = await supabase
    .from('kanban_columns')
    .select('id, name, slug, position')
    .order('position', { ascending: true })

  if (cardCounts && columns) {
    const countMap: Record<string, number> = {}
    for (const row of cardCounts) {
      countMap[row.column_id] = Number(row.card_count)
    }

    const colLines = columns
      .filter((c: any) => !['archived'].includes(c.slug) && (countMap[c.id] || 0) > 0)
      .map((c: any) => {
        const count = countMap[c.id] || 0
        const bar = '█'.repeat(Math.min(count, 8))
        return `  ${c.name}: ${count} ${bar}`
      })

    if (colLines.length > 0) {
      sections.push(`\n📊 *Kanban:*`)
      sections.push(colLines.join('\n'))
    }
  }

  // ── ALERTAS ──
  // Fix Bug #5: urgentCount deve excluir published/archived
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
  if (urgentCount && urgentCount > 0) alerts.push(`  🔴 ${urgentCount} card(s) urgente(s)`)
  if (overdueCount && overdueCount > 0) alerts.push(`  ⚠️ ${overdueCount} card(s) com prazo vencido`)

  if (alerts.length > 0) {
    sections.push(`\n🚨 *Atenção:*`)
    sections.push(alerts.join('\n'))
  }

  // ── INSIGHT ──
  const { data: topCards } = await supabase
    .from('kanban_cards')
    .select('content_type')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .is('deleted_at', null)

  if (topCards && topCards.length > 5) {
    const typeCounts: Record<string, number> = {}
    for (const c of topCards) {
      if (c.content_type) {
        typeCounts[c.content_type] = (typeCounts[c.content_type] || 0) + 1
      }
    }
    const topType = Object.entries(typeCounts).sort(([,a], [,b]) => b - a)[0]
    if (topType) {
      sections.push(`\n💡 *Insight:* Esta semana, ${topType[1]}/${newCardsCount} cards são de tipo "${topType[0]}".`)
    }
  }

  sections.push(`\nBoa semana! 🎵`)

  return sections.join('\n')
}
