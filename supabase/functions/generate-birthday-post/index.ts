/**
 * generate-birthday-post v2
 * Generates birthday posts using Canva Connect API
 *
 * Flow:
 * 1. Fetch student data from assets
 * 2. Upload student photo to Canva (if has_real_photo)
 * 3. Create autofill job with student name + photo
 * 4. Export the generated design
 * 5. Upload to Supabase Storage
 * 6. Log to birthday_automation_log
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Birthday template ID from Canva (original template)
const BIRTHDAY_TEMPLATE_ID = 'DAHFO425zfc'

// Autofill data keys (configured in Canva template)
const AUTOFILL_KEYS = {
  firstName: 'first_name',
  lastName: 'last_name',
  photo: 'student_photo',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CANVA_API_BASE = 'https://api.canva.com/rest/v1'

interface CanvaCredentials {
  access_token: string
  refresh_token: string
  expires_at?: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    const body = await req.json()
    const { asset_id, brand = 'la_music_school' } = body

    if (!asset_id) {
      return new Response(JSON.stringify({ success: false, error: 'asset_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BIRTHDAY] Starting for asset_id=${asset_id} brand=${brand}`)

    // 1. Fetch student data from assets
    const { data: student, error: studentError } = await supabase
      .from('assets')
      .select('id, person_name, file_url, birth_date, brand, metadata')
      .eq('id', asset_id)
      .single()

    if (studentError || !student) {
      console.error('[BIRTHDAY] Student not found:', studentError)
      return new Response(JSON.stringify({ success: false, error: 'Student not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BIRTHDAY] Student: ${student.person_name}`)

    // 2. Fetch Canva credentials
    const { data: canvaCred, error: credError } = await supabase
      .from('integration_credentials')
      .select('credentials')
      .eq('integration_name', 'canva')
      .single()

    if (credError || !canvaCred?.credentials) {
      console.error('[BIRTHDAY] Canva credentials error:', credError)
      return new Response(JSON.stringify({ success: false, error: 'Canva credentials not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const canvaCredentials = canvaCred.credentials as CanvaCredentials
    let accessToken = canvaCredentials.access_token

    // Check if token needs refresh (5 min buffer)
    if (canvaCredentials.expires_at && Date.now() > canvaCredentials.expires_at - 300000) {
      console.log('[BIRTHDAY] Token expired, refreshing...')
      const refreshed = await refreshCanvaToken(canvaCredentials.refresh_token)
      if (refreshed) {
        accessToken = refreshed.access_token
        await supabase
          .from('integration_credentials')
          .update({
            credentials: {
              ...canvaCredentials,
              access_token: refreshed.access_token,
              expires_at: Date.now() + (refreshed.expires_in * 1000),
            },
            last_validated_at: new Date().toISOString(),
          })
          .eq('integration_name', 'canva')
        console.log('[BIRTHDAY] Token refreshed successfully')
      } else {
        console.error('[BIRTHDAY] Token refresh failed')
      }
    }

    // 3. Parse student name
    const nameParts = (student.person_name || 'Aluno').split(' ')
    const firstName = nameParts[0] || 'Aluno'
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : ''

    // 4. Upload student photo to Canva (if they have one)
    let photoAssetId: string | null = null
    if (student.file_url && student.metadata?.has_real_photo) {
      console.log('[BIRTHDAY] Uploading student photo to Canva...')
      photoAssetId = await uploadAssetToCanva(accessToken, student.file_url, `birthday-${student.id}`)
      if (photoAssetId) {
        console.log(`[BIRTHDAY] Photo uploaded: ${photoAssetId}`)
      } else {
        console.warn('[BIRTHDAY] Photo upload failed, continuing without photo')
      }
    }

    // 5. Create autofill job
    console.log('[BIRTHDAY] Creating autofill job...')
    const autofillData: Record<string, any> = {
      [AUTOFILL_KEYS.firstName]: { type: 'text', text: firstName.toUpperCase() },
      [AUTOFILL_KEYS.lastName]: { type: 'text', text: lastName.toUpperCase() },
    }

    if (photoAssetId) {
      autofillData[AUTOFILL_KEYS.photo] = { type: 'image', asset_id: photoAssetId }
    }

    const autofillResult = await createAutofillJob(accessToken, BIRTHDAY_TEMPLATE_ID, autofillData)

    if (!autofillResult?.design_id) {
      // Autofill not available - try direct export of template
      console.log('[BIRTHDAY] Autofill not available, exporting template directly...')
      const exportResult = await exportDesign(accessToken, BIRTHDAY_TEMPLATE_ID)

      if (!exportResult?.url) {
        throw new Error('Failed to export design')
      }

      // Download and upload to storage
      const finalImageUrl = await downloadAndUploadImage(supabase, exportResult.url, brand, student.id)

      // Log to birthday_automation_log
      await logBirthdayPost(supabase, student, brand, finalImageUrl, false)

      return new Response(JSON.stringify({
        success: true,
        image_url: finalImageUrl,
        student_name: student.person_name,
        brand: brand,
        method: 'template_export',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BIRTHDAY] Autofill design created: ${autofillResult.design_id}`)

    // 6. Export the generated design
    console.log('[BIRTHDAY] Exporting design...')
    const exportResult = await exportDesign(accessToken, autofillResult.design_id)

    if (!exportResult?.url) {
      throw new Error('Failed to export design')
    }

    // 7. Download and upload to Supabase Storage
    console.log('[BIRTHDAY] Uploading to storage...')
    const finalImageUrl = await downloadAndUploadImage(supabase, exportResult.url, brand, student.id)

    // 8. Log to birthday_automation_log
    await logBirthdayPost(supabase, student, brand, finalImageUrl, !!photoAssetId)

    console.log(`[BIRTHDAY] Success! Image URL: ${finalImageUrl}`)

    return new Response(JSON.stringify({
      success: true,
      image_url: finalImageUrl,
      student_name: student.person_name,
      brand: brand,
      method: 'autofill',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[BIRTHDAY] Error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================================================
// Helper Functions
// ============================================================================

async function downloadAndUploadImage(
  supabase: any,
  url: string,
  brand: string,
  studentId: string
): Promise<string> {
  const imageResponse = await fetch(url)
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`)
  }

  const imageBlob = await imageResponse.blob()
  const storagePath = `birthday-posts/${brand}/${studentId}-${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('posts')
    .upload(storagePath, imageBlob, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage.from('posts').getPublicUrl(storagePath)
  return urlData.publicUrl
}

async function logBirthdayPost(
  supabase: any,
  student: any,
  brand: string,
  imageUrl: string,
  photoUsed: boolean
): Promise<void> {
  await supabase.from('birthday_automation_log').insert({
    student_id: student.id,
    student_name: student.person_name,
    brand: brand,
    image_url: imageUrl,
    approval_status: 'pending',
    metadata: {
      canva_template_id: BIRTHDAY_TEMPLATE_ID,
      photo_used: photoUsed,
      generated_at: new Date().toISOString(),
    },
  })
}

// ============================================================================
// Canva API Functions
// ============================================================================

async function refreshCanvaToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const clientId = Deno.env.get('CANVA_CLIENT_ID')
    const clientSecret = Deno.env.get('CANVA_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('[CANVA] Missing client credentials for refresh')
      return null
    }

    const res = await fetch(`${CANVA_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[CANVA] Token refresh failed:', res.status, text)
      return null
    }

    return await res.json()
  } catch (e) {
    console.error('[CANVA] Token refresh error:', e)
    return null
  }
}

async function uploadAssetToCanva(accessToken: string, imageUrl: string, name: string): Promise<string | null> {
  try {
    const res = await fetch(`${CANVA_API_BASE}/asset-uploads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: imageUrl, name }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[CANVA] Asset upload failed:', res.status, text)
      return null
    }

    const data = await res.json()

    // Poll for upload completion (max 20 seconds)
    if (data.job?.id) {
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000))

        const statusRes = await fetch(`${CANVA_API_BASE}/asset-uploads/${data.job.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })

        if (!statusRes.ok) continue

        const statusData = await statusRes.json()
        if (statusData.job?.status === 'success') {
          return statusData.job.asset?.id
        }
        if (statusData.job?.status === 'failed') {
          console.error('[CANVA] Asset upload job failed:', statusData.job.error)
          return null
        }
      }
      console.warn('[CANVA] Asset upload polling timeout')
    }

    return data.asset?.id || null
  } catch (e) {
    console.error('[CANVA] Asset upload error:', e)
    return null
  }
}

async function createAutofillJob(
  accessToken: string,
  brandTemplateId: string,
  data: Record<string, any>
): Promise<{ design_id: string } | null> {
  try {
    const res = await fetch(`${CANVA_API_BASE}/autofills`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_template_id: brandTemplateId,
        data: data,
        title: `Birthday Post - ${new Date().toISOString()}`,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[CANVA] Autofill create failed:', res.status, text)
      return null
    }

    const result = await res.json()

    // Poll for completion (max 30 seconds)
    if (result.job?.id) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))

        const statusRes = await fetch(`${CANVA_API_BASE}/autofills/${result.job.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })

        if (!statusRes.ok) continue

        const statusData = await statusRes.json()
        if (statusData.job?.status === 'success') {
          return { design_id: statusData.job.result?.design?.id }
        }
        if (statusData.job?.status === 'failed') {
          console.error('[CANVA] Autofill job failed:', statusData.job.error)
          return null
        }
      }
      console.warn('[CANVA] Autofill polling timeout')
    }

    return result.design?.id ? { design_id: result.design.id } : null
  } catch (e) {
    console.error('[CANVA] Autofill error:', e)
    return null
  }
}

async function exportDesign(accessToken: string, designId: string): Promise<{ url: string } | null> {
  try {
    const res = await fetch(`${CANVA_API_BASE}/exports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        design_id: designId,
        format: { type: 'png' },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[CANVA] Export create failed:', res.status, text)
      return null
    }

    const data = await res.json()
    const jobId = data.job?.id

    if (!jobId) {
      console.error('[CANVA] No export job ID returned')
      return null
    }

    // Poll for export completion (max 60 seconds)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000))

      const statusRes = await fetch(`${CANVA_API_BASE}/exports/${jobId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })

      if (!statusRes.ok) continue

      const statusData = await statusRes.json()

      if (statusData.job?.status === 'success') {
        const urls = statusData.job?.urls || statusData.job?.result?.urls
        if (urls?.length > 0) {
          return { url: urls[0] }
        }
      }

      if (statusData.job?.status === 'failed') {
        console.error('[CANVA] Export job failed:', statusData.job.error)
        return null
      }
    }

    console.error('[CANVA] Export polling timeout')
    return null
  } catch (e) {
    console.error('[CANVA] Export error:', e)
    return null
  }
}
