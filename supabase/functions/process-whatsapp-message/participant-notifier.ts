// =============================================================================
// PARTICIPANT-NOTIFIER.TS — Notifica participantes de eventos via WhatsApp
// LA Studio Manager — WA-06.6
// =============================================================================
//
// Fluxo:
// 1. Evento criado com participante(s) → buscar no user_profiles por nome
// 2. Se encontrou + tem phone via whatsapp_connections → enviar mensagem via UAZAPI
// 3. Salvar contexto de confirmação pendente para o participante
// 4. Quando participante responde → notificar o criador
//
// Campos reais do banco:
// - user_profiles: id, full_name, display_name, phone
// - whatsapp_connections: user_id, phone_number (sem +), is_active
// - whatsapp_conversation_context: user_id, context_type, context_data, is_active
// =============================================================================

import { sendTextMessage } from './send-message.ts'

// =============================================================================
// TIPOS
// =============================================================================

export interface NotificationResult {
  participantName: string
  found: boolean
  phoneNumber: string | null
  notified: boolean
  error?: string
}

export interface PendingEventConfirmation {
  type: 'event_confirmation'
  eventId: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  eventLocation: string | null
  creatorUserId: string
  creatorName: string
  creatorPhone: string
  participantUserId: string
  participantName: string
  sentAt: string
}

// =============================================================================
// BUSCAR PARTICIPANTE POR NOME
// =============================================================================

/**
 * Busca um participante na tabela user_profiles pelo nome (case-insensitive).
 * Busca em full_name e display_name.
 * Retorna null se não encontrar ou se não tiver whatsapp_connections ativa.
 */
export async function findParticipantByName(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  name: string
): Promise<{ id: string; displayName: string; phoneNumber: string } | null> {

  if (!name || name.trim().length < 2) return null

  const searchName = name.trim()

  // Buscar por full_name ou display_name (case-insensitive)
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, display_name')
    .or(`full_name.ilike.%${searchName}%,display_name.ilike.%${searchName}%`)
    .is('deleted_at', null)
    .limit(5)

  if (error) {
    console.error('[NOTIFY] Erro ao buscar participante:', error)
    return null
  }

  if (!data || data.length === 0) {
    console.log(`[NOTIFY] Participante "${searchName}" não encontrado em user_profiles`)
    return null
  }

  // Preferir match exato em display_name, depois full_name
  const exactDisplay = data.find(
    (u: { display_name: string | null }) => u.display_name?.toLowerCase() === searchName.toLowerCase()
  )
  const exactFull = data.find(
    (u: { full_name: string }) => u.full_name.toLowerCase() === searchName.toLowerCase()
  )
  const startsWith = data.find(
    (u: { full_name: string; display_name: string | null }) =>
      u.full_name.toLowerCase().startsWith(searchName.toLowerCase()) ||
      u.display_name?.toLowerCase().startsWith(searchName.toLowerCase())
  )
  const best = exactDisplay || exactFull || startsWith || data[0]

  // Buscar whatsapp_connections para obter phone_number
  const { data: connection, error: connError } = await supabase
    .from('whatsapp_connections')
    .select('phone_number')
    .eq('user_id', best.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (connError || !connection?.phone_number) {
    console.log(`[NOTIFY] Participante "${best.display_name || best.full_name}" encontrado mas sem WhatsApp ativo`)
    return null
  }

  const displayName = best.display_name || best.full_name
  console.log(`[NOTIFY] Participante encontrado: ${displayName} (${connection.phone_number})`)

  return {
    id: best.id,
    displayName,
    phoneNumber: connection.phone_number,
  }
}

// =============================================================================
// NOTIFICAR PARTICIPANTES
// =============================================================================

/**
 * Envia notificação de evento para participantes via WhatsApp.
 * Salva contexto de confirmação pendente para cada participante notificado.
 */
export async function notifyParticipants(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  serverUrl: string,
  token: string,
  params: {
    eventId: string
    eventTitle: string
    eventDate: string
    eventTime: string | null
    eventLocation: string | null
    creatorUserId: string
    creatorName: string
    creatorPhone: string
    participantNames: string[]
  }
): Promise<NotificationResult[]> {

  const results: NotificationResult[] = []

  for (const name of params.participantNames) {
    const participant = await findParticipantByName(supabase, name)

    if (!participant) {
      results.push({
        participantName: name,
        found: false,
        phoneNumber: null,
        notified: false,
        error: 'Não encontrado no sistema',
      })
      continue
    }

    // Não notificar o próprio criador
    if (participant.id === params.creatorUserId) {
      console.log(`[NOTIFY] ${name} é o próprio criador, pulando notificação`)
      continue
    }

    // Montar mensagem de notificação
    const message = buildNotificationMessage({
      participantName: participant.displayName,
      creatorName: params.creatorName,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      eventTime: params.eventTime,
      eventLocation: params.eventLocation,
    })

    // Enviar via UAZAPI
    const sendResult = await sendTextMessage({
      serverUrl,
      token,
      to: participant.phoneNumber,
      text: message,
    })

    if (!sendResult.success) {
      console.error(`[NOTIFY] Falha ao enviar para ${participant.displayName}:`, sendResult.error)
      results.push({
        participantName: participant.displayName,
        found: true,
        phoneNumber: participant.phoneNumber,
        notified: false,
        error: sendResult.error,
      })
      continue
    }

    console.log(`[NOTIFY] ✅ Notificação enviada para ${participant.displayName} (${participant.phoneNumber})`)

    // Salvar contexto de confirmação pendente PARA O PARTICIPANTE
    const pendingConfirmation: PendingEventConfirmation = {
      type: 'event_confirmation',
      eventId: params.eventId,
      eventTitle: params.eventTitle,
      eventDate: params.eventDate,
      eventTime: params.eventTime,
      eventLocation: params.eventLocation,
      creatorUserId: params.creatorUserId,
      creatorName: params.creatorName,
      creatorPhone: params.creatorPhone,
      participantUserId: participant.id,
      participantName: participant.displayName,
      sentAt: new Date().toISOString(),
    }

    await saveEventConfirmationContext(supabase, participant.id, pendingConfirmation)

    results.push({
      participantName: participant.displayName,
      found: true,
      phoneNumber: participant.phoneNumber,
      notified: true,
    })
  }

  return results
}

// =============================================================================
// CONTEXTO DE CONFIRMAÇÃO DO PARTICIPANTE
// =============================================================================

/**
 * Salva contexto de confirmação pendente para o participante.
 * Usa whatsapp_conversation_context com context_type='event_confirmation'.
 */
async function saveEventConfirmationContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  participantUserId: string,
  confirmation: PendingEventConfirmation
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: participantUserId,
      context_type: 'event_confirmation',
      context_data: confirmation,
      is_active: true,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,context_type'
    })

  if (error) {
    console.error('[NOTIFY] Erro ao salvar contexto de confirmação:', error)
  } else {
    console.log(`[NOTIFY] Contexto event_confirmation salvo para ${participantUserId}`)
  }
}

/**
 * Busca contexto de confirmação de evento pendente para um usuário.
 * Chamado quando o participante responde uma mensagem.
 */
export async function getEventConfirmation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<PendingEventConfirmation | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data, updated_at')
    .eq('user_id', userId)
    .eq('context_type', 'event_confirmation')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  // Expirar após 24 horas
  const updatedAt = new Date(data.updated_at)
  const diffHours = (Date.now() - updatedAt.getTime()) / 1000 / 60 / 60

  if (diffHours > 24) {
    await clearEventConfirmation(supabase, userId)
    return null
  }

  return data.context_data as PendingEventConfirmation
}

/**
 * Limpa contexto de confirmação do PARTICIPANTE (quem está respondendo).
 */
export async function clearEventConfirmation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  participantUserId: string
): Promise<void> {
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', participantUserId)
    .eq('context_type', 'event_confirmation')
}

// =============================================================================
// PROCESSAR RESPOSTA DO PARTICIPANTE
// =============================================================================

/**
 * Processa a resposta do participante (sim/não) e notifica o criador.
 * Retorna mensagem para o participante.
 */
export async function processParticipantResponse(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  serverUrl: string,
  token: string,
  confirmation: PendingEventConfirmation,
  response: string
): Promise<string> {

  const normalized = response.trim().toLowerCase().replace(/[.,!?;:]+$/g, '').trim()

  // Detectar se é confirmação ou recusa
  const confirmWords = ['sim', 'yes', 's', 'ok', 'confirmo', 'beleza', 'bora', 'pode ser', 'claro', 'vou', 'vou sim', 'tamo junto', 'pode']
  const declineWords = ['não', 'nao', 'no', 'n', 'não posso', 'nao posso', 'cancelar', 'não vou', 'nao vou', 'não dá', 'nao da', 'não vai dar', 'nao vai dar']

  const isConfirm = confirmWords.includes(normalized)
  const isDecline = declineWords.includes(normalized)

  if (!isConfirm && !isDecline) {
    // Resposta ambígua — pedir esclarecimento
    const dateInfo = formatDateShort(confirmation.eventDate)
    const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
    return `Sobre a *${confirmation.eventTitle}* de ${dateInfo}${timeInfo} — você confirma presença? (sim/não)`
  }

  // Limpar contexto do PARTICIPANTE
  await clearEventConfirmation(supabase, confirmation.participantUserId)

  if (isConfirm) {
    // Notificar o criador
    const dateInfo = formatDateShort(confirmation.eventDate)
    const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
    const creatorMessage = `${confirmation.participantName} confirmou presença na *${confirmation.eventTitle}* de ${dateInfo}${timeInfo} ✅`

    await sendTextMessage({
      serverUrl,
      token,
      to: confirmation.creatorPhone,
      text: creatorMessage,
    })

    console.log(`[NOTIFY] ✅ ${confirmation.participantName} CONFIRMOU → notificado ${confirmation.creatorName}`)

    return `Presença confirmada! Até lá 👍`
  }

  // isDecline
  const dateInfo = formatDateShort(confirmation.eventDate)
  const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
  const creatorMessage = `${confirmation.participantName} recusou a *${confirmation.eventTitle}* de ${dateInfo}${timeInfo}. Quer manter o evento mesmo assim?`

  await sendTextMessage({
    serverUrl,
    token,
    to: confirmation.creatorPhone,
    text: creatorMessage,
  })

  console.log(`[NOTIFY] ❌ ${confirmation.participantName} RECUSOU → notificado ${confirmation.creatorName}`)

  return `Entendido, avisei o ${confirmation.creatorName}.`
}

// =============================================================================
// MENSAGENS
// =============================================================================

function buildNotificationMessage(params: {
  participantName: string
  creatorName: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  eventLocation: string | null
}): string {
  let msg = `Fala ${params.participantName}! ${params.creatorName} agendou:`
  msg += `\n\n📝 *${params.eventTitle}*`
  msg += `\n📅 ${formatDateShort(params.eventDate)}`
  if (params.eventTime) msg += ` às ${params.eventTime}`
  if (params.eventLocation) msg += `\n📍 ${params.eventLocation}`
  msg += `\n\nConfirma presença? (sim/não)`

  return msg
}

/**
 * Formata data para exibição curta: "8/fev", "15/mar"
 */
function formatDateShort(dateStr: string): string {
  if (!dateStr) return dateStr
  try {
    // Se já é uma data relativa como "amanhã", retornar como está
    if (/^(hoje|amanhã|amanha|segunda|terça|quarta|quinta|sexta|sábado|domingo)/i.test(dateStr)) {
      return dateStr
    }
    const date = new Date(dateStr + 'T12:00:00')
    if (isNaN(date.getTime())) return dateStr
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    return `${date.getDate()}/${months[date.getMonth()]}`
  } catch {
    return dateStr
  }
}

// =============================================================================
// EXTRAIR NOMES DE PARTICIPANTES DO TEXTO
// =============================================================================

/**
 * Extrai nomes de participantes da string de entidades.
 * O NLP/Gemini retorna participants como string: "John", "John e Maria", "John, Maria"
 * Normaliza para um array de nomes.
 */
export function parseParticipantNames(participantsStr: string | null | undefined): string[] {
  if (!participantsStr) return []

  return participantsStr
    .split(/[,&]|\be\b/)           // Separar por vírgula, "&", ou " e "
    .map(name => name.trim())
    .filter(name => name.length >= 2)
    .map(name => name.charAt(0).toUpperCase() + name.slice(1))
}
