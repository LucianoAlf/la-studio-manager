// ============================================
// Utils — Parse, normalize, format
// ============================================

import type { ParsedMessage } from './types.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Normaliza número de telefone para formato consistente
 * Remove @s.whatsapp.net, @g.us, espaços, hífens
 * Resultado: apenas números, ex: "5521989784688"
 */
export function normalizePhoneNumber(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/@s\.whatsapp\.net/g, '')
    .replace(/@g\.us/g, '')
    .replace(/@lid/g, '')
    .replace(/[\s\-\(\)\+]/g, '')
    .trim()
}

/**
 * Parse webhook payload da UAZAPI
 * A UAZAPI envia no formato WebhookEvent: { event, instance, data }
 * O campo data contém a mensagem no formato Baileys (key, message, etc)
 * Esta função normaliza para ParsedMessage
 */
export function parseWebhookPayload(body: unknown): ParsedMessage | null {
  try {
    // deno-lint-ignore no-explicit-any
    const payload = body as any

    console.log(`[WA] Payload keys: ${Object.keys(payload || {}).join(', ')}`)

    // UAZAPI envia EventType no root do payload
    const event = payload?.EventType || payload?.event || payload?.type
    console.log(`[WA] Event type: ${event}`)

    // Ignorar eventos que não são mensagens
    if (event && !['message', 'messages'].includes(event)) {
      console.log(`[WA] Skipping non-message event: ${event}`)
      return null
    }

    // =============================================
    // FORMATO REAL DA UAZAPI (flat, não Baileys):
    // payload.message = {
    //   id, text, content, type, chatid, fromMe,
    //   sender, sender_pn, senderName, messageid,
    //   messageType, messageTimestamp, isGroup, ...
    // }
    // payload.chat = { wa_chatid, wa_name, phone, ... }
    // =============================================
    const msg = payload?.message || {}
    console.log(`[WA] msg keys: ${Object.keys(msg).join(', ')}`)

    // Ignorar mensagens enviadas pela própria API
    if (msg?.fromMe === true || msg?.wasSentByApi === true) {
      console.log('[WA] Skipping fromMe/wasSentByApi message')
      return null
    }

    // Extrair chatid (remoteJid equivalente)
    const chatid = msg?.chatid || msg?.sender_pn || payload?.chat?.wa_chatid || ''
    const isGroup = msg?.isGroup === true || chatid.includes('@g.us')
    console.log(`[WA] chatid: ${chatid}, isGroup: ${isGroup}`)

    // =============================================
    // EXTRAIR TEXTO E METADADOS DE MÍDIA
    // UAZAPI: msg.content pode ser:
    //   - STRING JSON (mídia): '{"URL":"...","mimetype":"audio/ogg","PTT":true,"seconds":12}'
    //   - STRING simples (texto em alguns casos)
    //   - OBJETO (já parseado em alguns webhooks)
    // =============================================
    const rawContent = msg?.content
    let parsedContent: Record<string, unknown> | null = null

    // Tentar parsear content como JSON string (caso mais comum para mídia)
    if (typeof rawContent === 'string' && rawContent.startsWith('{')) {
      try {
        parsedContent = JSON.parse(rawContent)
      } catch {
        // Não é JSON válido — tratar como texto
      }
    } else if (rawContent && typeof rawContent === 'object') {
      // Já é objeto (alguns webhooks enviam assim)
      parsedContent = rawContent as Record<string, unknown>
    }

    // Texto: msg.text é a fonte principal (legenda para imagem, vazio para áudio)
    let text: string | null = msg?.text || null
    // Se não tem msg.text e content não é JSON de mídia, usar content como texto
    if (!text && typeof rawContent === 'string' && !parsedContent) {
      text = rawContent
    }

    let type: string = msg?.type || 'text'
    let mediaUrl: string | null = msg?.mediaUrl || msg?.fileURL || null
    let durationSeconds: number | null = null

    // Se content é mídia (JSON parseado), extrair metadados
    if (parsedContent) {
      mediaUrl = mediaUrl || (parsedContent.URL as string) || null
      durationSeconds = (parsedContent.seconds as number) || null
      // Caption da imagem (redundante com msg.text, mas fallback)
      if (!text && parsedContent.caption) {
        text = parsedContent.caption as string
      }
    }

    // =============================================
    // NORMALIZAR messageType DA UAZAPI
    // Payload real: messageType vem lowercase ("audio", "image", "video")
    // Alguns webhooks enviam PascalCase ("AudioMessage", "ImageMessage")
    // Tratar ambos os formatos
    // =============================================
    const uazapiType = (msg?.messageType || '').toLowerCase()
    const uazapiMediaType = (msg?.mediaType || '').toLowerCase()

    if (uazapiType === 'conversation' || uazapiType === 'extendedtextmessage') {
      type = 'text'
    } else if (uazapiType === 'image' || uazapiType === 'imagemessage') {
      type = 'image'
    } else if (uazapiType === 'audio' || uazapiType === 'audiomessage' || uazapiType === 'pttmessage' || uazapiMediaType === 'ptt') {
      type = 'audio'
    } else if (uazapiType === 'video' || uazapiType === 'videomessage') {
      type = 'video'
    } else if (uazapiType === 'document' || uazapiType === 'documentmessage') {
      type = 'document'
    } else if (uazapiType === 'sticker' || uazapiType === 'stickermessage') {
      type = 'sticker'
      text = text || '[sticker]'
    } else if (uazapiType === 'location' || uazapiType === 'locationmessage') {
      type = 'location'
      text = text || '[location]'
    }

    console.log(`[WA] Parsed: type=${type}, messageType=${uazapiType}, mediaType=${uazapiMediaType}, text=${text?.substring(0, 50) || '(vazio)'}, mediaUrl=${mediaUrl ? 'yes' : 'no'}, duration=${durationSeconds}`)

    // Se não conseguiu extrair nada útil, ignorar
    // Para mídia (audio/image/video/document), não exigir texto
    const isMediaType = ['audio', 'image', 'video', 'document', 'sticker'].includes(type)
    if (!text && !mediaUrl && !isMediaType) {
      console.log('[WA] No text or media found, ignoring')
      return null
    }

    // Extrair remetente — sender_pn tem o número real do remetente
    const senderPn = msg?.sender_pn || msg?.sender || ''
    const from = isGroup
      ? normalizePhoneNumber(senderPn)
      : normalizePhoneNumber(chatid)

    console.log(`[WA] From: ${from}, senderName: ${msg?.senderName}`)

    return {
      from,
      text,
      type,
      mediaUrl,
      messageId: msg?.messageid || msg?.id || null,
      isGroup,
      groupJid: isGroup ? chatid : null,
      senderInGroup: isGroup ? senderPn : null,
      timestamp: msg?.messageTimestamp ? Math.floor(msg.messageTimestamp / 1000) : Math.floor(Date.now() / 1000),
      pushName: msg?.senderName || payload?.chat?.wa_name || null,
      durationSeconds,
    }
  } catch (error) {
    console.error('[WA] Parse error:', error)
    return null
  }
}

/**
 * Formata data para exibição em português
 */
export function formatDatePtBr(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }
  return d.toLocaleDateString('pt-BR', options)
}

/**
 * Formata data curta (dd/mm)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit',
    timeZone: 'America/Sao_Paulo' 
  })
}

/**
 * Formata dia da semana
 */
export function formatWeekday(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  return days[d.getDay()]
}
