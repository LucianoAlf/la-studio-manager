/**
 * test-whatsapp v1
 * Envia mensagem de teste via UAZAPI para verificar integração
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
        error: 'Missing secrets',
        has_server: !!UAZAPI_SERVER_URL,
        has_token: !!UAZAPI_TOKEN,
        has_phone: !!YURI_PHONE,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const msg = `🧪 *Teste de integração WhatsApp*\n\n` +
      `Studio Manager está configurado corretamente!\n` +
      `Você receberá notificações quando clipes estiverem prontos para aprovação.\n\n` +
      `_Enviado em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}_`

    console.log(`[TEST] Sending test message to ${YURI_PHONE}...`)

    const response = await fetch(`${UAZAPI_SERVER_URL}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number: YURI_PHONE,
        text: msg,
        delay: 500,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[TEST] UAZAPI error:', data)
      return new Response(JSON.stringify({
        success: false,
        error: data
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[TEST] Message sent successfully:', data)

    return new Response(JSON.stringify({
      success: true,
      message: 'Test message sent to Yuri',
      uazapi_response: data,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[TEST] Error:', error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
