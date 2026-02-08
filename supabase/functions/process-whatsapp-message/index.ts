// ============================================
// LA Studio Manager — process-whatsapp-message
// Edge Function v3.0 — WA-06.7: Mike no Grupo + Memória
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseWebhookPayload, normalizePhoneNumber, corsHeaders } from './utils.ts'
import { routeMessage } from './message-router.ts'
import { sendTextMessage } from './send-message.ts'
import { isGroupEnabled, containsMikeName, BOT_PHONE_NUMBER } from './group-config.ts'
import { handleGroupMessage } from './group-handler.ts'
import { saveGroupMessage, saveMikeResponse, getGroupContextSummary } from './group-memory.ts'
import { transcribeAudio } from './audio-handler.ts'
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

    // =============================================
    // WA-06.7: BLOCO DE GRUPO — ANTES DO FLUXO DM
    // =============================================
    if (parsed.isGroup && parsed.groupJid) {
      const groupJid = parsed.groupJid
      const senderPhone = normalizePhoneNumber(parsed.senderInGroup || parsed.from)
      const senderName = parsed.pushName || senderPhone

      // Ignorar mensagens do próprio bot
      if (senderPhone === BOT_PHONE_NUMBER) {
        console.log('[GROUP] Ignorando mensagem do próprio bot')
        return new Response(JSON.stringify({ success: true, status: 'bot_self_message' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Grupo não habilitado → ignorar silenciosamente
      if (!isGroupEnabled(groupJid)) {
        console.log(`[GROUP] Grupo não habilitado: ${groupJid}`)
        return new Response(JSON.stringify({ success: true, status: 'group_not_enabled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      console.log(`[GROUP] Mensagem de ${senderName} (${senderPhone}) no grupo ${groupJid}`)

      // --- PASSO 1: Processar mídia para memória ---
      let groupText = parsed.text || ''
      const isAudio = parsed.type === 'audio'
      const isImage = parsed.type === 'image'

      // Áudio: SEMPRE transcrever em grupos habilitados (para memória + detecção de nome)
      if (isAudio && parsed.messageId) {
        console.log('[GROUP] Transcrevendo áudio para memória...')
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || ''
        const audioResult = await transcribeAudio({
          serverUrl: UAZAPI_SERVER_URL,
          token: UAZAPI_TOKEN,
          messageId: parsed.messageId,
          openaiApiKey,
          durationSeconds: parsed.durationSeconds,
        })
        if (audioResult.success && audioResult.transcription) {
          groupText = audioResult.transcription
          console.log(`[GROUP] Áudio transcrito: "${groupText.substring(0, 80)}..."`)
        } else {
          groupText = '[Áudio não transcrito]'
          console.log('[GROUP] Falha na transcrição do áudio')
        }
      }

      // Imagem: salvar caption na memória (sem analisar Vision — economia)
      if (isImage) {
        groupText = parsed.text || '[Imagem enviada]'
      }

      // Sticker, vídeo, documento, location — salvar tipo na memória
      if (['sticker', 'video', 'document', 'location'].includes(parsed.type)) {
        groupText = groupText || `[${parsed.type}]`
      }

      // --- PASSO 2: SALVAR NA MEMÓRIA (SEMPRE, mesmo em silêncio) ---
      await saveGroupMessage(supabase, {
        groupJid,
        senderPhone,
        senderName,
        messageText: groupText,
        messageType: isAudio ? 'audio' : isImage ? 'image' : parsed.type,
        mediaCaption: isImage ? (parsed.text || null) : null,
        messageId: parsed.messageId,
        messageTimestamp: parsed.timestamp
          ? new Date(parsed.timestamp * 1000).toISOString()
          : undefined,
      })

      // --- PASSO 3: Resolver usuário ---
      const { data: userResult } = await supabase
        .rpc('get_user_by_phone', { p_phone: senderPhone })
      const user: UserInfo | null = userResult?.[0] || null
      const userId = user?.profile_id || null

      // Salvar mensagem inbound no banco (mesmo que não responda)
      const { data: savedMessage } = await supabase
        .from('whatsapp_messages')
        .insert({
          user_id: userId,
          phone_number: senderPhone,
          direction: 'inbound',
          message_type: parsed.type,
          content: groupText || `[${parsed.type}]`,
          media_url: parsed.mediaUrl || null,
          processing_status: 'pending',
          is_group_message: true,
          group_jid: groupJid,
          uazapi_message_id: parsed.messageId,
          raw_webhook: body,
        })
        .select()
        .single()

      // --- PASSO 4: Decidir se responde (group-handler) ---
      const groupResult = await handleGroupMessage(
        supabase, groupText, groupJid, senderPhone, senderName, userId
      )

      if (!groupResult.shouldRespond) {
        // SILÊNCIO — mensagem já foi salva na memória e no banco
        if (savedMessage) {
          await supabase.from('whatsapp_messages')
            .update({ processing_status: 'ignored', intent_detected: 'group_silent' })
            .eq('id', savedMessage.id)
        }
        console.log(`[GROUP] Silêncio para ${senderName}`)
        return new Response(JSON.stringify({ success: true, status: 'group_silent' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // --- PASSO 5a: Resposta direta (saudação, dispensa, não cadastrado) ---
      if (groupResult.responseText) {
        await sendTextMessage({
          serverUrl: UAZAPI_SERVER_URL,
          token: UAZAPI_TOKEN,
          to: groupJid,
          text: groupResult.responseText,
        })
        // Salvar resposta do Mike na memória
        await saveMikeResponse(supabase, { groupJid, responseText: groupResult.responseText })
        // Salvar outbound no banco
        await supabase.from('whatsapp_messages').insert({
          user_id: userId,
          phone_number: senderPhone,
          direction: 'outbound',
          message_type: 'text',
          content: groupResult.responseText,
          processing_status: 'completed',
          is_group_message: true,
          group_jid: groupJid,
          response_sent_at: new Date().toISOString(),
        })
        if (savedMessage) {
          await supabase.from('whatsapp_messages')
            .update({
              processing_status: 'completed',
              intent_detected: 'group_direct_response',
              response_text: groupResult.responseText,
              response_sent_at: new Date().toISOString(),
            })
            .eq('id', savedMessage.id)
        }
        console.log(`[GROUP] Resposta direta para ${senderName}`)
        return new Response(JSON.stringify({ success: true, status: 'group_direct_response' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // --- PASSO 5b: Processar com NLP + contexto do grupo ---
      if (groupResult.processedText && user && savedMessage) {
        // Buscar contexto da conversa recente
        const groupContext = await getGroupContextSummary(supabase, groupJid)

        // Atualizar parsed com texto limpo (nome do Mike removido)
        const groupParsed = {
          ...parsed,
          text: groupResult.processedText,
          // Se era áudio, agora é texto transcrito
          type: isAudio ? 'text' : parsed.type,
        }

        try {
          await supabase.from('whatsapp_messages')
            .update({ processing_status: 'processing' })
            .eq('id', savedMessage.id)

          // Rotear mensagem com contexto do grupo
          const response = await routeMessage({
            supabase,
            user,
            message: savedMessage,
            parsed: groupParsed,
            uazapiUrl: UAZAPI_SERVER_URL,
            uazapiToken: UAZAPI_TOKEN,
            groupContext,
          })

          // Enviar resposta pro grupo
          if (response.text) {
            const sendResult = await sendTextMessage({
              serverUrl: UAZAPI_SERVER_URL,
              token: UAZAPI_TOKEN,
              to: groupJid,
              text: response.text,
            })
            // Salvar resposta do Mike na memória
            await saveMikeResponse(supabase, { groupJid, responseText: response.text })
            // Salvar outbound no banco
            await supabase.from('whatsapp_messages').insert({
              user_id: user.profile_id,
              phone_number: senderPhone,
              direction: 'outbound',
              message_type: 'text',
              content: response.text,
              processing_status: 'completed',
              is_group_message: true,
              group_jid: groupJid,
              uazapi_message_id: sendResult.messageId || null,
              response_sent_at: new Date().toISOString(),
            })
          }

          // Atualizar mensagem original
          await supabase.from('whatsapp_messages')
            .update({
              processing_status: 'completed',
              intent_detected: response.intent || null,
              intent_confidence: response.confidence || null,
              response_text: response.text || null,
              response_sent_at: new Date().toISOString(),
            })
            .eq('id', savedMessage.id)

          console.log(`[GROUP] Processado: ${savedMessage.id} | Intent: ${response.intent}`)
        } catch (processError) {
          console.error('[GROUP] Processing error:', processError)
          await supabase.from('whatsapp_messages')
            .update({ processing_status: 'failed', metadata: { error: String(processError) } })
            .eq('id', savedMessage.id)
        }

        return new Response(JSON.stringify({ success: true, status: 'group_processed', message_id: savedMessage.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fallback — não deveria chegar aqui
      return new Response(JSON.stringify({ success: true, status: 'group_no_action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // =============================================
    // FLUXO DM (mensagem direta — código original)
    // =============================================

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

    // 5. Processar mensagem (DM)
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
            to: phone,
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
            is_group_message: false,
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
