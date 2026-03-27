/**
 * process-nina-request v24
 * Versão leve: Gera apenas texto via Gemini
 * Frontend faz o overlay da imagem via Canvas API (mais rápido)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const body = await req.json()
    const { mode = 'brief', brand = 'la_music_school', brief, student_id, commemorative_date_id, post_type = 'feed', reference_image_url, event_asset_id, event_name } = body

    console.log(`[NINA] v24 | mode=${mode} brand=${brand} event=${event_name || 'none'}`)

    const { data: config } = await supabase.from('nina_config').select('*').single()
    if (!config?.is_enabled) {
      return new Response(JSON.stringify({ success: false, error: 'Nina pausada.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const brandName = brand === 'la_music_kids' ? 'LA Music Kids' : 'LA Music School'
    const isKids = brand === 'la_music_kids'

    let studentData: any = null
    let commemorativeData: any = null

    if (student_id) {
      const { data } = await supabase.from('assets').select('person_name,file_url,birth_date,instagram_handle,brand,metadata').eq('person_id', student_id).single()
      studentData = data
    }
    if (commemorative_date_id) {
      const { data } = await supabase.from('commemorative_dates').select('*').eq('id', commemorative_date_id).single()
      commemorativeData = data
    }

    // Resolve URL da imagem de referência
    let refUrl = reference_image_url
    if (!refUrl && event_asset_id) {
      const { data: ea } = await supabase.from('assets').select('file_url').eq('id', event_asset_id).single()
      if (ea?.file_url) refUrl = ea.file_url
    }
    if (!refUrl && studentData?.file_url && studentData.metadata?.has_real_photo) {
      refUrl = studentData.file_url
    }

    // Gerar texto com Gemini
    let mainPhrase = buildDefaultPhrase({ mode, brand, brief, studentData, commemorativeData })
    let caption = buildFallbackCaption({ mode, brand, studentData, commemorativeData, brandName })
    let hashtags = buildHashtags(brand, mode)

    if (GEMINI_API_KEY) {
      try {
        const result = await generatePhraseAndCaption({ mode, brand, brief, studentData, commemorativeData, brandName, isKids, event_name })
        mainPhrase = result.phrase
        caption = result.caption
        hashtags = result.hashtags
        console.log(`[NINA] Phrase: "${mainPhrase}"`)
      } catch (e) {
        console.error('[NINA] Gemini error:', e)
      }
    }

    // Log execução
    const { data: ninaAgent } = await supabase.from('ai_agents').select('id').eq('name', 'Nina').single()
    if (ninaAgent) {
      await supabase.from('ai_executions').insert({
        ai_agent_id: ninaAgent.id,
        task_type: `nina_${mode}`,
        input_data: { mode, brand, post_type, has_photo: !!refUrl, event_name },
        output_data: { main_phrase: mainPhrase, generation_method: 'frontend_canvas' },
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        triggered_by: 'studio_dashboard',
      })
    }

    return new Response(JSON.stringify({
      success: true,
      // Frontend usa esta URL diretamente
      image_url: refUrl,
      caption,
      hashtags,
      mode_used: mode,
      generation_method: 'frontend_canvas',
      main_phrase: mainPhrase,
      // Configuração para o frontend fazer o overlay
      needs_text_overlay: true,
      text_config: {
        phrase: mainPhrase,
        brand_name: brandName,
        is_kids: isKids,
        accent_color: isKids ? '#FF6B35' : '#14B8A6',
        accent_color_2: isKids ? '#FFD700' : '#0EA5E9',
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[NINA] Fatal:', error)
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})


async function generatePhraseAndCaption(p: any): Promise<{ phrase: string; caption: string; hashtags: string[] }> {
  const { mode, brand, brief, studentData, commemorativeData, brandName, isKids, event_name } = p
  let ctx = `Voce e Nina, criativa da ${brandName}. Gere:\n1. FRASE: curta e impactante para sobrepor em foto (max 6 palavras, SEM aspas, SEM emoji, texto simples)\n2. LEGENDA: envolvente para Instagram (com emojis)\n3. HASHTAGS: ate 5 relevantes\n\nTom: ${isKids ? 'alegre, animado, para criancas e pais' : 'inspirador, aspiracional, proximo, emocional'}`
  if (mode === 'birthday' && studentData) ctx += `\nContexto: post de aniversario para ${studentData.person_name?.split(' ')[0]}`
  else if (mode === 'commemorative' && commemorativeData) ctx += `\nContexto: ${commemorativeData.title || commemorativeData.name}`
  else if (event_name) ctx += `\nContexto: foto do evento "${event_name}"`
  else if (brief) ctx += `\nContexto: ${brief}`
  ctx += `\n\nJSON apenas: { "phrase": "...", "caption": "...", "hashtags": ["#tag"] }`
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: ctx }] }] }) }
  )
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  return {
    phrase: parsed.phrase || buildDefaultPhrase(p),
    caption: parsed.caption || buildFallbackCaption(p),
    hashtags: parsed.hashtags || buildHashtags(p.brand, p.mode),
  }
}


function buildDefaultPhrase(p: any): string {
  const { mode, brand, brief, studentData, commemorativeData } = p
  if (mode === 'birthday' && studentData) return `Feliz Aniversario ${studentData.person_name?.split(' ')[0]}!`
  if (mode === 'commemorative' && commemorativeData) return commemorativeData.title || 'Musica transforma vidas'
  if (brief) return brief.split(' ').slice(0, 5).join(' ')
  return brand === 'la_music_kids' ? 'Musica e alegria' : 'Musica transforma vidas'
}

function buildFallbackCaption(p: any) {
  const bn = p.brand === 'la_music_kids' ? 'LA Music Kids' : 'LA Music School'
  if (p.mode === 'birthday' && p.studentData) return `Feliz Aniversario, ${p.studentData.person_name?.split(' ')[0]}! A familia ${bn} torce por voce!`
  if (p.mode === 'commemorative' && p.commemorativeData) return `${p.commemorativeData.title || p.commemorativeData.name}! ${bn}`
  return `${bn} - Musica que transforma vidas!`
}

function buildHashtags(brand: string, mode: string) {
  const base = brand === 'la_music_kids' ? ['#LAMusicKids', '#EscolaDeMusica', '#Musica'] : ['#LAMusicSchool', '#EscolaDeMusica', '#Musica']
  if (mode === 'birthday') return [...base, '#FelizAniversario', '#Parabens']
  if (mode === 'commemorative') return [...base, '#MusicaEVida']
  return [...base, '#LAMusic']
}
