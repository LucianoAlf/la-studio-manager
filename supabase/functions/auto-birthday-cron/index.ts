/**
 * auto-birthday-cron v2
 * Roda diário via pg_cron (0 13 * * * = 10h SP)
 *
 * Melhorias v2:
 * - Verifica nina_config.is_enabled + auto_publish_birthdays
 * - Só gera post se aluno tem has_real_photo = true
 * - Usa asset.id como student_id (consistente com generate-birthday-post)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SU = Deno.env.get('SUPABASE_URL')!
const SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const sb = createClient(SU, SK)
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  try {
    // 1. Verificar se a Nina está habilitada e auto_publish_birthdays está ligado
    const { data: config } = await sb.from('nina_config').select('is_enabled, auto_publish_birthdays').single()

    if (!config?.is_enabled) {
      console.log('[AUTO-BDAY] Nina desabilitada. Pulando.')
      return json({ success: true, message: 'Nina disabled', count: 0 })
    }

    if (!config?.auto_publish_birthdays) {
      console.log('[AUTO-BDAY] Auto-publish birthdays desligado. Pulando.')
      return json({ success: true, message: 'Auto-publish birthdays disabled', count: 0 })
    }

    // 2. Calcular data de hoje em São Paulo (UTC-3)
    const spNow = new Date(Date.now() - 3 * 3600000)
    const m = spNow.getUTCMonth() + 1
    const d = spNow.getUTCDate()
    const y = spNow.getUTCFullYear()
    console.log(`[AUTO-BDAY] v2 | ${d}/${m}/${y}`)

    // 3. Buscar todos os alunos com data de nascimento
    const { data: students } = await sb
      .from('assets')
      .select('id, person_name, brand, birth_date, metadata')
      .eq('source', 'emusys')
      .is('deleted_at', null)
      .not('birth_date', 'is', null)

    // 4. Filtrar aniversariantes de hoje COM foto real
    const todays = (students || []).filter(s => {
      const bd = new Date(s.birth_date + 'T12:00:00Z')
      const isToday = (bd.getUTCMonth() + 1) === m && bd.getUTCDate() === d
      const hasPhoto = !!s.metadata?.has_real_photo
      if (isToday && !hasPhoto) {
        console.log(`[AUTO-BDAY] Skip ${s.person_name} — sem foto real`)
      }
      return isToday && hasPhoto
    })

    console.log(`[AUTO-BDAY] ${todays.length} aniversariantes com foto`)

    if (todays.length === 0) {
      return json({ success: true, message: 'Sem aniversariantes com foto', count: 0 })
    }

    let ok = 0
    let err = 0
    const skipped: string[] = []

    for (const s of todays) {
      try {
        // Verificar se já foi gerado este ano (usa asset.id como student_id)
        const { data: dup } = await sb
          .from('birthday_automation_log')
          .select('id')
          .eq('student_id', String(s.id))
          .gte('created_at', `${y}-01-01`)
          .limit(1)

        if (dup?.length) {
          console.log(`[AUTO-BDAY] Skip ${s.person_name} (já gerado este ano)`)
          skipped.push(s.person_name)
          continue
        }

        console.log(`[AUTO-BDAY] Gerando: ${s.person_name} (${s.brand})`)

        // Chamar generate-birthday-post
        const genRes = await fetch(`${SU}/functions/v1/generate-birthday-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SK}` },
          body: JSON.stringify({ asset_id: s.id, brand: s.brand || 'la_music_school' }),
        })
        const genData = await genRes.json()

        if (!genData.success || !genData.image_url) {
          console.error(`[AUTO-BDAY] Geração falhou: ${s.person_name}`, genData.error)
          err++
          continue
        }

        console.log(`[AUTO-BDAY] Imagem: ${genData.image_url}`)

        // Buscar credenciais do Instagram
        const credName = s.brand === 'la_music_kids' ? 'instagram_kids' : 'instagram_school'
        const { data: igCred } = await sb
          .from('integration_credentials')
          .select('credentials')
          .eq('integration_name', credName)
          .eq('is_active', true)
          .single()

        if (!igCred?.credentials?.access_token || !igCred?.credentials?.instagram_account_id) {
          console.error(`[AUTO-BDAY] Sem credenciais IG para ${s.brand}`)
          err++
          continue
        }

        const acct = igCred.credentials.instagram_account_id
        const tok = igCred.credentials.access_token

        // Criar container de Story
        const cp = new URLSearchParams({
          access_token: tok,
          media_type: 'STORIES',
          image_url: genData.image_url,
        })
        const cr = await fetch(`https://graph.facebook.com/v21.0/${acct}/media`, { method: 'POST', body: cp })
        const cd = await cr.json()

        if (!cd.id) {
          console.error(`[AUTO-BDAY] Container falhou:`, cd)
          err++
          continue
        }

        // Esperar processamento
        await new Promise(r => setTimeout(r, 3000))

        // Publicar
        const pp = new URLSearchParams({ creation_id: cd.id, access_token: tok })
        const pr = await fetch(`https://graph.facebook.com/v21.0/${acct}/media_publish`, { method: 'POST', body: pp })
        const pd = await pr.json()

        if (pd.id) {
          // Atualizar log — usa asset.id como student_id (mesmo que generate-birthday-post)
          await sb.from('birthday_automation_log')
            .update({
              approval_status: 'auto_published',
              published_at: new Date().toISOString(),
              metadata: { method: 'gemini_3.1_festive', photo_used: true, ig_post_id: pd.id, auto: true },
            })
            .eq('student_id', String(s.id))
            .eq('approval_status', 'pending')

          console.log(`[AUTO-BDAY] Publicado ${s.person_name}: ${pd.id}`)
          ok++
        } else {
          console.error(`[AUTO-BDAY] Publicação falhou:`, pd)
          err++
        }
      } catch (e) {
        console.error(`[AUTO-BDAY] Erro ${s.person_name}:`, e)
        err++
      }
    }

    return json({
      success: true,
      date: `${d}/${m}/${y}`,
      total: todays.length,
      published: ok,
      errors: err,
      skipped: skipped.length,
    })
  } catch (e) {
    console.error('[AUTO-BDAY] Fatal:', e)
    return json({ error: String(e) }, 500)
  }
})
