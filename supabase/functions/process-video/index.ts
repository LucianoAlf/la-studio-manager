/**
 * process-video v15
 * Suporta dois fluxos:
 * 1. YouTube URL → /v1/projects/magic-clips (JSON)
 * 2. Arquivo local → /v1/projects/magic-clips/upload (multipart)
 *
 * Fase 1: Recebe config do frontend (templateName, minClipLength, maxClipLength, faceTracking)
 * Fase 2: Salva post_processing_config no metadata para o webhook aplicar
 * v12: Removido campo dictionary (não suportado pela API Magic Clips)
 * v13: Adicionado suporte a pós-processamento (cleanAudio, removeSilence, magicZooms, magicBrolls)
 * v14: Adicionado disableCaptions para vídeos sem legenda
 * v15: Adicionado maxClips para curadoria por virality score no webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUBMAGIC_API_KEY = Deno.env.get('SUBMAGIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Detecta se é URL do YouTube
function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url)
}

serve(async (req: Request) => {
  // Sempre retorna CORS headers, mesmo em erros
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let supabase: ReturnType<typeof createClient> | null = null
  let currentVideoId: string | null = null

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const body = await req.json()
    const video_id = body?.video_id
    const config = body?.config || {}
    currentVideoId = video_id

    console.log(`[VIDEO] v11 received: video_id=${video_id}, config=`, JSON.stringify(config))

    // Config padrão se não fornecido (Fase 1: Magic Clips)
    const templateName = config?.templateName || 'Hormozi 2'
    const minClipLength = config?.minClipLength || 15
    const maxClipLength = config?.maxClipLength || 60
    const faceTracking = config?.faceTracking !== false
    const disableCaptions = config?.disableCaptions || false
    const maxClips = config?.maxClips || 10

    // Config de pós-processamento (Fase 2)
    const cleanAudio = config?.cleanAudio || false
    const removeSilencePace = config?.removeSilencePace || null
    const removeBadTakes = config?.removeBadTakes || false
    const magicZooms = config?.magicZooms || false
    const magicBrolls = config?.magicBrolls || false
    const magicBrollsPercentage = config?.magicBrollsPercentage || 50

    // Verificar se há pós-processamento ativado
    const hasPostProcessing = cleanAudio || removeBadTakes || magicZooms || magicBrolls || removeSilencePace

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id obrigatorio' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar video no banco
    const { data: video, error: videoErr } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('id', video_id)
      .single()

    if (videoErr || !video) {
      return new Response(JSON.stringify({ error: 'Video nao encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!video.file_url) {
      return new Response(JSON.stringify({ error: 'Video sem file_url' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isYouTube = isYouTubeUrl(video.file_url)
    console.log(`[VIDEO] v6 | ${isYouTube ? 'YOUTUBE' : 'UPLOAD'} | ${video.title} | ${video.file_url}`)

    // Marcar como processando
    await supabase.from('studio_videos').update({
      status: 'transcribing',
      updated_at: new Date().toISOString()
    }).eq('id', video_id)

    // Webhook URL
    const webhookUrl = `${SUPABASE_URL}/functions/v1/submagic-webhook?video_id=${video_id}`

    if (!SUBMAGIC_API_KEY) {
      throw new Error('SUBMAGIC_API_KEY nao configurada nas secrets')
    }

    let submagicRes: Response
    let submagicData: any

    if (isYouTube) {
      // ========== FLUXO YOUTUBE ==========
      console.log(`[VIDEO] Sending YouTube URL to Submagic... Template: ${templateName}, Duration: ${minClipLength}-${maxClipLength}s, FaceTracking: ${faceTracking}`)

      const payload: Record<string, unknown> = {
        title: video.title || 'LA Music Video',
        youtubeUrl: video.file_url,
        language: 'pt',
        templateName,
        webhookUrl,
        minClipLength,
        maxClipLength,
        faceTracking,
        ...(disableCaptions && { disableCaptions: true }),
      }

      submagicRes = await fetch('https://api.submagic.co/v1/projects/magic-clips', {
        method: 'POST',
        headers: {
          'x-api-key': SUBMAGIC_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      const responseText = await submagicRes.text()
      console.log(`[VIDEO] Submagic YouTube raw response: ${submagicRes.status}`, responseText)

      try {
        submagicData = JSON.parse(responseText)
      } catch {
        throw new Error(`Submagic retornou resposta invalida (${submagicRes.status}): ${responseText.substring(0, 200)}`)
      }

    } else {
      // ========== FLUXO UPLOAD ==========
      console.log(`[VIDEO] Downloading video from Storage...`)

      const videoRes = await fetch(video.file_url)
      if (!videoRes.ok) {
        throw new Error(`Falha ao baixar video: ${videoRes.status}`)
      }
      const videoBlob = await videoRes.blob()
      console.log(`[VIDEO] Downloaded: ${videoBlob.size} bytes`)

      // Atualizar status
      await supabase.from('studio_videos').update({
        status: 'analyzing',
        updated_at: new Date().toISOString()
      }).eq('id', video_id)

      console.log(`[VIDEO] Sending to Submagic Magic Clips Upload... Template: ${templateName}, Duration: ${minClipLength}-${maxClipLength}s, FaceTracking: ${faceTracking}`)

      const formData = new FormData()
      formData.append('file', videoBlob, `${video.title || 'video'}.mp4`)
      formData.append('title', video.title || 'LA Music Video')
      formData.append('language', 'pt')
      formData.append('templateName', templateName)
      formData.append('webhookUrl', webhookUrl)
      formData.append('minClipLength', String(minClipLength))
      formData.append('maxClipLength', String(maxClipLength))
      formData.append('faceTracking', String(faceTracking))
      if (disableCaptions) formData.append('disableCaptions', 'true')
      // Nota: dictionary não é suportado no endpoint multipart/upload

      submagicRes = await fetch('https://api.submagic.co/v1/projects/magic-clips/upload', {
        method: 'POST',
        headers: { 'x-api-key': SUBMAGIC_API_KEY },
        body: formData
      })

      const uploadResponseText = await submagicRes.text()
      console.log(`[VIDEO] Submagic Upload raw response: ${submagicRes.status}`, uploadResponseText)

      try {
        submagicData = JSON.parse(uploadResponseText)
      } catch {
        throw new Error(`Submagic retornou resposta invalida (${submagicRes.status}): ${uploadResponseText.substring(0, 200)}`)
      }
    }

    // Processar resposta
    if (!submagicRes.ok) {
      if (submagicRes.status === 403) {
        throw new Error('Magic Clips add-on nao ativo. Ative em submagic.co')
      }
      const errorMsg = submagicData.message || submagicData.error || JSON.stringify(submagicData)
      throw new Error(`Submagic error ${submagicRes.status}: ${errorMsg}`)
    }

    const projectId = submagicData.id
    console.log(`[VIDEO] Submagic project created: ${projectId}`)

    // Salvar project_id e config usado
    await supabase.from('studio_videos').update({
      status: 'analyzing',
      metadata: {
        ...(video.metadata || {}),
        submagic_project_id: projectId,
        submagic_type: isYouTube ? 'magic-clips-youtube' : 'magic-clips-upload',
        submagic_status: 'processing',
        submagic_submitted_at: new Date().toISOString(),
        submagic_config: { templateName, minClipLength, maxClipLength, faceTracking, disableCaptions },
        max_clips: maxClips, // Curadoria: quantos clips salvar (ordenados por virality)
        // Fase 2: config de pós-processamento para o webhook usar
        post_processing_config: hasPostProcessing ? {
          cleanAudio,
          removeSilencePace,
          removeBadTakes,
          magicZooms,
          magicBrolls,
          magicBrollsPercentage,
          templateName,
        } : null,
      },
      updated_at: new Date().toISOString()
    }).eq('id', video_id)

    return new Response(JSON.stringify({
      success: true,
      video_id,
      submagic_project_id: projectId,
      type: isYouTube ? 'youtube' : 'upload',
      status: 'processing',
      message: 'Video enviado para Submagic. Webhook notificara quando pronto (2-10 min).',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[VIDEO] Error:', error)

    // Salvar erro no banco usando currentVideoId capturado no início
    if (currentVideoId && supabase) {
      try {
        await supabase.from('studio_videos').update({
          status: 'failed',
          error_message: String(error).substring(0, 500),
          updated_at: new Date().toISOString()
        }).eq('id', currentVideoId)
      } catch (dbErr) {
        console.error('[VIDEO] Failed to save error to DB:', dbErr)
      }
    }

    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
