/**
 * daily-digest.ts — WA-05
 * Gera e envia resumo diário personalizado via WhatsApp.
 * Rodado pelo pg_cron às 9:00 SP (12:00 UTC).
 * 
 * Conteúdo:
 * 1. Saudação personalizada (com memória)
 * 2. Agenda do dia (calendar_items)
 * 3. Cards urgentes/vencidos
 * 4. Insight baseado em memória
 */

import {
  sendWhatsApp, getDateRangeForPeriod, formatDateTimeBR, formatDateOnlyBR,
  resolveUserNames, getCalendarTypeEmoji, getUserPhone, getSPNow,
  isInQuietHours, isWithinScheduledTime,
} from './report-helpers.ts'

export async function processDailyDigest(
  supabase: any,
  uazapiUrl: string,
  uazapiToken: string
): Promise<{ processed: number; errors: number; details?: string }> {
  // 1. Buscar usuários que têm daily digest habilitado
  const { data: subscribers, error } = await supabase
    .from('user_notification_preferences')
    .select(`
      user_id,
      daily_digest_enabled,
      daily_digest_time,
      timezone,
      user:user_profiles!user_notification_preferences_user_id_fkey(
        id, full_name, user_id, role
      )
    `)
    .eq('daily_digest_enabled', true)

  if (error) {
    console.error('[WA-05] Error fetching subscribers:', error)
    return { processed: 0, errors: 1 }
  }

  if (!subscribers || subscribers.length === 0) {
    console.log('[WA-05] No daily digest subscribers found')
    return { processed: 0, errors: 0 }
  }

  console.log(`[WA-05] Generating daily digest for ${subscribers.length} user(s)`)

  let processed = 0
  let errors = 0

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      // Verificar se o horário configurado corresponde ao horário atual
      if (!isWithinScheduledTime(sub.daily_digest_time)) {
        console.log(`[WA-05] Skipping ${profile.full_name}: digest time ${sub.daily_digest_time} not matching current time`)
        continue
      }

      // Verificar quiet hours
      const isQuiet = await isInQuietHours(supabase, profile.id)
      if (isQuiet) {
        console.log(`[WA-05] Skipping ${profile.full_name}: in quiet hours`)
        continue
      }

      // Buscar telefone do usuário
      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) {
        console.log(`[WA-05] No phone for user ${profile.full_name}, skipping`)
        continue
      }

      // Gerar conteúdo do digest
      const digestText = await generateDailyContent(supabase, profile)

      // Enviar via UAZAPI
      const result = await sendWhatsApp(uazapiUrl, uazapiToken, phone, digestText)

      if (result.success) {
        console.log(`[WA-05] ✅ Daily digest sent to ${profile.full_name}`)

        // Salvar episódio de memória
        const { error: memError } = await supabase.rpc('save_memory_episode', {
          p_user_id: profile.id,
          p_summary: `Enviei resumo diário para ${profile.full_name}.`,
          p_entities: { report_type: 'daily_digest' },
          p_outcome: 'info_provided',
          p_importance: 0.2,
          p_source: 'whatsapp',
        })
        if (memError) console.error('[WA-05] Episode save error:', memError)

        processed++
      } else {
        console.error(`[WA-05] ❌ Failed to send digest to ${profile.full_name}: ${result.error}`)
        errors++
      }

      // Delay entre envios
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[WA-05] Error generating digest for ${sub.user_id}:`, errMsg)
      errors++
      // Retornar detalhes do erro para diagnóstico
      return { processed, errors, details: errMsg }
    }
  }

  return { processed, errors }
}


// ============================================
// GERAÇÃO DE CONTEÚDO
// ============================================

async function generateDailyContent(supabase: any, profile: any): Promise<string> {
  const firstName = profile.full_name.split(' ')[0]
  const profileId = profile.id       // user_profiles.id

  const { start, end } = getDateRangeForPeriod('today')
  const sections: string[] = []

  // Saudação
  const spNow = getSPNow()
  const hour = spNow.getUTCHours()
  const greeting = hour < 12 ? '☀️ Bom dia' : hour < 18 ? '🌤️ Boa tarde' : '🌙 Boa noite'
  sections.push(`${greeting}, ${firstName}! Aqui está seu resumo de hoje:\n`)

  // ── AGENDA DO DIA ──
  const { data: todayEvents } = await supabase
    .from('calendar_items')
    .select('id, title, type, status, start_time, end_time, all_day, responsible_user_id')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time', { ascending: true })
    .limit(15)

  if (todayEvents && todayEvents.length > 0) {
    const responsibleIds = todayEvents.map((e: any) => e.responsible_user_id).filter(Boolean)
    const nameMap = await resolveUserNames(supabase, responsibleIds)

    const eventLines = todayEvents.map((item: any, i: number) => {
      const emoji = getCalendarTypeEmoji(item.type)
      const time = item.all_day ? 'Dia inteiro' : formatDateTimeBR(item.start_time).split(' ').slice(1).join(' ')
      const responsible = item.responsible_user_id ? nameMap[item.responsible_user_id] : null
      const respText = responsible ? ` → ${responsible}` : ''
      return `  ${i + 1}. ${emoji} *${item.title}* — ${time}${respText}`
    }).join('\n')
    sections.push(`📅 *Agenda de hoje* (${todayEvents.length}):\n${eventLines}`)
  } else {
    sections.push(`📅 Agenda limpa hoje — bom dia para focar em produção! 🎯`)
  }

  // ── CARDS URGENTES ──
  // Fix Bug #3: incluir (id, name) no join para poder filtrar por column.id
  const { data: urgentCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, due_date, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
    .eq('priority', 'urgent')
    .is('deleted_at', null)
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(5)

  // Excluir published/archived
  const { data: finishedCols } = await supabase
    .from('kanban_columns').select('id').in('slug', ['published', 'archived'])
  const finishedIds = (finishedCols || []).map((c: any) => c.id)

  const activeUrgent = (urgentCards || []).filter((c: any) =>
    !finishedIds.includes(c.column?.id)
  )

  if (activeUrgent.length > 0) {
    const urgentLines = activeUrgent.map((c: any) => {
      const due = c.due_date ? ` 📅 ${formatDateOnlyBR(c.due_date)}` : ''
      return `  🔴 *${c.title}* — ${c.column?.name || '?'}${due}`
    }).join('\n')
    sections.push(`\n⚡ *Cards urgentes* (${activeUrgent.length}):\n${urgentLines}`)
  }

  // ── CARDS VENCIDOS ──
  const now = new Date().toISOString()
  let overdueQuery = supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .lt('due_date', now)
    .is('deleted_at', null)
  for (const fId of finishedIds) {
    overdueQuery = overdueQuery.neq('column_id', fId)
  }
  const { count: overdueCount } = await overdueQuery

  if (overdueCount && overdueCount > 0) {
    sections.push(`⚠️ *${overdueCount} card(s) com prazo vencido* — "quais cards vencidos?" para ver detalhes`)
  }

  // ── INSIGHT COM MEMÓRIA ──
  const memoryInsight = await generateMemoryInsight(supabase, profileId)
  if (memoryInsight) {
    sections.push(`\n💡 ${memoryInsight}`)
  }

  sections.push(`\nBom trabalho hoje! 🎵`)

  return sections.join('\n')
}


async function generateMemoryInsight(supabase: any, profileId: string): Promise<string | null> {
  try {
    // Buscar fatos do usuário para gerar insight
    const { data: facts } = await supabase
      .from('agent_memory_facts')
      .select('category, fact, metadata, confidence')
      .eq('user_id', profileId)
      .eq('is_active', true)
      .order('confidence', { ascending: false })
      .limit(5)

    if (!facts || facts.length === 0) return null

    // Buscar cards "stuck" (na mesma coluna por mais de 3 dias)
    // Fix Bug #3: incluir (id, name) no join
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString()
    const { data: stuckCards } = await supabase
      .from('kanban_cards')
      .select('id, column:kanban_columns!kanban_cards_column_id_fkey(id, name)')
      .lt('moved_to_column_at', threeDaysAgo)
      .is('deleted_at', null)

    const { data: finishedCols } = await supabase
      .from('kanban_columns').select('id').in('slug', ['published', 'archived', 'brainstorming'])
    const excludeIds = (finishedCols || []).map((c: any) => c.id)

    const activeStuck = (stuckCards || []).filter((c: any) =>
      c.column && !excludeIds.includes(c.column.id)
    )

    if (activeStuck.length > 3) {
      // Agrupar por coluna
      const colCounts: Record<string, number> = {}
      for (const c of activeStuck) {
        const name = c.column?.name || '?'
        colCounts[name] = (colCounts[name] || 0) + 1
      }
      const topCol = Object.entries(colCounts).sort(([,a], [,b]) => b - a)[0]
      if (topCol) {
        return `Você tem ${activeStuck.length} cards parados há mais de 3 dias. "${topCol[0]}" tem ${topCol[1]} — vale revisar!`
      }
    }

    // Fallback: usar fato de memória
    const patternFact = facts.find((f: any) => f.category === 'pattern')
    if (patternFact) {
      return `Padrão observado: ${patternFact.fact}`
    }

    return null
  } catch {
    return null
  }
}
