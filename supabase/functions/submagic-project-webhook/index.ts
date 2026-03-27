/**
 * submagic-project-webhook v1
 * Recebe webhooks do Submagic quando o pós-processamento de um clipe termina
 * (Fase 2: cleanAudio, magicZooms, magicBrolls, etc)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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
    const clipId = url.searchParams.get('clip_id')

    if (!clipId) {
      console.error('[PROJECT-WEBHOOK] Missing clip_id in query params')
      return new Response(JSON.stringify({ error: 'clip_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const payload = await req.json()
    console.log(`[PROJECT-WEBHOOK] Received for clip ${clipId}:`, JSON.stringify(payload).substring(0, 500))

    // Buscar clipe no banco
    const { data: clip, error: clipErr } = await supabase
      .from('studio_clips')
      .select('*')
      .eq('id', clipId)
      .single()

    if (clipErr || !clip) {
      console.error('[PROJECT-WEBHOOK] Clip not found:', clipId)
      return new Response(JSON.stringify({ error: 'Clip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Submagic status: 'failed' ou 'completed'/'success'
    if (payload.status === 'failed') {
      console.log(`[PROJECT-WEBHOOK] Post-processing failed for clip ${clipId}`)

      // Manter o clipe com vídeo original, só marcar que pós-processamento falhou
      await supabase.from('studio_clips').update({
        status: 'ready', // volta para ready com o vídeo original
        metadata: {
          ...(clip.metadata || {}),
          post_processing_failed: true,
          post_processing_error: payload.error || payload.message,
          post_processing_finished_at: new Date().toISOString(),
        }
      }).eq('id', clipId)

      return new Response(JSON.stringify({ success: true, status: 'failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (payload.status === 'completed' || payload.status === 'success') {
      console.log(`[PROJECT-WEBHOOK] Post-processing completed for clip ${clipId}`)

      // URL do vídeo pós-processado
      const newFileUrl = payload.exportUrl || payload.url || payload.videoUrl

      if (!newFileUrl) {
        console.warn(`[PROJECT-WEBHOOK] No exportUrl in payload, keeping original`)
        await supabase.from('studio_clips').update({
          status: 'ready',
          metadata: {
            ...(clip.metadata || {}),
            post_processing_completed: true,
            post_processing_no_url: true,
            post_processing_finished_at: new Date().toISOString(),
          }
        }).eq('id', clipId)
      } else {
        // Atualizar clipe com nova URL pós-processada
        await supabase.from('studio_clips').update({
          status: 'ready',
          file_url: newFileUrl,
          metadata: {
            ...(clip.metadata || {}),
            original_file_url: clip.file_url, // guardar URL original
            post_processed: true,
            post_processing_completed: true,
            post_processing_finished_at: new Date().toISOString(),
          }
        }).eq('id', clipId)

        console.log(`[PROJECT-WEBHOOK] Clip ${clipId} updated with post-processed URL`)
      }

      return new Response(JSON.stringify({ success: true, status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Status desconhecido
    console.log(`[PROJECT-WEBHOOK] Unknown status: ${payload.status}`)
    return new Response(JSON.stringify({ success: true, status: payload.status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[PROJECT-WEBHOOK] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
