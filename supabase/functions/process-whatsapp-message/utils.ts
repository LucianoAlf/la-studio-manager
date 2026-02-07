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

    // Extrair texto — UAZAPI coloca em msg.text ou msg.content
    let text: string | null = msg?.text || msg?.content || null
    let type: string = msg?.type || 'text'
    let mediaUrl: string | null = msg?.mediaUrl || null

    // Normalizar messageType da UAZAPI para nossos tipos
    const uazapiType = (msg?.messageType || '').toLowerCase()
    if (uazapiType === 'conversation' || uazapiType === 'extendedtextmessage') {
      type = 'text'
    } else if (uazapiType === 'imagemessage') {
      type = 'image'
    } else if (uazapiType === 'audiomessage' || uazapiType === 'pttmessage') {
      type = 'audio'
    } else if (uazapiType === 'videomessage') {
      type = 'video'
    } else if (uazapiType === 'documentmessage') {
      type = 'document'
    } else if (uazapiType === 'stickermessage') {
      type = 'sticker'
      text = text || '[sticker]'
    } else if (uazapiType === 'locationmessage') {
      type = 'location'
      text = text || '[location]'
    }

    console.log(`[WA] Parsed: type=${type}, text=${text?.substring(0, 50)}, mediaUrl=${mediaUrl}`)

    // Se não conseguiu extrair nada útil, ignorar
    if (!text && !mediaUrl && type === 'text') {
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
