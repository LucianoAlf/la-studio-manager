// ============================================
// LA Studio Manager — process-whatsapp-message
// Edge Function v2.0 — NLP + Intent Classification (WA-02)
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseWebhookPayload, normalizePhoneNumber, corsHeaders } from './utils.ts'
import { routeMessage } from './message-router.ts'
import { sendTextMessage } from './send-message.ts'
import type { UserInfo } from './types.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL')!
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')!

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log('[WA] Webhook received:', JSON.stringify(body).substring(0, 500))

    // 1. Parse webhook payload
    // Criar cliente Supabase antes do parse para poder salvar debug
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const parsed = parseWebhookPayload(body)
    if (!parsed) {
      console.log('[WA] Ignored: not a processable message')
      // Salvar payload raw para debug (mesmo quando ignorado)
      await supabase.from('whatsapp_messages').insert({
        phone_number: 'debug',
        direction: 'inbound',
        message_type: 'text',
        content: '[DEBUG] Parser returned null - payload saved in raw_webhook',
        processing_status: 'ignored',
        is_group_message: false,
        raw_webhook: body,
        metadata: { debug: true, keys: Object.keys(body || {}) },
      })
      return new Response(JSON.stringify({ success: true, status: 'ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Identificar usuário pelo telefone
    const phone = normalizePhoneNumber(parsed.from)
    const { data: userResult } = await supabase
      .rpc('get_user_by_phone', { p_phone: phone })
    
    const user: UserInfo | null = userResult?.[0] || null
    
    if (!user) {
      console.log(`[WA] Unknown phone: ${phone}`)
      // Número não cadastrado — salvar e ignorar (não responde)
      await supabase.from('whatsapp_messages').insert({
        phone_number: phone,
        direction: 'inbound',
        message_type: parsed.type,
        content: parsed.text || `[${parsed.type}]`,
        media_url: parsed.mediaUrl || null,
        processing_status: 'ignored',
        is_group_message: parsed.isGroup,
        group_jid: parsed.groupJid || null,
        uazapi_message_id: parsed.messageId,
        raw_webhook: body,
      })
      return new Response(JSON.stringify({ success: true, status: 'unknown_user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Salvar mensagem no banco (status: pending)
    // user_id aqui é profile_id (PK de user_profiles)
    const { data: savedMessage, error: saveError } = await supabase
      .from('whatsapp_messages')
      .insert({
        user_id: user.profile_id,
        phone_number: phone,
        direction: 'inbound',
        message_type: parsed.type,
        content: parsed.text || `[${parsed.type}]`,
        media_url: parsed.mediaUrl || null,
        processing_status: 'pending',
        is_group_message: parsed.isGroup,
        group_jid: parsed.groupJid || null,
        uazapi_message_id: parsed.messageId,
        raw_webhook: body,
      })
      .select()
      .single()

    if (saveError) {
      console.error('[WA] Error saving message:', saveError)
      throw saveError
    }

    console.log(`[WA] Message saved: ${savedMessage.id} from ${user.full_name} (${phone}) [profile: ${user.profile_id}, auth: ${user.auth_user_id}]`)

    // 5. Processar mensagem
    const processPromise = (async () => {
      try {
        // Atualizar status para processing
        await supabase
          .from('whatsapp_messages')
          .update({ processing_status: 'processing' })
          .eq('id', savedMessage.id)

        // Rotear mensagem para handler correto
        const response = await routeMessage({
          supabase,
          user,
          message: savedMessage,
          parsed,
          uazapiUrl: UAZAPI_SERVER_URL,
          uazapiToken: UAZAPI_TOKEN,
        })

        // Enviar resposta via WhatsApp
        if (response.text) {
          const sendResult = await sendTextMessage({
            serverUrl: UAZAPI_SERVER_URL,
            token: UAZAPI_TOKEN,
            to: parsed.isGroup ? parsed.groupJid! : phone,
            text: response.text,
          })

          // Salvar mensagem de resposta (com messageId da UAZAPI)
          await supabase.from('whatsapp_messages').insert({
            user_id: user.profile_id,
            phone_number: phone,
            direction: 'outbound',
            message_type: 'text',
            content: response.text,
            processing_status: 'completed',
            is_group_message: parsed.isGroup,
            group_jid: parsed.groupJid || null,
            uazapi_message_id: sendResult.messageId || null,
            response_sent_at: new Date().toISOString(),
          })
        }

        // Atualizar mensagem original como completed
        await supabase
          .from('whatsapp_messages')
          .update({
            processing_status: 'completed',
            intent_detected: response.intent || null,
            intent_confidence: response.confidence || null,
            response_text: response.text || null,
            response_sent_at: new Date().toISOString(),
          })
          .eq('id', savedMessage.id)

        console.log(`[WA] Message processed: ${savedMessage.id} | Intent: ${response.intent}`)
      } catch (processError) {
        console.error('[WA] Processing error:', processError)
        await supabase
          .from('whatsapp_messages')
          .update({ 
            processing_status: 'failed',
            metadata: { error: String(processError) }
          })
          .eq('id', savedMessage.id)
      }
    })()

    // Aguardar processamento (síncrono)
    // Para WA-01 (echo) isso é rápido (<1s)
    // Para WA-02+ com Gemini, considerar fila assíncrona se necessário
    await processPromise

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: savedMessage.id, 
        status: 'completed' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[WA] Fatal error:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
