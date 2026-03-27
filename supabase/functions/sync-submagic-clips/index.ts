/**
 * sync-submagic-clips v1
 * Busca clipes de um projeto Submagic diretamente via API e salva no banco
 * Útil para recuperar clipes quando o webhook falha
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
    const { video_id } = await req.json()

    if (!video_id) {
      return new Response(JSON.stringify({ error: 'video_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar vídeo no banco
    const { data: video, error: videoErr } = await supabase
      .from('studio_videos')
      .select('*')
      .eq('id', video_id)
      .single()

    if (videoErr || !video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const projectId = video.metadata?.submagic_project_id
    if (!projectId) {
      return new Response(JSON.stringify({ error: 'No submagic_project_id in video metadata' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[SYNC] Fetching project ${projectId} from Submagic...`)

    // Buscar projeto no Submagic
    const projectRes = await fetch(`https://api.submagic.co/v1/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'x-api-key': SUBMAGIC_API_KEY,
      }
    })

    const projectData = await projectRes.json()
    console.log(`[SYNC] Submagic project response:`, JSON.stringify(projectData))

    if (!projectRes.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch project from Submagic',
        submagic_error: projectData
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Tentar extrair clipes de várias estruturas possíveis
    let clips: any[] = []

    // Magic Clips usa magicClips array
    if (Array.isArray(projectData.magicClips)) {
      clips = projectData.magicClips
    } else if (Array.isArray(projectData.clips)) {
      clips = projectData.clips
    } else if (Array.isArray(projectData.results)) {
      clips = projectData.results
    } else if (Array.isArray(projectData.videos)) {
      clips = projectData.videos
    } else if (Array.isArray(projectData.exports)) {
      clips = projectData.exports
    } else if (projectData.exportUrl) {
      // Projeto único, não Magic Clips
      clips = [{
        exportUrl: projectData.exportUrl,
        title: projectData.title || 'Video',
      }]
    }

    console.log(`[SYNC] Found ${clips.length} clips in project`)

    // Salvar clipes no banco
    const savedClips: string[] = []

    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      // Magic Clips usa directUrl, outros podem usar exportUrl, downloadUrl, etc
      const clipUrl = clip.directUrl || clip.exportUrl || clip.downloadUrl || clip.url || clip.videoUrl
      const clipTitle = clip.title || clip.name || `Clip ${i + 1}`

      // Pular clipes ainda em processamento
      if (clip.status === 'processing' || !clipUrl) {
        console.log(`[SYNC] Clip ${i} is processing or has no URL, skipping`)
        continue
      }

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('studio_clips')
        .select('id')
        .eq('video_id', video_id)
        .eq('file_url', clipUrl)
        .single()

      if (existing) {
        console.log(`[SYNC] Clip already exists: ${clipUrl}`)
        continue
      }

      const { data: savedClip, error: clipErr } = await supabase
        .from('studio_clips')
        .insert({
          video_id: video_id,
          brand: video.brand,
          title: clipTitle,
          file_url: clipUrl,
          thumbnail_url: clip.thumbnailUrl || clip.thumbnail || null,
          duration_seconds: clip.duration || clip.durationSeconds || null,
          status: 'ready',
          metadata: {
            submagic_clip_id: clip.id,
            virality_scores: clip.viralityScores,
            synced_manually: true,
            synced_at: new Date().toISOString(),
          }
        })
        .select()
        .single()

      if (clipErr) {
        console.error(`[SYNC] Failed to save clip ${i}:`, clipErr)
      } else if (savedClip) {
        savedClips.push(savedClip.id)
        console.log(`[SYNC] Saved clip: ${savedClip.id} - ${clipTitle}`)
      }
    }

    // Atualizar contagem no vídeo
    await supabase.from('studio_videos').update({
      metadata: {
        ...(video.metadata || {}),
        clips_count: savedClips.length,
        last_sync: new Date().toISOString(),
        submagic_project_data: projectData, // Salvar para debug
      },
      updated_at: new Date().toISOString()
    }).eq('id', video_id)

    return new Response(JSON.stringify({
      success: true,
      clips_saved: savedClips.length,
      project_status: projectData.status,
      project_data_keys: Object.keys(projectData),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[SYNC] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
