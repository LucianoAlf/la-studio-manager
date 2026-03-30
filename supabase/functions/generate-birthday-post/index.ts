/**
 * generate-birthday-post v16
 * Gemini 3.1 Flash Image Preview + prompt festivo (balões, confetti, polaroid)
 * Envia foto do aluno + logo real da brand_identity → Gemini gera arte de aniversário
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const IMAGE_MODEL = 'gemini-3.1-flash-image-preview'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json()
    const { asset_id, brand = 'la_music_school' } = body

    if (!asset_id) {
      return json({ success: false, error: 'asset_id is required' }, 400)
    }

    console.log(`[BIRTHDAY] v16 | asset_id=${asset_id} brand=${brand}`)

    // 1. Fetch student data
    const { data: student, error: studentError } = await supabase
      .from('assets')
      .select('id, person_id, person_name, file_url, birth_date, brand, metadata')
      .eq('id', asset_id)
      .single()

    if (studentError || !student) {
      return json({ success: false, error: 'Student not found' }, 404)
    }

    const firstName = (student.person_name || 'Aluno').split(' ')[0]
    const hasRealPhoto = !!student.metadata?.has_real_photo
    const brandName = brand === 'la_music_kids' ? 'LA Music Kids' : 'LA Music School'

    console.log(`[BIRTHDAY] Student: ${student.person_name} | Photo: ${hasRealPhoto}`)

    // 2. Download student photo (if available)
    let photo: { data: string; mime: string } | null = null
    if (hasRealPhoto && student.file_url) {
      photo = await fetchAsBase64(student.file_url)
      if (photo) console.log('[BIRTHDAY] Photo downloaded')
    }

    // 3. Download brand logo from brand_identity
    const { data: bi } = await supabase
      .from('brand_identity')
      .select('logo_primary_url, logo_icon_url')
      .eq('brand_key', brand)
      .single()
    const logoUrl = bi?.logo_primary_url || bi?.logo_icon_url || null
    const logo = logoUrl ? await fetchAsBase64(logoUrl) : null
    if (logo) console.log('[BIRTHDAY] Logo downloaded')

    // 4. Build prompt — ESTILO FESTIVO (balões, confetti, polaroid, cores vibrantes)
    const prompt = photo
      ? `Create a vibrant, professional birthday celebration Story image (portrait format, 1080x1920 pixels).

Design requirements:
- Colorful festive background with balloons, confetti, sparkles and celebration elements
- Text "Feliz Aniversário" in elegant decorative script at the top
- The person from the attached photo should be prominently featured in the CENTER, inside a stylish polaroid-style frame with a slight tilt
- The name "${firstName.toUpperCase()}" in large, bold white text below the photo
- Use vibrant colors: purples, pinks, magentas, with golden accents
- Professional quality, suitable for Instagram Stories
- Make it celebratory and joyful!
${logo ? 'The last attached image is the brand logo. Place it small and visible at the bottom center.' : `"${brandName}" small text or logo area at the bottom.`}`
      : `Create a vibrant, professional birthday celebration Story image (portrait format, 1080x1920 pixels).

Design requirements:
- Colorful festive background with balloons, confetti, sparkles and celebration elements
- Text "Feliz Aniversário" in elegant decorative script at the top
- A large decorative circle or frame in the CENTER with the initials "${firstName[0]}" in bold white text on a purple background
- The name "${firstName.toUpperCase()}" in large, bold white text below the circle
- Use vibrant colors: purples, pinks, magentas, with golden accents
- Professional quality, suitable for Instagram Stories
- Make it celebratory and joyful!
${logo ? 'The attached image is the brand logo. Place it small and visible at the bottom center.' : `"${brandName}" small text at the bottom.`}`

    // 5. Call Gemini 3.1 Flash Image Preview
    console.log('[BIRTHDAY] Calling Gemini 3.1 for image generation...')

    const parts: unknown[] = [{ text: prompt }]
    if (photo) parts.push({ inlineData: { mimeType: photo.mime, data: photo.data } })
    if (logo) parts.push({ inlineData: { mimeType: logo.mime, data: logo.data } })

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('[BIRTHDAY] Gemini error:', geminiRes.status, errText)
      return json({ success: false, error: `Gemini ${geminiRes.status}` })
    }

    const geminiData = await geminiRes.json()

    // 6. Extract generated image
    let imageBase64: string | null = null
    let imageMime = 'image/png'

    for (const part of (geminiData.candidates?.[0]?.content?.parts || [])) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data
        imageMime = part.inlineData.mimeType || 'image/png'
        break
      }
    }

    if (!imageBase64) {
      console.error('[BIRTHDAY] No image in response')
      return json({ success: false, error: 'Gemini did not generate an image' })
    }

    console.log(`[BIRTHDAY] Image generated! MIME: ${imageMime}`)

    // 7. Upload to storage
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    const ext = imageMime.includes('png') ? 'png' : 'jpg'
    const storagePath = `birthday-posts/${brand}/${student.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(storagePath, imageBytes, { contentType: imageMime, upsert: true })

    if (uploadError) {
      return json({ success: false, error: `Upload: ${uploadError.message}` })
    }

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(storagePath)
    const finalImageUrl = urlData.publicUrl

    // 8. Log — usa asset_id como student_id para consistência com o cron
    await supabase.from('birthday_automation_log').insert({
      student_id: String(student.id),
      asset_id: student.id,
      student_name: student.person_name,
      brand,
      image_url: finalImageUrl,
      approval_status: 'pending',
      metadata: {
        method: 'gemini_3.1_festive',
        photo_used: !!photo,
        logo_used: !!logo,
        generated_at: new Date().toISOString(),
      },
    })

    console.log(`[BIRTHDAY] Success! ${finalImageUrl}`)

    return json({
      success: true,
      image_url: finalImageUrl,
      student_name: student.person_name,
      brand,
      method: 'gemini',
    })

  } catch (error) {
    console.error('[BIRTHDAY] Error:', error)
    return json({ success: false, error: String(error) })
  }
})
