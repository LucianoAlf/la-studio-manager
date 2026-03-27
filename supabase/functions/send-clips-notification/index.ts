/**
 * send-clips-notification
 * Envia notificação WhatsApp para Yuri sobre clips prontos
 * Uso único para teste - pode ser removido depois
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL')
    const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')
    const YURI_PHONE = Deno.env.get('YURI_PHONE')

    if (!UAZAPI_SERVER_URL || !UAZAPI_TOKEN || !YURI_PHONE) {
      return new Response(JSON.stringify({
        error: 'Missing env vars',
        has_url: !!UAZAPI_SERVER_URL,
        has_token: !!UAZAPI_TOKEN,
        has_phone: !!YURI_PHONE
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Nova mensagem simplificada (fluxo conversacional)
    const msg =
      `🎬 *10 clipes prontos* de "LA Session"\n\n` +
      `Melhor: "Quanto maior o músico, menos toca" (94)\n` +
      `📍 Conta: @lamusicschool\n\n` +
      `Manda *VER* pra escolher.`

    const sendRes = await fetch(`${UAZAPI_SERVER_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
      body: JSON.stringify({ number: YURI_PHONE, text: msg, delay: 500 })
    })

    const sendData = await sendRes.json()
    console.log('[NOTIFY] WhatsApp send result:', sendData)

    return new Response(JSON.stringify({
      success: sendRes.ok,
      message: 'Notification sent to Yuri',
      response: sendData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[NOTIFY] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
