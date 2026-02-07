/**
 * reminder-processor.ts — WA-05
 * Busca lembretes pendentes (scheduled_for <= agora), envia via UAZAPI,
 * atualiza status para 'sent' ou 'failed'. Respeita retry/max_retries.
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
    .select('id, target_phone, content, scheduled_for, retry_count, max_retries, target_user_id, source, metadata')
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
