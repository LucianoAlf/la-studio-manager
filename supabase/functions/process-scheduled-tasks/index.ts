/**
 * process-scheduled-tasks — WA-05 + WA-08
 * Edge Function chamada por pg_cron via pg_net.
 * 
 * Rota por "action" no body:
 *   send-reminders      → Envia lembretes pendentes (cada 5min)
 *   daily-digest        → Resumo diário personalizado (9h SP)
 *   weekly-summary      → Resumo semanal (segunda 9h SP)
 *   monthly-summary     → Resumo mensal (dia configurado, 9h SP)
 *   calendar-reminders  → Gera lembretes de eventos do calendário (cada 1h)
 *   memory-maintenance  → Cleanup de episódios + decay de fatos
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processReminders } from './reminder-processor.ts'
import { processDailyDigest } from './daily-digest.ts'
import { processWeeklySummary } from './weekly-summary.ts'
import { processCalendarReminders } from './calendar-reminder-processor.ts'
import { processMonthlySummary } from './monthly-summary.ts'
import { processRealtimeAlerts } from './realtime-alerts.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://lamusic.uazapi.com'
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN') || 'b9ca8a2c-ec93-4ff7-8805-6fa634949282'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const body = await req.json()
    const action = body.action as string

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Missing "action" in body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[WA-05] ⏰ Action: ${action}`)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let result: { processed: number; errors: number; skipped?: number; details?: string }

    switch (action) {
      case 'send-reminders':
        result = await processReminders(supabase, UAZAPI_SERVER_URL, UAZAPI_TOKEN)
        break

      case 'daily-digest':
        result = await processDailyDigest(supabase, UAZAPI_SERVER_URL, UAZAPI_TOKEN)
        break

      case 'weekly-summary':
        result = await processWeeklySummary(supabase, UAZAPI_SERVER_URL, UAZAPI_TOKEN)
        break

      case 'calendar-reminders':
        result = await processCalendarReminders(supabase)
        break

      case 'monthly-summary':
        result = await processMonthlySummary(supabase, UAZAPI_SERVER_URL, UAZAPI_TOKEN)
        break

      case 'realtime-alerts':
        result = await processRealtimeAlerts(supabase)
        break

      case 'memory-maintenance': {
        // Chamar RPCs de manutenção diretamente
        const { data: episodesDeleted } = await supabase.rpc('cleanup_old_episodes')
        const { data: factsDecayed } = await supabase.rpc('decay_stale_facts')
        console.log(`[WA-05] Memory maintenance: ${episodesDeleted ?? 0} episodes cleaned, ${factsDecayed ?? 0} facts decayed`)
        result = { processed: (episodesDeleted ?? 0) + (factsDecayed ?? 0), errors: 0, details: `episodes=${episodesDeleted}, facts=${factsDecayed}` }
        break
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    const elapsed = Date.now() - startTime
    console.log(`[WA-05] ✅ ${action} completed in ${elapsed}ms: ${result.processed} processed, ${result.errors} errors`)

    return new Response(
      JSON.stringify({ success: true, action, ...result, elapsed_ms: elapsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(`[WA-05] ❌ Fatal error:`, error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
