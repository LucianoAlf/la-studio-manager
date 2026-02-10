# ⏰ Prompt WA-05: WhatsApp Agent — Cron Jobs + Relatórios Automáticos

**Projeto:** LA Studio Manager  
**Data:** 07 de Fevereiro de 2026  
**Dependência:** WA-01 ✅ | WA-02 ✅ | WA-03 ✅ | WA-04 ✅ (v15)  
**Supabase Project:** `rhxqwraqpabgecgojytj`  
**Objetivo:** Automatizar o envio de lembretes pendentes (a cada 5min), relatórios diários (9h SP) e semanais (segunda 9h SP), com preferências configuráveis por usuário. Também rodar manutenção da memória (cleanup de episódios e decay de fatos antigos).

---

## 📋 CONTEXTO — O QUE JÁ EXISTE

### WA-01 a WA-04 — Stack Atual ✅
- **Edge Function:** `process-whatsapp-message` (v15) — recebe mensagens, classifica, executa, consulta
- **UAZAPI:** `https://lamusic.uazapi.com` | Token: `[UAZAPI_TOKEN - ver env vars]`
- **Envio:** `POST /send/text` com headers `{ token, Content-Type: application/json }` e body `{ number, text, delay, linkPreview }`
- **Memória:** 3 tabelas (`agent_memory_episodes`, `agent_memory_facts`, `agent_memory_team`) + RPCs
- **RPCs existentes:** `get_agent_memory_context()`, `save_memory_episode()`, `learn_or_reinforce_fact()`, `cleanup_old_episodes()`, `decay_stale_facts()`, `get_cards_count_by_column()`
- **Lembretes:** WA-03 cria registros em `whatsapp_scheduled_messages` com `status='pending'` — **mas ninguém os envia ainda!**

### Schema: whatsapp_scheduled_messages (já existe)
```sql
CREATE TABLE whatsapp_scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type varchar(10) NOT NULL CHECK (target_type IN ('user', 'group')),
  target_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,  -- profile_id
  target_phone varchar(20),
  target_group_jid varchar(50),
  message_type varchar(20) DEFAULT 'text',
  content text NOT NULL,
  media_url text,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status varchar(20) DEFAULT 'pending',    -- pending | sent | failed | cancelled
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  error_message text,
  source varchar(30) NOT NULL,             -- calendar_reminder | daily_summary | weekly_summary | manual | system
  source_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_target CHECK (
    (target_type = 'user' AND target_user_id IS NOT NULL) OR
    (target_type = 'group' AND target_group_jid IS NOT NULL)
  )
);
```

### Env Vars (já configuradas na Edge Function existente)
```
SUPABASE_URL              = https://rhxqwraqpabgecgojytj.supabase.co
SUPABASE_SERVICE_ROLE_KEY = (já configurada)
UAZAPI_SERVER_URL         = https://lamusic.uazapi.com
UAZAPI_TOKEN              = [UAZAPI_TOKEN - ver env vars]
```

### ⚠️ DOIS IDs — Lembrete
```
user_profiles.id       (profile_id)    → whatsapp_*, agent_memory_*
user_profiles.user_id  (auth_user_id)  → kanban_cards.created_by, calendar_items.created_by,
                                          kanban_cards.responsible_user_id, calendar_items.responsible_user_id
```

### ⚠️ FKs de responsible_user_id → auth.users (NÃO user_profiles)
Para resolver nomes de responsáveis, usar lookup manual via `user_profiles WHERE user_id IN (...)`.

---

## 🏗️ ARQUITETURA WA-05

```
┌─────────────┐    pg_cron (*/5 min)     ┌──────────────────────────────┐
│  PostgreSQL  │ ──── pg_net ──────────→  │  process-scheduled-tasks     │
│  pg_cron     │    HTTP POST             │  (Nova Edge Function)        │
│              │                          │                              │
│  Jobs:       │    pg_cron (daily 12UTC) │  Actions:                    │
│  • reminders │ ──── pg_net ──────────→  │  • send-reminders            │
│  • digest    │                          │  • daily-digest              │
│  • weekly    │    pg_cron (mon 12UTC)   │  • weekly-summary            │
│  • cleanup   │ ──── pg_net ──────────→  │  • memory-maintenance        │
└─────────────┘    pg_cron (daily 3UTC)   └────────┬─────────────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │  UAZAPI           │
                                          │  POST /send/text  │
                                          └──────────────────┘
```

### Horários (UTC ↔ SP):
| Job | Cron (UTC) | Horário SP | Frequência |
|-----|-----------|-----------|-----------|
| send-reminders | `*/5 * * * *` | A cada 5min | Contínuo |
| daily-digest | `0 12 * * *` | 9:00 | Diário |
| weekly-summary | `0 12 * * 1` | Segunda 9:00 | Semanal |
| memory-maintenance | `0 3 * * *` | 0:00 | Diário |

### Arquivos da nova Edge Function:
```
supabase/functions/process-scheduled-tasks/
├── index.ts                ← Entry point (router por action)
├── reminder-processor.ts   ← Enviar lembretes pendentes
├── daily-digest.ts         ← Gerar e enviar resumo diário
├── weekly-summary.ts       ← Gerar e enviar resumo semanal
└── report-helpers.ts       ← Queries e formatação compartilhadas
```

---

## 🆕 PARTE A — MIGRATION SQL

⚠️ **ATENÇÃO:** Substituir `<SERVICE_ROLE_KEY>` pelo valor real da service_role_key do Supabase (Dashboard → Settings → API → service_role key). É seguro colocar aqui porque pg_cron roda server-side dentro do PostgreSQL.

```sql
-- ============================================
-- MIGRATION: WA-05 — Cron Jobs + Notificações
-- LA Studio Manager
-- 07/02/2026
-- ============================================

-- ──────────────────────────────────────────
-- 1. TABELA DE PREFERÊNCIAS DE NOTIFICAÇÃO
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Daily Digest
  daily_digest_enabled BOOLEAN DEFAULT TRUE,
  daily_digest_time TIME DEFAULT '09:00',     -- Horário local (SP)

  -- Weekly Summary
  weekly_summary_enabled BOOLEAN DEFAULT TRUE,
  weekly_summary_day INTEGER DEFAULT 1,       -- 0=Dom, 1=Seg, ..., 6=Sáb
  weekly_summary_time TIME DEFAULT '09:00',   -- Horário local (SP)

  -- Lembretes
  reminders_enabled BOOLEAN DEFAULT TRUE,

  -- Geral
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  quiet_hours_start TIME DEFAULT '22:00',     -- Não enviar entre 22h-7h
  quiet_hours_end TIME DEFAULT '07:00',

  -- Controle
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_prefs UNIQUE (user_id)
);

-- RLS: só dono lê/edita
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prefs_select" ON user_notification_preferences FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "prefs_update" ON user_notification_preferences FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "prefs_insert" ON user_notification_preferences FOR INSERT
  WITH CHECK (true);  -- Edge Function insere via service_role

-- Índice
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON user_notification_preferences(user_id);


-- ──────────────────────────────────────────
-- 2. SEED: Preferências para admins existentes
-- ──────────────────────────────────────────

INSERT INTO user_notification_preferences (user_id)
SELECT id FROM user_profiles WHERE role IN ('admin', 'developer')
ON CONFLICT (user_id) DO NOTHING;


-- ──────────────────────────────────────────
-- 3. HABILITAR EXTENSÕES
-- ──────────────────────────────────────────

-- pg_cron: agendamento de tarefas dentro do PostgreSQL
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net: HTTP requests a partir do PostgreSQL (chama Edge Functions)
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ──────────────────────────────────────────
-- 4. CRON JOBS — ⚠️ SUBSTITUIR <SERVICE_ROLE_KEY>
-- ──────────────────────────────────────────

-- Job 1: Processar lembretes pendentes (a cada 5 minutos)
SELECT cron.schedule(
  'wa05-send-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-scheduled-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{"action": "send-reminders"}'::jsonb
  ) AS request_id;
  $$
);

-- Job 2: Daily Digest (9:00 SP = 12:00 UTC)
SELECT cron.schedule(
  'wa05-daily-digest',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-scheduled-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{"action": "daily-digest"}'::jsonb
  ) AS request_id;
  $$
);

-- Job 3: Weekly Summary (Segunda 9:00 SP = Segunda 12:00 UTC)
SELECT cron.schedule(
  'wa05-weekly-summary',
  '0 12 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-scheduled-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{"action": "weekly-summary"}'::jsonb
  ) AS request_id;
  $$
);

-- Job 4: Manutenção de memória (meia-noite SP = 3:00 UTC)
SELECT cron.schedule(
  'wa05-memory-maintenance',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-scheduled-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body := '{"action": "memory-maintenance"}'::jsonb
  ) AS request_id;
  $$
);
```

### ✅ Verificação pós-migration
```sql
-- Conferir preferências criadas
SELECT up.full_name, unp.daily_digest_enabled, unp.weekly_summary_enabled
FROM user_notification_preferences unp
JOIN user_profiles up ON up.id = unp.user_id;

-- Conferir cron jobs registrados
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'wa05-%';
-- Esperado: 4 jobs ativos

-- Testar pg_net (disparar manualmente)
-- SELECT net.http_post(...) -- com os mesmos params de qualquer job acima
```

---

## 🆕 PARTE B — NOVA EDGE FUNCTION: `index.ts`

**Criar:** `supabase/functions/process-scheduled-tasks/index.ts`

```typescript
/**
 * process-scheduled-tasks — WA-05
 * Edge Function chamada por pg_cron via pg_net.
 * 
 * Rota por "action" no body:
 *   send-reminders     → Envia lembretes pendentes (cada 5min)
 *   daily-digest       → Resumo diário personalizado (9h SP)
 *   weekly-summary     → Resumo semanal (segunda 9h SP)
 *   memory-maintenance → Cleanup de episódios + decay de fatos
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processReminders } from './reminder-processor.ts'
import { processDailyDigest } from './daily-digest.ts'
import { processWeeklySummary } from './weekly-summary.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL') || 'https://lamusic.uazapi.com'
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN') || '[UAZAPI_TOKEN - ver env vars]'

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

    let result: { processed: number; errors: number; details?: string }

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
```

---

## 🆕 PARTE C — `reminder-processor.ts`

**Criar:** `supabase/functions/process-scheduled-tasks/reminder-processor.ts`

```typescript
/**
 * reminder-processor.ts — WA-05
 * Busca lembretes pendentes (scheduled_for <= agora), envia via UAZAPI,
 * atualiza status para 'sent' ou 'failed'. Respeita retry/max_retries.
 */

import { sendWhatsApp } from './report-helpers.ts'

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


// ============================================
// HELPERS
// ============================================

async function isInQuietHours(supabase: any, profileId: string): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('user_notification_preferences')
    .select('quiet_hours_start, quiet_hours_end, timezone')
    .eq('user_id', profileId)
    .single()

  if (!prefs) return false // Sem preferências = sem quiet hours

  // Hora atual em SP
  const spNow = new Date(Date.now() - 3 * 60 * 60000)
  const currentHour = spNow.getUTCHours()
  const currentMinute = spNow.getUTCMinutes()
  const currentTime = currentHour * 60 + currentMinute // minutos desde meia-noite

  const [startH, startM] = (prefs.quiet_hours_start || '22:00').split(':').map(Number)
  const [endH, endM] = (prefs.quiet_hours_end || '07:00').split(':').map(Number)
  const startTime = startH * 60 + startM
  const endTime = endH * 60 + endM

  // Quiet hours cruzam meia-noite? (ex: 22:00 → 07:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime
  } else {
    return currentTime >= startTime && currentTime < endTime
  }
}

async function areRemindersEnabled(supabase: any, profileId: string): Promise<boolean> {
  const { data: prefs } = await supabase
    .from('user_notification_preferences')
    .select('reminders_enabled')
    .eq('user_id', profileId)
    .single()

  // Se não tem preferências, assume habilitado (fallback seguro)
  return prefs?.reminders_enabled !== false
}
```

---

## 🆕 PARTE D — `daily-digest.ts`

**Criar:** `supabase/functions/process-scheduled-tasks/daily-digest.ts`

```typescript
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
  sendWhatsApp, getDateRangeForPeriod, formatDateTimeBR,
  resolveUserNames, getCalendarTypeEmoji, getPriorityEmoji,
} from './report-helpers.ts'

export async function processDailyDigest(
  supabase: any,
  uazapiUrl: string,
  uazapiToken: string
): Promise<{ processed: number; errors: number }> {
  // 1. Buscar usuários que têm daily digest habilitado
  const { data: subscribers, error } = await supabase
    .from('user_notification_preferences')
    .select(`
      user_id,
      daily_digest_time,
      timezone,
      user:user_profiles!user_notification_preferences_user_id_fkey(
        id, full_name, user_id, role
      )
    `)
    .eq('daily_digest_enabled', true)

  if (error || !subscribers || subscribers.length === 0) {
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
        await supabase.rpc('save_memory_episode', {
          p_user_id: profile.id,
          p_summary: `Enviei resumo diário para ${profile.full_name}.`,
          p_entities: { report_type: 'daily_digest' },
          p_outcome: 'info_provided',
          p_importance: 0.2,
          p_source: 'whatsapp',
        }).catch((e: any) => console.error('[WA-05] Episode save error:', e))

        processed++
      } else {
        console.error(`[WA-05] ❌ Failed to send digest to ${profile.full_name}: ${result.error}`)
        errors++
      }

      // Delay entre envios
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (err) {
      console.error(`[WA-05] Error generating digest for ${sub.user_id}:`, err)
      errors++
    }
  }

  return { processed, errors }
}


// ============================================
// GERAÇÃO DE CONTEÚDO
// ============================================

async function generateDailyContent(supabase: any, profile: any): Promise<string> {
  const firstName = profile.full_name.split(' ')[0]
  const authUserId = profile.user_id // auth.users.id
  const profileId = profile.id       // user_profiles.id

  const { start, end } = getDateRangeForPeriod('today')
  const sections: string[] = []

  // Saudação
  const hour = new Date(Date.now() - 3 * 60 * 60000).getUTCHours()
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
  const { data: urgentCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, due_date, column:kanban_columns!kanban_cards_column_id_fkey(name)')
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
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000).toISOString()
    const { data: stuckCards } = await supabase
      .from('kanban_cards')
      .select('id, column:kanban_columns!kanban_cards_column_id_fkey(name)')
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


// ============================================
// HELPERS LOCAIS
// ============================================

async function getUserPhone(supabase: any, profileId: string): Promise<string | null> {
  // Buscar telefone via whatsapp_connections
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('phone_number')
    .eq('user_id', profileId)
    .eq('is_active', true)
    .single()

  return data?.phone_number || null
}

function formatDateOnlyBR(date: string): string {
  const d = new Date(date)
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')}`
}
```

---

## 🆕 PARTE E — `weekly-summary.ts`

**Criar:** `supabase/functions/process-scheduled-tasks/weekly-summary.ts`

```typescript
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
  sendWhatsApp, getDateRangeForPeriod, getPriorityEmoji,
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

  let processed = 0
  let errors = 0

  for (const sub of subscribers) {
    try {
      const profile = sub.user as any
      if (!profile?.id || !profile?.full_name) continue

      const phone = await getUserPhone(supabase, profile.id)
      if (!phone) continue

      const summaryText = await generateWeeklyContent(supabase, profile)

      const result = await sendWhatsApp(uazapiUrl, uazapiToken, phone, summaryText)

      if (result.success) {
        console.log(`[WA-05] ✅ Weekly summary sent to ${profile.full_name}`)

        await supabase.rpc('save_memory_episode', {
          p_user_id: profile.id,
          p_summary: `Enviei resumo semanal para ${profile.full_name}.`,
          p_entities: { report_type: 'weekly_summary' },
          p_outcome: 'info_provided',
          p_importance: 0.3,
          p_source: 'whatsapp',
        }).catch((e: any) => console.error('[WA-05] Episode save error:', e))

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

  const sp = new Date(Date.now() - 3 * 60 * 60000)
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
  const { count: urgentCount } = await supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .eq('priority', 'urgent')
    .is('deleted_at', null)

  const finishedIds = (columns || [])
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


// ============================================
// HELPERS LOCAIS
// ============================================

async function getUserPhone(supabase: any, profileId: string): Promise<string | null> {
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('phone_number')
    .eq('user_id', profileId)
    .eq('is_active', true)
    .single()
  return data?.phone_number || null
}

function formatDateShort(date: Date): string {
  const sp = new Date(date.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2, '0')}/${(sp.getUTCMonth() + 1).toString().padStart(2, '0')}`
}
```

---

## 🆕 PARTE F — `report-helpers.ts`

**Criar:** `supabase/functions/process-scheduled-tasks/report-helpers.ts`

```typescript
/**
 * report-helpers.ts — WA-05
 * Funções compartilhadas entre daily-digest.ts, weekly-summary.ts, e reminder-processor.ts.
 * Inclui: envio UAZAPI, cálculo de datas, formatação, resolução de nomes.
 */

// ============================================
// ENVIO UAZAPI
// ============================================

export async function sendWhatsApp(
  serverUrl: string,
  token: string,
  phone: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number: phone,
        text,
        delay: 1000,
        linkPreview: false,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${JSON.stringify(data)}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}


// ============================================
// DATAS — Timezone São Paulo (UTC-3)
// ============================================

function getSPNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60000)
}

function spToUtc(y: number, m: number, d: number, h: number, min: number): Date {
  return new Date(Date.UTC(y, m, d, h + 3, min))
}

export function getDateRangeForPeriod(period: string): { start: Date; end: Date } {
  const sp = getSPNow()
  const spYear = sp.getUTCFullYear()
  const spMonth = sp.getUTCMonth()
  const spDate = sp.getUTCDate()
  const spDay = sp.getUTCDay() // 0=dom

  switch (period) {
    case 'today':
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }

    case 'this_week': {
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const mondayDate = spDate + mondayOffset
      return {
        start: spToUtc(spYear, spMonth, mondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, mondayDate + 6, 23, 59),
      }
    }

    case 'last_week': {
      // Segunda passada a domingo passado
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const lastMondayDate = spDate + mondayOffset - 7
      return {
        start: spToUtc(spYear, spMonth, lastMondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, lastMondayDate + 6, 23, 59),
      }
    }

    case 'this_month':
      return {
        start: spToUtc(spYear, spMonth, 1, 0, 0),
        end: spToUtc(spYear, spMonth + 1, 0, 23, 59),
      }

    default:
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }
  }
}


// ============================================
// FORMATAÇÃO
// ============================================

export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[sp.getUTCDay()]} ${sp.getUTCDate().toString().padStart(2,'0')}/${(sp.getUTCMonth()+1).toString().padStart(2,'0')} ${sp.getUTCHours().toString().padStart(2,'0')}:${sp.getUTCMinutes().toString().padStart(2,'0')}`
}

export function getPriorityEmoji(p: string): string {
  return ({ urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' } as Record<string,string>)[p] || '🟡'
}

export function getCalendarTypeEmoji(t: string): string {
  return ({ event: '🎉', delivery: '📦', creation: '🎨', task: '✅', meeting: '🤝' } as Record<string,string>)[t] || '📅'
}


// ============================================
// RESOLUÇÃO DE NOMES
// ============================================

/**
 * Resolve auth.users.id → full_name via user_profiles.user_id (lookup manual).
 * Mesmo padrão do WA-04 query-handler.ts.
 */
export async function resolveUserNames(
  supabase: any,
  authUserIds: string[]
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {}
  if (!authUserIds || authUserIds.length === 0) return nameMap

  const uniqueIds = [...new Set(authUserIds.filter(Boolean))]
  if (uniqueIds.length === 0) return nameMap

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', uniqueIds)

  if (error || !profiles) return nameMap

  for (const p of profiles) {
    if (p.user_id && p.full_name) {
      nameMap[p.user_id] = p.full_name
    }
  }

  return nameMap
}
```

---

## 📦 DEPLOY

### Ordem de execução:

1. **SQL Migration (Parte A):** Executar no Supabase SQL Editor
   - ⚠️ **Substituir `<SERVICE_ROLE_KEY>`** pelo valor real (4 ocorrências)
   - Dashboard → Settings → API → service_role key (⚠️ NÃO a anon key)
2. **Verificar:**
   ```sql
   SELECT * FROM user_notification_preferences;  -- deve ter rows
   SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'wa05-%';  -- 4 jobs
   ```
3. **Criar** os 4 arquivos da nova Edge Function:
   ```
   supabase/functions/process-scheduled-tasks/
   ├── index.ts                 (Parte B)
   ├── reminder-processor.ts    (Parte C)
   ├── daily-digest.ts          (Parte D)
   ├── weekly-summary.ts        (Parte E)
   └── report-helpers.ts        (Parte F)
   ```
4. **Deploy:**
   ```bash
   supabase functions deploy process-scheduled-tasks --no-verify-jwt
   ```
5. **Testar manualmente:**
   ```sql
   -- Disparar ação manualmente via pg_net
   SELECT net.http_post(
     url := 'https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/process-scheduled-tasks',
     headers := '{"Content-Type": "application/json", "Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
     body := '{"action": "send-reminders"}'::jsonb
   ) AS request_id;
   ```

### Env Vars da nova Edge Function:
A Edge Function herda as env vars do projeto. Se elas já estão configuradas para `process-whatsapp-message`, a nova função vai ter acesso automático. Caso contrário:
```bash
supabase secrets set UAZAPI_SERVER_URL=https://lamusic.uazapi.com
supabase secrets set UAZAPI_TOKEN=[UAZAPI_TOKEN - ver env vars]
```

---

## 🧪 TESTES DE VALIDAÇÃO

### T1 — Processar Lembretes
```
Preparação: Criar lembrete via WhatsApp ("me lembra de revisar vídeo amanhã às 10h" → "sim")
Ação: Disparar "send-reminders" manualmente quando scheduled_for for atingido
Esperado: Mensagem recebida no WhatsApp, status='sent' no banco
```

### T2 — Daily Digest
```
Ação: Disparar "daily-digest" manualmente
Esperado: Resumo do dia recebido no WhatsApp com agenda + cards urgentes
Verificar: agent_memory_episodes tem outcome='info_provided', report_type='daily_digest'
```

### T3 — Weekly Summary
```
Ação: Disparar "weekly-summary" manualmente
Esperado: Resumo semanal com produção + eventos + kanban + alertas
```

### T4 — Memory Maintenance
```
Ação: Disparar "memory-maintenance" manualmente
Esperado: Log mostra "X episodes cleaned, Y facts decayed"
```

### T5 — Quiet Hours
```
Preparação: Configurar quiet_hours_start='10:00', quiet_hours_end='23:00' (invertido para teste)
Ação: Disparar send-reminders durante quiet hours
Esperado: Lembrete NÃO é enviado (skipped)
```

### T6 — Preferências Desabilitadas
```
Preparação: UPDATE user_notification_preferences SET daily_digest_enabled = false WHERE ...
Ação: Disparar "daily-digest"
Esperado: Usuário não recebe digest
```

### T7 — Retry de Lembretes
```
Preparação: Criar lembrete com telefone inválido
Ação: Disparar send-reminders 3x
Esperado: retry_count incrementa, após 3 tentativas status='failed'
```

### T8 — pg_cron Automático
```
Ação: Aguardar 5 minutos após deploy
Verificar: SELECT * FROM cron.job_run_details WHERE jobname = 'wa05-send-reminders' ORDER BY start_time DESC LIMIT 5;
Esperado: Execuções aparecem a cada 5 minutos
```

### T9 — Regressão WA-03 (Criar Lembrete)
```
"me lembra de enviar relatório sexta às 9h" → "sim"
Esperado: Lembrete criado em whatsapp_scheduled_messages com status='pending'
```

### T10 — Regressão WA-04 (Queries)
```
"quais cards urgentes?" → resposta com dados reais
```

---

## 📊 CHECKLIST FINAL

```
MIGRATION:
[ ] SQL executado (com SERVICE_ROLE_KEY substituída!)
[ ] user_notification_preferences tem rows para admins
[ ] cron.job tem 4 jobs wa05-*
[ ] pg_net está habilitado (testar SELECT net.http_post(...))

EDGE FUNCTION:
[ ] index.ts criado (router por action)
[ ] reminder-processor.ts criado (busca/envia/retry)
[ ] daily-digest.ts criado (agenda + urgentes + insight)
[ ] weekly-summary.ts criado (produção + eventos + kanban)
[ ] report-helpers.ts criado (sendWhatsApp + datas + nomes)

DEPLOY:
[ ] supabase functions deploy process-scheduled-tasks --no-verify-jwt
[ ] Env vars acessíveis (UAZAPI_SERVER_URL, UAZAPI_TOKEN)

TESTES:
[ ] T1-T10 passam
[ ] Lembretes são enviados automaticamente (T8)
[ ] Quiet hours respeitadas (T5)
[ ] Preferências controlam envio (T6)
```

---

## 📁 RESUMO DE ARQUIVOS

```
CRIAR (Nova Edge Function):
  supabase/functions/process-scheduled-tasks/
  ├── index.ts
  ├── reminder-processor.ts
  ├── daily-digest.ts
  ├── weekly-summary.ts
  └── report-helpers.ts

MIGRATION SQL:
  user_notification_preferences (tabela)
  pg_cron + pg_net (extensões)
  4 cron jobs (wa05-*)

NÃO MODIFICAR:
  process-whatsapp-message/* (tudo intacto)
```

---

## 🔮 PRÓXIMOS PASSOS (WA-06+)

Com WA-05 concluído, o agente agora:
- ✅ Classifica intenções (WA-02)
- ✅ Executa ações com confirmação (WA-03)
- ✅ Responde consultas com dados reais (WA-04)
- ✅ Aprende e lembra preferências (WA-04)
- ✅ **Envia lembretes automaticamente (WA-05)**
- ✅ **Gera relatórios diários e semanais personalizados (WA-05)**
- ✅ **Mantém memória limpa automaticamente (WA-05)**

**WA-06:** Áudio + imagem (transcrição Whisper, Gemini Vision)
**WA-07:** Dashboard de configuração (memória editável, preferências de notificação, agent settings)