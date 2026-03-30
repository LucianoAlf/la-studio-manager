/**
 * publish-scheduled-posts v1
 *
 * Publica posts agendados no Instagram via Meta Graph API v21.0
 *
 * Modos:
 *   { post_id: "uuid" }  → publica um post específico (imediato)
 *   { }                   → publica todos com scheduled_for <= now() (cron)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PostRow {
  id: string
  brand: string
  post_type: string
  caption: string | null
  metadata: { image_url?: string; slides?: string[]; slide_urls?: string[] } | null
  scheduled_for: string | null
}

async function createInstagramImageContainer(
  instagramAccountId: string,
  accessToken: string,
  imageUrl: string,
  caption?: string | null,
  isStory?: boolean,
  isCarouselItem?: boolean,
): Promise<string> {
  const params = new URLSearchParams({
    access_token: accessToken,
    image_url: imageUrl,
    ...(isStory ? { media_type: 'STORIES' } : {}),
    ...(caption && !isStory && !isCarouselItem ? { caption } : {}),
    ...(isCarouselItem ? { is_carousel_item: 'true' } : {}),
  })

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${instagramAccountId}/media`,
    { method: 'POST', body: params }
  )
  const data = await response.json()

  if (!data.id) {
    throw new Error(`Container failed: ${JSON.stringify(data)}`)
  }

  return data.id as string
}

async function publishInstagramContainer(
  instagramAccountId: string,
  accessToken: string,
  creationId: string,
): Promise<string> {
  const publishParams = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  })

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${instagramAccountId}/media_publish`,
    { method: 'POST', body: publishParams }
  )
  const publishData = await publishRes.json()

  if (!publishData.id) {
    throw new Error(`Publish failed: ${JSON.stringify(publishData)}`)
  }

  return publishData.id as string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json().catch(() => ({}))
    const { post_id } = body as { post_id?: string }

    let posts: PostRow[] = []

    if (post_id) {
      // Modo imediato: publica um post específico
      const { data, error } = await supabase
        .from('posts')
        .select('id, brand, post_type, caption, metadata, scheduled_for')
        .eq('id', post_id)
        .in('status', ['draft', 'scheduled', 'approved'])
        .single()
      if (error || !data) {
        return json({ success: false, error: `Post not found or already published: ${error?.message}` }, 404)
      }
      posts = [data as PostRow]
    } else {
      // Modo cron: busca todos com horário <= agora
      const { data, error } = await supabase
        .from('posts')
        .select('id, brand, post_type, caption, metadata, scheduled_for')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(10)
      if (error) {
        return json({ success: false, error: error.message }, 500)
      }
      posts = (data || []) as PostRow[]
    }

    if (posts.length === 0) {
      return json({ success: true, published: 0, message: 'No posts to publish' })
    }

    console.log(`[PUBLISH] Processing ${posts.length} post(s)`)

    let published = 0
    let failed = 0
    const errors: string[] = []

    for (const post of posts) {
      try {
        const imageUrl = post.metadata?.image_url
        const slideUrls = post.metadata?.slide_urls || post.metadata?.slides || []
        if (!imageUrl && post.post_type !== 'carousel') {
          throw new Error('No image_url in metadata')
        }

        // Get Instagram credentials
        const integrationName = post.brand === 'la_music_kids' ? 'instagram_kids' : 'instagram_school'
        const { data: cred, error: credErr } = await supabase
          .from('integration_credentials')
          .select('credentials')
          .eq('integration_name', integrationName)
          .eq('is_active', true)
          .single()

        if (credErr || !cred) {
          throw new Error(`Credentials not found for ${integrationName}: ${credErr?.message}`)
        }

        const { access_token, instagram_account_id } = (cred as { credentials: { access_token: string; instagram_account_id: string } }).credentials
        if (!access_token || !instagram_account_id) {
          throw new Error('Missing access_token or instagram_account_id')
        }

        let publishId = ''

        if (post.post_type === 'carousel') {
          if (!Array.isArray(slideUrls) || slideUrls.length < 2) {
            throw new Error('Carousel requires at least 2 slide_urls in metadata')
          }

          const childIds: string[] = []
          for (const slideUrl of slideUrls.slice(0, 10)) {
            const childId = await createInstagramImageContainer(
              instagram_account_id,
              access_token,
              slideUrl,
              null,
              false,
              true,
            )
            childIds.push(childId)
          }

          await new Promise(r => setTimeout(r, 3000))

          const parentParams = new URLSearchParams({
            access_token,
            media_type: 'CAROUSEL',
            children: childIds.join(','),
            ...(post.caption ? { caption: post.caption } : {}),
          })

          const parentRes = await fetch(
            `https://graph.facebook.com/v21.0/${instagram_account_id}/media`,
            { method: 'POST', body: parentParams }
          )
          const parentData = await parentRes.json()

          if (!parentData.id) {
            throw new Error(`Carousel parent failed: ${JSON.stringify(parentData)}`)
          }

          console.log(`[PUBLISH] Carousel container created: ${parentData.id} (${childIds.length} slides)`)
          await new Promise(r => setTimeout(r, 3000))
          publishId = await publishInstagramContainer(instagram_account_id, access_token, parentData.id as string)
        } else {
          const isStory = post.post_type === 'story' || post.post_type === 'reels'
          const mediaType = isStory ? 'STORIES' : 'IMAGE'
          const creationId = await createInstagramImageContainer(
            instagram_account_id,
            access_token,
            imageUrl!,
            post.caption,
            isStory,
            false,
          )

          console.log(`[PUBLISH] Container created: ${creationId} (${mediaType})`)
          await new Promise(r => setTimeout(r, 3000))
          publishId = await publishInstagramContainer(instagram_account_id, access_token, creationId)
        }

        console.log(`[PUBLISH] Published! IG Post ID: ${publishId}`)

        // Update post status
        await supabase
          .from('posts')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            metadata: { ...post.metadata, ig_post_id: publishId },
          } as never)
          .eq('id', post.id)

        published++
      } catch (e) {
        console.error(`[PUBLISH] Failed post ${post.id}:`, e)
        failed++
        errors.push(`${post.id}: ${String(e)}`)

        // Mark as failed
        await supabase
          .from('posts')
          .update({ status: 'failed', metadata: { ...post.metadata, publish_error: String(e) } } as never)
          .eq('id', post.id)
      }
    }

    console.log(`[PUBLISH] Done: ${published} published, ${failed} failed`)

    return json({
      success: published > 0 || failed === 0,
      published,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    })

  } catch (error) {
    console.error('[PUBLISH] Fatal:', error)
    return json({ success: false, error: String(error) }, 500)
  }
})
