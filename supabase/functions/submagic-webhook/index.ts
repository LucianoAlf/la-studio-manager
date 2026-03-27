/**
 * submagic-webhook v8
 * Recebe webhooks do Submagic quando Magic Clips termina de processar
 *
 * Fluxo: Submagic gera clips → webhook salva top N por virality → pronto
 * Magic Clips já entrega com legendas, face tracking e reframe 9:16
 *
 * v3: Suporte a múltiplas estruturas de payload (batch, individual, exportUrl direto)
 * v5: Fix duration_seconds (GENERATED), virality_score expandido, WhatsApp notification
 * v6: Curadoria por virality score - salva apenas os top N clips (max_clips)
 * v7: Fix curadoria com múltiplos webhooks - verifica clips existentes no banco antes de salvar
 * v8: Pós-processamento DESATIVADO para economizar créditos da API
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const url = new URL(req.url)
    const videoId = url.searchParams.get('video_id')

    if (!videoId) {
      console.error('[WEBHOOK] Missing video_id in query params')
      return new Response(JSON.stringify({ error: 'video_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const payload = await req.json()
    // Log completo do payload para debug
    console.log(`[WEBHOOK] FULL PAYLOAD for video ${videoId}:`, JSON.stringify(payload))

    // Buscar vídeo no banco
    const { data: video, error: videoErr } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('id', videoId)
      .single()

    if (videoErr || !video) {
      console.error('[WEBHOOK] Video not found:', videoId)
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Submagic status: 'failed' ou 'completed'
    if (payload.status === 'failed') {
      console.log(`[WEBHOOK] Submagic failed for video ${videoId}`)
      await supabase.from('studio_videos').update({
        status: 'failed',
        error_message: payload.error || payload.message || 'Submagic processing failed',
        metadata: {
          ...(video.metadata || {}),
          submagic_status: 'failed',
          submagic_error: payload.error || payload.message,
        },
        updated_at: new Date().toISOString()
      }).eq('id', videoId)

      return new Response(JSON.stringify({ success: true, status: 'failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (payload.status === 'completed' || payload.status === 'success' || payload.exportUrl) {
      console.log(`[WEBHOOK] Submagic completed/clip ready for video ${videoId}`)

      // Tentar extrair clipes de múltiplas estruturas possíveis
      let clips: any[] = []

      // Estrutura 1: Magic Clips usa magicClips array
      if (Array.isArray(payload.magicClips)) {
        clips = payload.magicClips
      } else if (Array.isArray(payload.clips)) {
        clips = payload.clips
      } else if (Array.isArray(payload.results)) {
        clips = payload.results
      } else if (Array.isArray(payload.videos)) {
        clips = payload.videos
      } else if (payload.data && Array.isArray(payload.data.clips)) {
        clips = payload.data.clips
      }
      // Estrutura 2: Clipe individual com directUrl/exportUrl direto no payload
      else if (payload.directUrl || payload.exportUrl || payload.videoUrl || payload.url) {
        clips = [{
          id: payload.id || payload.clipId,
          title: payload.title || payload.name || `Clip`,
          directUrl: payload.directUrl || payload.exportUrl || payload.videoUrl || payload.url,
          thumbnailUrl: payload.thumbnailUrl || payload.thumbnail,
          duration: payload.duration || payload.durationSeconds,
          viralityScores: payload.viralityScores,
        }]
      }

      console.log(`[WEBHOOK] Found ${clips.length} clips from Submagic`)

      // Curadoria: verificar quantos clipes já existem no banco para esse vídeo
      const maxClips = Number(video?.metadata?.max_clips) || 10
      console.log(`[WEBHOOK] max_clips from metadata: ${video?.metadata?.max_clips}, parsed: ${maxClips}`)

      const { count: existingCount } = await supabase
        .from('studio_clips')
        .select('*', { count: 'exact', head: true })
        .eq('video_id', videoId)

      const existingClipsCount = existingCount || 0
      const remainingSlots = Math.max(0, maxClips - existingClipsCount)
      console.log(`[WEBHOOK] Existing clips: ${existingClipsCount}, remaining slots: ${remainingSlots}`)

      // Se já atingiu o limite, não salvar mais
      if (remainingSlots === 0) {
        console.log(`[WEBHOOK] Max clips (${maxClips}) already reached, skipping batch`)
        return new Response(JSON.stringify({
          success: true,
          clips_saved: 0,
          message: `Max clips (${maxClips}) already reached`,
          existing_count: existingClipsCount
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Ordenar por virality score e pegar só os top N (respeitando slots restantes)
      const sortedClips = [...clips].sort((a, b) => {
        const scoreA = a.viralityScores?.total || 0
        const scoreB = b.viralityScores?.total || 0
        return scoreB - scoreA
      })
      const selectedClips = sortedClips.slice(0, remainingSlots)
      console.log(`[WEBHOOK] Curadoria: ${clips.length} clips → top ${selectedClips.length} (slots disponíveis: ${remainingSlots})`)

      // Usar selectedClips a partir daqui
      clips = selectedClips

      if (clips.length === 0) {
        // Salvar payload bruto para debug
        await supabase.from('studio_videos').update({
          status: 'ready',
          metadata: {
            ...(video.metadata || {}),
            submagic_status: 'completed',
            clips_count: 0,
            last_webhook_payload: payload, // Debug: ver estrutura real
          },
          updated_at: new Date().toISOString()
        }).eq('id', videoId)

        console.log(`[WEBHOOK] No clips found in payload structure. Keys: ${Object.keys(payload).join(', ')}`)

        return new Response(JSON.stringify({ success: true, clips_saved: 0, payload_keys: Object.keys(payload) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Salvar clipes no banco
      const savedClips: Array<{ id: string; title: string; file_url: string }> = []

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i]
        // Log detalhado para debug da estrutura do clip
        if (i === 0) {
          console.log(`[WEBHOOK] First clip structure keys:`, Object.keys(clip).join(', '))
          console.log(`[WEBHOOK] First clip sample:`, JSON.stringify(clip).substring(0, 800))
          // Log específico de campos de título
          console.log(`[WEBHOOK] Title fields: title=${clip.title}, hookTitle=${clip.hookTitle}, generatedTitle=${clip.generatedTitle}, caption=${clip.caption}, name=${clip.name}, projectTitle=${clip.projectTitle}, hook=${clip.hook}`)
        }
        // Magic Clips usa directUrl, outros usam exportUrl
        const clipUrl = clip.directUrl || clip.exportUrl || clip.downloadUrl || clip.url || clip.videoUrl
        // Tentar múltiplos campos para o título/frase de gancho (Submagic Magic Clips usa hookTitle ou title)
        const clipTitle = clip.hookTitle || clip.title || clip.generatedTitle || clip.hook || clip.caption || clip.name || clip.projectTitle || `Clip ${i + 1}`

        // Pular clipes ainda em processamento
        if (clip.status === 'processing') {
          console.log(`[WEBHOOK] Clip ${i} is still processing, skipping`)
          continue
        }

        if (!clipUrl) {
          console.warn(`[WEBHOOK] Clip ${i} has no URL, skipping`)
          continue
        }

        const { data: savedClip, error: clipErr } = await supabase
          .from('studio_clips')
          .insert({
            video_id: videoId,
            brand: video.brand,
            title: clipTitle,
            file_url: clipUrl,
            thumbnail_url: clip.thumbnailUrl || null,
            start_seconds: 0,
            end_seconds: clip.duration || 30,
            // duration_seconds NÃO incluir — coluna GENERATED
            status: 'ready',
            metadata: {
              submagic_clip_id: clip.id,
              virality_score: clip.viralityScores?.total || null,
              hook_strength: clip.viralityScores?.hook_strength || null,
              shareability: clip.viralityScores?.shareability || null,
              story_quality: clip.viralityScores?.story_quality || null,
              emotional_impact: clip.viralityScores?.emotional_impact || null,
              preview_url: clip.previewUrl || null,
              download_url: clip.downloadUrl || null,
              direct_url: clip.directUrl || null,
            }
          })
          .select()
          .single()

        if (clipErr) {
          console.error(`[WEBHOOK] Failed to save clip ${i}:`, clipErr)
        } else if (savedClip) {
          savedClips.push({
            id: savedClip.id,
            title: savedClip.title,
            file_url: savedClip.file_url
          })
          console.log(`[WEBHOOK] Saved clip: ${savedClip.id} - ${clipTitle}`)
        }
      }

      // PÓS-PROCESSAMENTO DESATIVADO - consome muitos créditos da API
      // Magic Clips já entrega com legendas, face tracking e reframe 9:16
      // Reativar no futuro quando necessário

      // Atualizar vídeo como pronto (sem pós-processamento)
      await supabase.from('studio_videos').update({
        status: 'ready',
        metadata: {
          ...(video.metadata || {}),
          submagic_status: 'completed',
          clips_count: savedClips.length,
        },
        updated_at: new Date().toISOString()
      }).eq('id', videoId)

      // Notificação WhatsApp quando clipes estão prontos (novo fluxo conversacional)
      const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL')
      const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')
      const YURI_PHONE = Deno.env.get('YURI_PHONE')

      if (UAZAPI_SERVER_URL && UAZAPI_TOKEN && YURI_PHONE && savedClips.length > 0) {
        // Ordenar por score para pegar o melhor
        const sortedByScore = [...clips].sort((a: any, b: any) => {
          return (b.viralityScores?.total || 0) - (a.viralityScores?.total || 0)
        })
        const bestClip = sortedByScore[0]
        const bestScore = bestClip?.viralityScores?.total || 0
        const bestTitle = bestClip?.hookTitle || bestClip?.title || 'Sem título'

        // Determinar conta do Instagram
        const igAccount = video.brand === 'la_music_kids' ? '@lamusickids' : '@lamusicschool'

        const msg =
          `🎬 *${savedClips.length} clipes prontos* de "${video.title || 'Vídeo'}"\n\n` +
          `Melhor: "${bestTitle.substring(0, 40)}${bestTitle.length > 40 ? '...' : ''}" (${bestScore})\n` +
          `📍 Conta: ${igAccount}\n\n` +
          `Manda *VER* pra escolher.`

        await fetch(`${UAZAPI_SERVER_URL}/send/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
          body: JSON.stringify({ number: YURI_PHONE, text: msg, delay: 500 })
        }).catch(e => console.error('[WEBHOOK] WhatsApp error:', e))

        console.log(`[WEBHOOK] WhatsApp notification sent for ${savedClips.length} clips`)
      }

      return new Response(JSON.stringify({
        success: true,
        clips_saved: savedClips.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Status desconhecido ou evento de progresso - salvar para debug
    console.log(`[WEBHOOK] Unknown/progress status: ${payload.status}, keys: ${Object.keys(payload).join(', ')}`)

    // Salvar payload no metadata para debug
    await supabase.from('studio_videos').update({
      metadata: {
        ...(video.metadata || {}),
        last_webhook_event: {
          status: payload.status,
          keys: Object.keys(payload),
          timestamp: new Date().toISOString(),
        },
      },
      updated_at: new Date().toISOString()
    }).eq('id', videoId)

    return new Response(JSON.stringify({ success: true, status: payload.status, acknowledged: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[WEBHOOK] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
