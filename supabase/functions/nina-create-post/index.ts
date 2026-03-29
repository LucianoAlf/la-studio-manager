/**
 * process-nina-request v25
 * Gemini 3 Flash Preview para texto + Gemini 3.1 Flash Image Preview para imagem
 * Gera imagem SEMPRE (com ou sem foto do aluno)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore - import remoto resolvido pelo runtime Deno/Supabase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

declare const Deno: {
  env: { get: (key: string) => string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

async function fetchAsBase64(url: string): Promise<{ data: string; mime: string } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    return { data: toBase64(new Uint8Array(buf)), mime: res.headers.get('content-type') || 'image/png' }
  } catch { return null }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

const TEXT_MODEL = 'gemini-3-flash-preview'
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json()
    const { mode = 'brief', brand = 'la_music_school', brief, student_id, commemorative_date_id, post_type = 'feed', reference_image_url, event_asset_id, event_name, generation_mode = 'flat', tones } = body

    console.log(`[NINA] v26 | mode=${mode} brand=${brand} post_type=${post_type} gen=${generation_mode}`)

    const { data: config } = await supabase.from('nina_config').select('*').single()
    if (!config?.is_enabled) return json({ success: false, error: 'Nina pausada.' }, 503)

    const brandName = brand === 'la_music_kids' ? 'LA Music Kids' : 'LA Music School'
    const isKids = brand === 'la_music_kids'

    // Fetch context data
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

    // Resolve reference image URL
    let refUrl = reference_image_url
    if (!refUrl && event_asset_id) {
      const { data: ea } = await supabase.from('assets').select('file_url').eq('id', event_asset_id).single()
      if (ea?.file_url) refUrl = ea.file_url
    }
    if (!refUrl && studentData?.file_url && studentData.metadata?.has_real_photo) {
      refUrl = studentData.file_url
    }

    // Fetch brand logo
    const { data: brandData } = await supabase.from('brand_identity').select('logo_primary_url, logo_icon_url').eq('brand_key', brand).single()
    const logoUrl = brandData?.logo_primary_url || brandData?.logo_icon_url || null

    // =========================================================
    // STEP 1: Generate text (caption + hashtags) with Gemini 3 Flash Preview
    // =========================================================
    console.log('[NINA] Generating text...')

    let caption = ''
    let hashtags: string[] = []
    let mainPhrase = ''

    const textContext = buildTextPrompt({ mode, brand, brief, studentData, commemorativeData, brandName, isKids, event_name, post_type })

    try {
      const textRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: textContext }] }] }),
        }
      )

      if (!textRes.ok) {
        const err = await textRes.text()
        console.error('[NINA] Text model error:', textRes.status, err)
        throw new Error(`Text: ${textRes.status}`)
      }

      const textData = await textRes.json()
      const rawText = textData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim())
      caption = parsed.caption || ''
      hashtags = parsed.hashtags || []
      mainPhrase = parsed.phrase || ''
      console.log(`[NINA] Text done: "${mainPhrase.substring(0, 40)}..."`)
    } catch (e) {
      console.error('[NINA] Text fallback:', e)
      mainPhrase = brief || commemorativeData?.name || 'Música transforma vidas'
      caption = `${mainPhrase} ${brandName}`
      hashtags = isKids ? ['#LAMusicKids', '#Musica'] : ['#LAMusicSchool', '#Musica']
    }

    // STEP 1B: Multi-variation caption (if tones provided)
    let captionVariations: Array<{ tone: string; phrase: string; caption: string; hashtags: string[] }> = []
    if (Array.isArray(tones) && tones.length > 0) {
      try {
        const tonesStr = tones.join(', ')
        let vp = `Voce e Nina, diretora criativa da ${brandName}. Gere ${tones.length} variacoes de legenda para Instagram, cada uma com um tom diferente: ${tonesStr}. `
        vp += `Tom da marca: ${isKids ? 'alegre, leve, criancas e pais' : 'proximo, autentico, emocional, jovens adultos'}. `
        if (mode === 'commemorative' && commemorativeData) vp += `Contexto: "${commemorativeData.name}". `
        else if (brief) vp += `Contexto: ${brief}. `
        vp += `REGRAS: phrase = nome + data APENAS. SEM cliches. NÃO use "as teclas que encantam" ou "musica transforma vidas". `
        vp += `Responda APENAS JSON: {"variations":[{"tone":"...","phrase":"...","caption":"...legenda autentica max 2 paragrafos...","hashtags":["#t1","#t2","#t3"]}]}`
        const vr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:generateContent?key=${GEMINI_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: vp }] }] }) })
        if (vr.ok) {
          const vd = await vr.json()
          const vt = vd.candidates?.[0]?.content?.parts?.[0]?.text || ''
          const vj = JSON.parse(vt.replace(/```json|```/g, '').trim())
          captionVariations = vj.variations || []
          console.log(`[NINA] ${captionVariations.length} caption variations generated`)
        }
      } catch (e) { console.error('[NINA] Variations err:', e) }
    }

    // =========================================================
    // STEP 2: Generate image with Gemini 3.1 Flash Image Preview
    // =========================================================
    console.log('[NINA] Generating image...')

    const isStory = post_type === 'story'
    const dimensions = isStory ? '1080x1920 portrait' : '1080x1080 square'

    const isPhotoOnly = generation_mode === 'photo_only'
    const imagePrompt = buildImagePrompt({
      mode, brand, brief, studentData, commemorativeData, brandName, isKids,
      event_name, mainPhrase, post_type, dimensions, hasPhoto: !!refUrl, hasLogo: !isPhotoOnly && !!logoUrl, photoOnly: isPhotoOnly,
    })

    // Build parts: prompt + optional photo + optional logo
    const imageParts: unknown[] = [{ text: imagePrompt }]

    if (refUrl) {
      const photo = await fetchAsBase64(refUrl)
      if (photo) {
        imageParts.push({ inlineData: { mimeType: photo.mime, data: photo.data } })
        console.log('[NINA] Photo attached')
      }
    }

    if (logoUrl && !isPhotoOnly) {
      const logo = await fetchAsBase64(logoUrl)
      if (logo) {
        imageParts.push({ inlineData: { mimeType: logo.mime, data: logo.data } })
        console.log('[NINA] Logo attached')
      }
    }

    let imageUrl: string | null = null

    try {
      const imgRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: imageParts }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
        }
      )

      if (!imgRes.ok) {
        const err = await imgRes.text()
        console.error('[NINA] Image model error:', imgRes.status, err)
        throw new Error(`Image: ${imgRes.status}`)
      }

      const imgData = await imgRes.json()
      let imageBase64: string | null = null
      let imageMime = 'image/png'

      for (const part of (imgData.candidates?.[0]?.content?.parts || [])) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data
          imageMime = part.inlineData.mimeType || 'image/png'
          break
        }
      }

      if (imageBase64) {
        // Upload to storage
        const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
        const ext = imageMime.includes('png') ? 'png' : 'jpg'
        const path = `nina-posts/${brand}/${Date.now()}-${mode}.${ext}`

        const { error: upErr } = await supabase.storage.from('posts').upload(path, imageBytes, { contentType: imageMime, upsert: true })
        if (upErr) throw new Error(`Upload: ${upErr.message}`)

        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path)
        imageUrl = urlData.publicUrl
        console.log(`[NINA] Image uploaded: ${imageUrl}`)
      } else {
        console.warn('[NINA] No image in Gemini response')
      }
    } catch (e) {
      console.error('[NINA] Image generation failed:', e)
      // Continue without image — frontend can still use refUrl as fallback
    }

    // Log execution
    const { data: ninaAgent } = await supabase.from('ai_agents').select('id').eq('name', 'Nina').single()
    if (ninaAgent) {
      await supabase.from('ai_executions').insert({
        ai_agent_id: ninaAgent.id,
        task_type: `nina_${mode}`,
        input_data: { mode, brand, post_type, has_photo: !!refUrl, event_name, brief: brief?.substring(0, 100) },
        output_data: { main_phrase: mainPhrase, has_generated_image: !!imageUrl, generation_method: 'gemini_3.1_flash_image' },
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        triggered_by: 'studio_dashboard',
      })
    }

    return json({
      success: true,
      image_url: imageUrl || refUrl,
      photo_url: isPhotoOnly ? (imageUrl || refUrl) : undefined,
      caption,
      hashtags,
      caption_variations: captionVariations.length > 0 ? captionVariations : undefined,
      mode_used: mode,
      generation_mode: generation_mode,
      generation_method: imageUrl ? 'gemini_image' : 'frontend_canvas',
      main_phrase: mainPhrase,
      needs_text_overlay: isPhotoOnly || !imageUrl,
      logo_url: logoUrl,
      text_config: {
        phrase: mainPhrase,
        brand_name: brandName,
        is_kids: isKids,
        accent_color: isKids ? '#FF6B35' : '#14B8A6',
        accent_color_2: isKids ? '#FFD700' : '#0EA5E9',
      },
    })

  } catch (error) {
    console.error('[NINA] Fatal:', error)
    return json({ success: false, error: String(error) }, 200)
  }
})


// =========================================================
// Prompt Builders
// =========================================================

function buildTextPrompt(p: any): string {
  const { mode, brand, brief, studentData, commemorativeData, brandName, isKids, event_name, post_type } = p

  let ctx = `Você é Nina, diretora criativa da ${brandName}, uma escola de música no Rio de Janeiro.

Gere conteúdo para Instagram (${post_type === 'story' ? 'Story' : 'Feed'}).

Tom: ${isKids ? 'alegre, acolhedor, leve — crianças e pais' : 'próximo, autêntico, emocional — jovens e adultos apaixonados por música'}

REGRAS IMPORTANTES:
- A "phrase" é APENAS o nome da data/tema + a data (dia/mês). Exemplo: "Dia do Pianista - 29 de março". SEM frases bregas, SEM clichês, SEM "as teclas que encantam", SEM poesia. Direto ao ponto.
- A "caption" deve ser autêntica, como se uma pessoa real escrevesse. Nada de linguagem corporativa. Emojis sim, mas com moderação.
- Hashtags relevantes e específicas.

JSON exato:
{
  "phrase": "Nome da data - dia de mês (SEM frase brega, SEM aspas, SEM emoji)",
  "caption": "legenda autêntica para Instagram, tom ${isKids ? 'leve e divertido' : 'próximo e inspirador'}, com emojis moderados, max 2 parágrafos",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"]
}

`

  if (mode === 'commemorative' && commemorativeData) {
    ctx += `Contexto: Post para "${commemorativeData.name}" (${commemorativeData.caption_hint || commemorativeData.post_idea || 'data comemorativa musical'}).
A legenda deve celebrar esta data, conectar com a escola e inspirar os seguidores. Hashtags devem incluir a data comemorativa + escola.`
  } else if (mode === 'birthday' && studentData) {
    ctx += `Contexto: Post de aniversário para o aluno "${studentData.person_name?.split(' ')[0]}".`
  } else if (event_name) {
    ctx += `Contexto: Post sobre o evento "${event_name}" da escola.`
  } else if (brief) {
    ctx += `Contexto: ${brief}`
  } else {
    ctx += `Contexto: Post institucional da escola de música.`
  }

  ctx += `\n\nResponda APENAS o JSON, sem markdown, sem explicação.`
  return ctx
}

function buildImagePrompt(p: any): string {
  const { mode, brand, brief, studentData, commemorativeData, brandName, isKids, event_name, mainPhrase, post_type, dimensions, hasPhoto, hasLogo, photoOnly } = p

  // PHOTO ONLY MODE: gera apenas a foto cinematográfica, sem texto nem logo
  if (photoOnly) {
    let prompt = `Generate a cinematic photograph (${dimensions}). PURE PHOTOGRAPHY ONLY.\n`
    prompt += `Shot on 85mm lens, f/1.8, shallow depth of field, natural bokeh. Cinematic color grading. Warm natural lighting.\n`
    prompt += `${isKids ? 'Subject: A real child (5-12 years old) in a music school environment.' : 'Subject: A real young person (18-25 years old) in a music environment.'}\n`
    prompt += `ABSOLUTELY NO TEXT, NO LOGOS, NO WATERMARKS, NO GRAPHICS, NO OVERLAYS. Pure photography only.\n`

    if (mode === 'commemorative' && commemorativeData) {
      const dn = (commemorativeData.name || '').toLowerCase()
      if (dn.includes('piano') || dn.includes('pianista')) prompt += isKids ? 'Scene: Child at piano, soft side lighting.' : 'Scene: Young person at grand piano, dramatic window light, profile.'
      else if (dn.includes('guitarra') || dn.includes('guitarrista')) prompt += isKids ? 'Scene: Child with electric guitar, natural light.' : 'Scene: Young guitarist, close-up, moody lighting.'
      else if (dn.includes('violao') || dn.includes('violão') || dn.includes('violonista')) prompt += isKids ? 'Scene: Child with acoustic guitar, warm light.' : 'Scene: Young adult with acoustic guitar, window light.'
      else if (dn.includes('bateria') || dn.includes('baterista')) prompt += isKids ? 'Scene: Child behind drums, soft lighting.' : 'Scene: Young drummer, action shot, warm tones.'
      else if (dn.includes('jazz')) prompt += isKids ? 'Scene: Child with brass instrument.' : 'Scene: Young saxophone player, moody warm lighting.'
      else if (dn.includes('rock')) prompt += isKids ? 'Scene: Kid with electric guitar, spotlight.' : 'Scene: Young guitarist, single spotlight, dark background.'
      else if (dn.includes('mae') || dn.includes('mãe')) prompt += 'Scene: Mother and child at piano, warm natural light.'
      else if (dn.includes('pai')) prompt += 'Scene: Father and child with guitars, warm light.'
      else prompt += isKids ? 'Scene: Child playing instrument, natural light, clean background.' : 'Scene: Young musician, cinematic portrait, warm tones.'
    } else if (event_name) {
      prompt += `Scene: ${isKids ? 'Children performing music, warm atmosphere.' : 'Young musicians on stage, dramatic lighting.'}`
    } else if (brief) {
      prompt += `Scene: ${brief}. Musical context, cinematic quality.`
    } else {
      prompt += isKids ? 'Scene: Child discovering music, natural light.' : 'Scene: Young musician, cinematic, passionate.'
    }

    prompt += '\nFINAL: Must look like professional photographer portfolio. Real person, real instrument. NO text, NO graphics, NO logos anywhere in the image.'
    return prompt
  }

  let prompt = `Create an Instagram ${post_type === 'story' ? 'Story' : 'post'} image (${dimensions}).

MANDATORY STYLE:
- REAL PHOTOGRAPHY. Shot on 85mm lens, f/1.8, shallow depth of field, natural bokeh.
- Cinematic color grading. Warm tones. Natural lighting — golden hour or soft studio light.
- ${isKids ? 'A real CHILD (5-12 years old) playing an instrument. Genuine smile, authentic moment.' : 'A real YOUNG PERSON (18-25 years old) playing an instrument. Focused, passionate, authentic moment.'}
- MINIMALIST composition. Clean, uncluttered. The person and instrument are the focus. Nothing else.
- NO flying musical notes, NO sparkles, NO confetti, NO neon effects, NO futuristic elements, NO decorative music symbols.
- Think: professional portrait photography meets editorial magazine.

TEXT OVERLAY (minimal):
- ${isKids ? 'Colors: warm earth tones' : 'Colors: clean white text, subtle dark gradient at bottom for readability'}
- Modern sans-serif typography, minimal, elegant
- ONLY the date name and the brand logo. Nothing else. No extra phrases.

`

  if (mode === 'commemorative' && commemorativeData) {
    const dateName = commemorativeData.name || 'Data Comemorativa'
    prompt += `THEME: "${dateName}"
TEXT OVERLAY: "${dateName}" as main headline${mainPhrase ? `, "${mainPhrase}" as secondary` : ''}
PHOTO SCENE: `

    const dn = dateName.toLowerCase()
    if (dn.includes('piano') || dn.includes('pianista')) {
      prompt += isKids ? 'Close-up of a child hands on piano keys, soft side lighting, blurred background.' : 'Young person at a grand piano, profile view, dramatic window light, cinematic.'
    } else if (dn.includes('guitarra') || dn.includes('guitarrista')) {
      prompt += isKids ? 'Child holding electric guitar, natural light, simple background.' : 'Young guitarist, close-up portrait with guitar, shallow depth of field, moody lighting.'
    } else if (dn.includes('violao') || dn.includes('violão') || dn.includes('violonista')) {
      prompt += isKids ? 'Child with acoustic guitar, sitting, warm natural light.' : 'Young adult playing acoustic guitar, intimate close-up, window light, minimal background.'
    } else if (dn.includes('bateria') || dn.includes('baterista')) {
      prompt += isKids ? 'Child behind drums, natural expression, soft lighting.' : 'Young drummer, action shot, shallow DOF, warm tones.'
    } else if (dn.includes('jazz')) {
      prompt += isKids ? 'Child with brass instrument, warm tones.' : 'Young saxophone player, moody warm lighting, intimate setting, editorial portrait.'
    } else if (dn.includes('mae') || dn.includes('mãe')) {
      prompt += 'Mother and child at piano together, warm natural light, intimate moment, minimal.'
    } else if (dn.includes('pai')) {
      prompt += 'Father and child with guitars, natural light, warm bonding moment, simple background.'
    } else if (dn.includes('rock')) {
      prompt += isKids ? 'Kid with electric guitar, simple dark background, spotlight.' : 'Young guitarist on stage, single spotlight, dark background, cinematic.'
    } else {
      prompt += isKids ? 'Child playing instrument, natural light, clean simple background, authentic moment.' : 'Young musician playing, cinematic portrait, shallow DOF, warm tones, minimal background.'
    }
    prompt += '\n'
  } else if (mode === 'birthday' && studentData) {
    prompt += `THEME: Birthday celebration
TEXT OVERLAY: "Feliz Aniversário" headline, "${studentData.person_name?.split(' ')[0]}" name, balloons and confetti decorative elements
PHOTO SCENE: Celebration atmosphere with musical elements.\n`
  } else if (event_name) {
    prompt += `THEME: Music school event "${event_name}"
TEXT OVERLAY: "${event_name}" as headline
PHOTO SCENE: ${isKids ? 'Children performing on stage, parents watching, warm school event atmosphere.' : 'Young musicians on stage, live performance energy, audience, dramatic lighting.'}\n`
  } else if (brief) {
    prompt += `THEME: ${brief}
PHOTO SCENE: ${isKids ? 'Happy children in a music school environment, authentic and warm.' : 'Inspired young musicians, authentic photography, emotional connection with music.'}\n`
  } else {
    prompt += `THEME: ${brandName} music school
PHOTO SCENE: ${isKids ? 'Joyful children discovering music, diverse instruments, warm school setting.' : 'Young adults passionate about music, instruments, studio or stage, cinematic quality.'}\n`
  }

  if (hasPhoto) {
    prompt += `\nIMPORTANT: First attached image is a REAL photo of a person. Use this EXACT photo without modifying the face. Incorporate it into the design with a decorative frame.\n`
  }

  if (hasLogo) {
    prompt += `${hasPhoto ? 'Second' : 'First'} attached image is the brand logo. Place at bottom, small but visible.\n`
  } else {
    prompt += `Include "${brandName}" as small text at bottom.\n`
  }

  prompt += `\nFINAL: The result must look like a photo from a professional photographer's portfolio — real person, real instrument, cinematic quality. Minimal text overlay. NO illustrations, NO digital effects, NO flying notes, NO sparkles, NO neon, NO futuristic elements. Clean and elegant.`

  return prompt
}
