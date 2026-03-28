/**
 * generate-birthday-post v7
 * Uses Gemini 2.0 Flash to generate birthday artwork
 * Sends student photo (if available) + prompt → Gemini generates beautiful birthday image
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Helper: Uint8Array to base64
function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.length
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

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
    const { asset_id, brand = 'la_music_school' } = body

    if (!asset_id) {
      return new Response(JSON.stringify({ success: false, error: 'asset_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[BIRTHDAY] Starting for asset_id=${asset_id} brand=${brand}`)

    // 1. Fetch student data
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

    const nameParts = (student.person_name || 'Aluno').split(' ')
    const firstName = nameParts[0] || 'Aluno'
    const hasRealPhoto = !!student.metadata?.has_real_photo

    console.log(`[BIRTHDAY] Student: ${student.person_name} | Photo: ${hasRealPhoto}`)

    // 2. Download student photo as base64 (if available)
    let photoBase64: string | null = null
    let photoMime = 'image/jpeg'

    if (hasRealPhoto && student.file_url) {
      try {
        console.log('[BIRTHDAY] Downloading student photo...')
        const photoRes = await fetch(student.file_url)
        if (photoRes.ok) {
          const photoBuffer = await photoRes.arrayBuffer()
          photoBase64 = toBase64(new Uint8Array(photoBuffer))
          photoMime = photoRes.headers.get('content-type') || 'image/jpeg'
          console.log(`[BIRTHDAY] Photo downloaded: ${photoBuffer.byteLength} bytes`)
        }
      } catch (e) {
        console.warn('[BIRTHDAY] Photo download failed:', e)
      }
    }

    // 3. Build Gemini prompt
    const brandName = brand === 'la_music_kids' ? 'LA Music Kids' : 'LA Music School'

    const prompt = photoBase64
      ? `Create a vibrant, professional birthday celebration Story image (portrait format, 1080x1920 pixels).

Design requirements:
- Colorful festive background with balloons, confetti, sparkles and celebration elements
- Text "Feliz Aniversário" in elegant decorative script at the top
- The person from the attached photo should be prominently featured in the CENTER, inside a stylish polaroid-style frame with a slight tilt
- The name "${firstName.toUpperCase()}" in large, bold white text below the photo
- "${brandName}" small text or logo area at the bottom
- Use vibrant colors: purples, pinks, magentas, with golden accents
- Professional quality, suitable for Instagram Stories
- Make it celebratory and joyful!`
      : `Create a vibrant, professional birthday celebration Story image (portrait format, 1080x1920 pixels).

Design requirements:
- Colorful festive background with balloons, confetti, sparkles and celebration elements
- Text "Feliz Aniversário" in elegant decorative script at the top
- A large decorative circle or frame in the CENTER with the initials "${firstName[0]}" in bold white text on a purple background
- The name "${firstName.toUpperCase()}" in large, bold white text below the circle
- "${brandName}" small text at the bottom
- Use vibrant colors: purples, pinks, magentas, with golden accents
- Professional quality, suitable for Instagram Stories
- Make it celebratory and joyful!`

    // 4. Call Gemini API
    console.log('[BIRTHDAY] Calling Gemini for image generation...')

    const geminiParts: Array<Record<string, unknown>> = [{ text: prompt }]

    if (photoBase64) {
      geminiParts.push({
        inlineData: {
          mimeType: photoMime,
          data: photoBase64,
        },
      })
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: geminiParts }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('[BIRTHDAY] Gemini error:', geminiRes.status, errText)
      throw new Error(`Gemini API error: ${geminiRes.status}`)
    }

    const geminiData = await geminiRes.json()

    // 5. Extract generated image from response
    let imageBase64: string | null = null
    let imageMime = 'image/png'

    const parts = geminiData.candidates?.[0]?.content?.parts || []
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageBase64 = part.inlineData.data
        imageMime = part.inlineData.mimeType || 'image/png'
        break
      }
    }

    if (!imageBase64) {
      console.error('[BIRTHDAY] No image in Gemini response:', JSON.stringify(geminiData).substring(0, 500))
      throw new Error('Gemini did not generate an image')
    }

    console.log(`[BIRTHDAY] Image generated! MIME: ${imageMime}`)

    // 6. Convert base64 to blob and upload to Supabase Storage
    const imageBytes = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0))
    const ext = imageMime.includes('png') ? 'png' : 'jpg'
    const storagePath = `birthday-posts/${brand}/${student.id}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(storagePath, imageBytes, {
        contentType: imageMime,
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(storagePath)
    const finalImageUrl = urlData.publicUrl

    // 7. Log to birthday_automation_log
    await supabase.from('birthday_automation_log').insert({
      student_id: student.id,
      student_name: student.person_name,
      brand: brand,
      image_url: finalImageUrl,
      approval_status: 'pending',
      metadata: {
        method: 'gemini_image_gen',
        photo_used: !!photoBase64,
        generated_at: new Date().toISOString(),
      },
    })

    console.log(`[BIRTHDAY] Success! Image URL: ${finalImageUrl}`)

    return new Response(JSON.stringify({
      success: true,
      image_url: finalImageUrl,
      student_name: student.person_name,
      brand: brand,
      method: 'gemini',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[BIRTHDAY] Error:', error)
    // Return 200 with error in body so supabase.functions.invoke passes it through
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
