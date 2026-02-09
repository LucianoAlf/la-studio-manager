/**
 * reminder-processor.ts — WA-05 + WA-08 (recorrência)
 * Busca lembretes pendentes (scheduled_for <= agora), envia via UAZAPI,
 * atualiza status para 'sent' ou 'failed'. Respeita retry/max_retries.
 *
 * Recorrência: se o lembrete tem campo recurrence (daily/weekly/monthly/weekdays),
 * após enviar com sucesso, cria automaticamente o próximo lembrete com a data ajustada.
 */

import { sendWhatsApp, isInQuietHours, areRemindersEnabled } from './report-helpers.ts'

export async function processReminders(
  supabase: any,
  uazapiUrl: string,
  uazapiToken: string
): Promise<{ processed: number; errors: number; details?: string }> {
  // 1. Buscar lembretes pendentes que estão "due"
  const { data: pendingMessages, error } = await supabase
    .from('whatsapp_scheduled_messages')
    .select('id, target_type, target_phone, target_user_id, target_group_jid, content, scheduled_for, retry_count, max_retries, source, recurrence, recurrence_parent_id, metadata, message_type')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(50)  // Processar em lotes de 50

  if (error) {
    console.error('[WA-05] Error fetching reminders:', error)
    return { processed: 0, errors: 1, details: error.message }
  }

  if (!pendingMessages || pendingMessages.length === 0) {
    return { processed: 0, errors: 0 }
  }

  console.log(`[WA-05] Found ${pendingMessages.length} pending reminders`)

  let processed = 0
  let errors = 0

  for (const msg of pendingMessages) {
    try {
      // Verificar quiet hours do usuário
      if (msg.target_user_id) {
        const isQuiet = await isInQuietHours(supabase, msg.target_user_id)
        if (isQuiet) {
          console.log(`[WA-05] Skipping ${msg.id}: user in quiet hours`)
          continue // Vai ser pego no próximo ciclo
        }
      }

      // Verificar se reminders estão habilitados para o usuário
      if (msg.target_user_id) {
        const prefsEnabled = await areRemindersEnabled(supabase, msg.target_user_id)
        if (!prefsEnabled) {
          // Marcar como cancelled se desabilitado
          await supabase
            .from('whatsapp_scheduled_messages')
            .update({ status: 'cancelled', error_message: 'Reminders disabled by user' })
            .eq('id', msg.id)
          continue
        }
      }

      // Enviar via UAZAPI
      const sendResult = await sendWhatsApp(uazapiUrl, uazapiToken, msg.target_phone, msg.content)

      if (sendResult.success) {
        // Marcar como enviado
        await supabase
          .from('whatsapp_scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id)

        console.log(`[WA-05] ✅ Reminder ${msg.id} sent to ${msg.target_phone}`)
        processed++

        // Se é recorrente, criar o próximo lembrete
        if (msg.recurrence) {
          await createNextRecurrence(supabase, msg)
        }
      } else {
        // Falhou — incrementar retry ou marcar como failed
        const newRetryCount = (msg.retry_count || 0) + 1
        const newStatus = newRetryCount >= (msg.max_retries || 3) ? 'failed' : 'pending'

        await supabase
          .from('whatsapp_scheduled_messages')
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: sendResult.error || 'Send failed',
          })
          .eq('id', msg.id)

        console.error(`[WA-05] ❌ Reminder ${msg.id} failed (retry ${newRetryCount}/${msg.max_retries || 3}): ${sendResult.error}`)
        errors++
      }

      // Delay entre envios para evitar rate limit da UAZAPI
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (err) {
      console.error(`[WA-05] Fatal error processing reminder ${msg.id}:`, err)
      errors++
    }
  }

  return { processed, errors }
}


// ============================================
// RECORRÊNCIA — Cria o próximo lembrete
// ============================================

/**
 * Calcula a próxima data baseada no tipo de recorrência e cria um novo lembrete.
 * O lembrete original (parent) é referenciado via recurrence_parent_id.
 */
async function createNextRecurrence(supabase: any, msg: any): Promise<void> {
  try {
    const currentDate = new Date(msg.scheduled_for)
    const nextDate = getNextRecurrenceDate(currentDate, msg.recurrence)

    if (!nextDate) {
      console.log(`[WA-05] Unknown recurrence type: ${msg.recurrence}`)
      return
    }

    // O parent_id é o original (se este já é filho, usa o parent dele)
    const parentId = msg.recurrence_parent_id || msg.id

    const { error: insertError } = await supabase
      .from('whatsapp_scheduled_messages')
      .insert({
        target_type: msg.target_type,
        target_user_id: msg.target_user_id,
        target_phone: msg.target_phone,
        target_group_jid: msg.target_group_jid,
        message_type: msg.message_type || 'text',
        content: msg.content,
        scheduled_for: nextDate.toISOString(),
        status: 'pending',
        source: msg.source,
        recurrence: msg.recurrence,
        recurrence_parent_id: parentId,
        metadata: {
          ...(msg.metadata || {}),
          source_reference: `recur:${parentId}:${nextDate.toISOString().split('T')[0]}`,
          recurrence_from: msg.id,
        },
      })

    if (insertError) {
      console.error(`[WA-05] Error creating next recurrence for ${msg.id}:`, insertError)
    } else {
      console.log(`[WA-05] 🔄 Next ${msg.recurrence} recurrence created for ${nextDate.toISOString().split('T')[0]}`)
    }
  } catch (err) {
    console.error(`[WA-05] Error in createNextRecurrence:`, err)
  }
}

/**
 * Calcula a próxima data de recorrência.
 */
function getNextRecurrenceDate(current: Date, recurrence: string): Date | null {
  const next = new Date(current)

  switch (recurrence) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      return next

    case 'weekdays': {
      // Pular para o próximo dia útil (seg-sex)
      next.setDate(next.getDate() + 1)
      const day = next.getDay()
      if (day === 0) next.setDate(next.getDate() + 1) // Domingo → Segunda
      if (day === 6) next.setDate(next.getDate() + 2) // Sábado → Segunda
      return next
    }

    case 'weekly':
      next.setDate(next.getDate() + 7)
      return next

    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      return next

    default:
      return null
  }
}
