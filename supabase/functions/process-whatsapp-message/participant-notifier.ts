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
  groupJid?: string | null  // WA-06.8: Grupo de origem (se evento criado no grupo)
}

// =============================================================================
// BUSCAR PARTICIPANTE POR NOME
// =============================================================================

/**
 * Busca participante na tabela contacts (tabela mestre de pessoas).
 * contacts contém tanto usuários do sistema (contact_type='user', user_profile_id preenchido)
 * quanto contatos externos (alunos, fornecedores, etc.).
 * Retorna id do contato, nome, telefone e se é usuário do sistema.
 */
export async function findParticipantByName(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  name: string
): Promise<{ id: string; displayName: string; phoneNumber: string; isSystemUser: boolean; userProfileId: string | null } | null> {

  if (!name || name.trim().length < 2) return null

  const searchName = name.trim()

  // Buscar na tabela contacts (tabela mestre)
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, phone, contact_type, user_profile_id')
    .ilike('name', `%${searchName}%`)
    .is('deleted_at', null)
    .limit(10)

  if (error) {
    console.error('[NOTIFY] Erro ao buscar participante em contacts:', error)
    return null
  }

  if (!data || data.length === 0) {
    console.log(`[NOTIFY] Participante "${searchName}" não encontrado em contacts`)
    return null
  }

  // Preferir match exato, depois startsWith, depois qualquer
  const exact = data.find(
    (c: { name: string }) => c.name.toLowerCase() === searchName.toLowerCase()
  )
  const startsWith = data.find(
    (c: { name: string }) => c.name.toLowerCase().startsWith(searchName.toLowerCase())
  )
  const best = exact || startsWith || data[0]

  const isSystemUser = best.contact_type === 'user' && !!best.user_profile_id
  console.log(`[NOTIFY] Participante encontrado: ${best.name} (${best.phone}) [${best.contact_type}${isSystemUser ? ', user_profile=' + best.user_profile_id : ''}]`)

  return {
    id: isSystemUser ? best.user_profile_id : best.id,
    displayName: best.name,
    phoneNumber: best.phone,
    isSystemUser,
    userProfileId: best.user_profile_id || null,
  }
}

/**
 * Salva um contato na agenda.
 */
export async function saveContact(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    name: string
    phone: string
    contactType?: string
    notes?: string
    company?: string
    createdBy: string // auth.users.id
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  // Normalizar telefone
  let phone = params.phone.replace(/[\s\-().+]/g, '')
  if (!phone.startsWith('55') && phone.length <= 11) {
    phone = '55' + phone
  }

  // Verificar se já existe contato com mesmo telefone do mesmo criador
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone', phone)
    .eq('created_by', params.createdBy)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    // Atualizar contato existente
    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        name: params.name,
        contact_type: params.contactType || 'outro',
        notes: params.notes || null,
        company: params.company || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      console.error('[CONTACTS] Erro ao atualizar contato:', updateError)
      return { success: false, error: updateError.message }
    }

    console.log(`[CONTACTS] ✅ Contato atualizado: ${params.name} (${phone}) → ${existing.id}`)
    return { success: true, id: existing.id }
  }

  // Inserir novo contato
  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: params.name,
      phone,
      contact_type: params.contactType || 'outro',
      notes: params.notes || null,
      company: params.company || null,
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[CONTACTS] Erro ao salvar contato:', error)
    return { success: false, error: error.message }
  }

  console.log(`[CONTACTS] ✅ Contato salvo: ${params.name} (${phone}) → ${data.id}`)
  return { success: true, id: data.id }
}

/**
 * Busca contatos na agenda por nome ou telefone.
 */
export async function queryContacts(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  query: string
): Promise<Array<{ id: string; name: string; phone: string; contactType: string; notes: string | null }>> {
  const isPhone = /^\d{8,15}$/.test(query.replace(/[\s\-().+]/g, ''))

  let results
  if (isPhone) {
    const cleanPhone = query.replace(/[\s\-().+]/g, '')
    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, contact_type, notes')
      .ilike('phone', `%${cleanPhone}%`)
      .is('deleted_at', null)
      .limit(5)
    results = data
  } else {
    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, contact_type, notes')
      .ilike('name', `%${query}%`)
      .is('deleted_at', null)
      .limit(5)
    results = data
  }

  if (!results || results.length === 0) return []

  return results.map((c: { id: string; name: string; phone: string; contact_type: string; notes: string | null }) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    contactType: c.contact_type,
    notes: c.notes,
  }))
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
    groupJid?: string | null  // WA-06.8: Grupo de origem
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
      groupJid: params.groupJid || null,  // WA-06.8: Salvar grupo de origem
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

export interface ParticipantResponseResult {
  message: string       // Mensagem para o participante
  confirmed: boolean    // Se o participante confirmou
  declined: boolean     // Se o participante recusou
  ambiguous: boolean    // Se a resposta foi ambígua
}

/**
 * Processa a resposta do participante (sim/não) e notifica o criador.
 * Retorna mensagem para o participante + status da confirmação.
 */
export async function processParticipantResponse(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  serverUrl: string,
  token: string,
  confirmation: PendingEventConfirmation,
  response: string
): Promise<ParticipantResponseResult> {

  const normalized = response.trim().toLowerCase().replace(/[.,!?;:]+$/g, '').trim()
  // Pegar só a primeira palavra/frase curta para detectar respostas longas que começam com sim/não
  const firstWord = normalized.split(/[\s.,!?;:]+/)[0]

  // Detectar se é confirmação ou recusa
  const confirmWords = ['sim', 'yes', 's', 'ok', 'confirmo', 'beleza', 'bora', 'pode ser', 'claro', 'vou', 'vou sim', 'tamo junto', 'pode']
  const declineWords = ['não', 'nao', 'no', 'n', 'não posso', 'nao posso', 'cancelar', 'não vou', 'nao vou', 'não dá', 'nao da', 'não vai dar', 'nao vai dar']
  const declineStarts = ['não', 'nao', 'no', 'n']

  const isConfirm = confirmWords.includes(normalized) || confirmWords.includes(firstWord)
  // Aceitar recusa por match exato OU se a mensagem começa com palavra de recusa
  const isDecline = declineWords.includes(normalized) || declineStarts.includes(firstWord)

  if (!isConfirm && !isDecline) {
    // Anti-loop: contar quantas vezes já re-perguntamos (máx 2 tentativas)
    const sentAt = new Date(confirmation.sentAt).getTime()
    const elapsed = Date.now() - sentAt
    const maxRetryMs = 10 * 60 * 1000 // 10 minutos — se passou disso, desistir
    if (elapsed > maxRetryMs) {
      await clearEventConfirmation(supabase, confirmation.participantUserId)
      console.log(`[NOTIFY] ⏰ Timeout de confirmação para ${confirmation.participantName} — desistindo`)
      return {
        message: `Tudo bem! Se mudar de ideia sobre a *${confirmation.eventTitle}*, é só avisar.`,
        confirmed: false,
        declined: true,
        ambiguous: false,
      }
    }

    // Resposta ambígua — pedir esclarecimento
    const dateInfo = formatDateShort(confirmation.eventDate)
    const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
    return {
      message: `Sobre a *${confirmation.eventTitle}* de ${dateInfo}${timeInfo} — você confirma presença? (sim/não)`,
      confirmed: false,
      declined: false,
      ambiguous: true,
    }
  }

  // Limpar contexto do PARTICIPANTE
  await clearEventConfirmation(supabase, confirmation.participantUserId)

  if (isConfirm) {
    const dateInfo = formatDateShort(confirmation.eventDate)
    const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
    const creatorMessage = `${confirmation.participantName} confirmou presença na *${confirmation.eventTitle}* de ${dateInfo}${timeInfo} ✅`
    const notifyTo = confirmation.groupJid || confirmation.creatorPhone

    await sendTextMessage({
      serverUrl,
      token,
      to: notifyTo,
      text: creatorMessage,
    })

    console.log(`[NOTIFY] ✅ ${confirmation.participantName} CONFIRMOU → enviado para ${confirmation.groupJid ? 'grupo' : 'DM'} (${notifyTo})`)

    return { message: `Presença confirmada! Até lá 👍`, confirmed: true, declined: false, ambiguous: false }
  }

  // isDecline
  const dateInfo = formatDateShort(confirmation.eventDate)
  const timeInfo = confirmation.eventTime ? ` às ${confirmation.eventTime}` : ''
  const creatorMessage = `${confirmation.participantName} recusou a *${confirmation.eventTitle}* de ${dateInfo}${timeInfo}. Quer manter o evento mesmo assim?`
  const notifyTo = confirmation.groupJid || confirmation.creatorPhone

  await sendTextMessage({
    serverUrl,
    token,
    to: notifyTo,
    text: creatorMessage,
  })

  // Salvar contexto para o CRIADOR capturar a resposta "Sim/Não" sobre manter o evento
  await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: confirmation.creatorUserId,
      context_type: 'awaiting_decline_decision',
      is_active: true,
      context_data: {
        type: 'awaiting_decline_decision',
        eventId: confirmation.eventId,
        eventTitle: confirmation.eventTitle,
        eventDate: confirmation.eventDate,
        eventTime: confirmation.eventTime,
        participantName: confirmation.participantName,
        declinedAt: new Date().toISOString(),
      },
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,context_type', ignoreDuplicates: false })

  console.log(`[NOTIFY] ❌ ${confirmation.participantName} RECUSOU → enviado para ${confirmation.groupJid ? 'grupo' : 'DM'} (${notifyTo}) + contexto awaiting_decline_decision salvo`)

  return { message: `Entendido, avisei o ${confirmation.creatorName}.`, confirmed: false, declined: true, ambiguous: false }
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

// =============================================================================
// WA-06.8: FLUXO DE CONTATO NÃO CADASTRADO
// Quando participante não é encontrado, pedir número de celular ao criador
// =============================================================================

export interface PendingParticipantPhone {
  type: 'pending_participant_phone'
  participantName: string
  eventId: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  eventLocation: string | null
  creatorUserId: string
  creatorName: string
  creatorPhone: string
  groupJid?: string | null
}

/**
 * Salva contexto pedindo número de telefone de participante não cadastrado.
 */
export async function savePendingParticipantPhone(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  creatorUserId: string,
  data: PendingParticipantPhone
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: creatorUserId,
      context_type: 'pending_participant_phone',
      context_data: data,
      is_active: true,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,context_type'
    })

  if (error) {
    console.error('[NOTIFY] Erro ao salvar pending_participant_phone:', error)
  }
}

/**
 * Busca contexto de número pendente para um usuário.
 */
export async function getPendingParticipantPhone(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<PendingParticipantPhone | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data, updated_at')
    .eq('user_id', userId)
    .eq('context_type', 'pending_participant_phone')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  // Expirar após 10 minutos
  const updatedAt = new Date(data.updated_at)
  const diffMin = (Date.now() - updatedAt.getTime()) / 1000 / 60
  if (diffMin > 10) {
    await clearPendingParticipantPhone(supabase, userId)
    return null
  }

  return data.context_data as PendingParticipantPhone
}

/**
 * Limpa contexto de número pendente.
 */
export async function clearPendingParticipantPhone(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<void> {
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('context_type', 'pending_participant_phone')
}

/**
 * Processa resposta com número de telefone e envia notificação.
 * Retorna mensagem para o criador.
 */
export async function processPhoneResponse(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  serverUrl: string,
  token: string,
  pending: PendingParticipantPhone,
  response: string
): Promise<{ message: string; handled: boolean }> {
  const cleaned = response.trim().replace(/[\s\-().+]/g, '')

  // Verificar se parece um número de telefone (8-15 dígitos)
  if (!/^\d{8,15}$/.test(cleaned)) {
    // Verificar se é cancelamento
    const lower = response.trim().toLowerCase()
    if (['não', 'nao', 'n', 'no', 'deixa', 'esquece', 'cancela'].includes(lower)) {
      await clearPendingParticipantPhone(supabase, pending.creatorUserId)
      return { message: 'Beleza, não vou notificar.', handled: true }
    }
    return {
      message: `Não reconheci como número de telefone. Manda o WhatsApp do ${pending.participantName} com DDD (ex: 5521999999999) ou "não" pra pular.`,
      handled: true,
    }
  }

  // Normalizar número (garantir que começa com 55)
  let phoneNumber = cleaned
  if (!phoneNumber.startsWith('55') && phoneNumber.length <= 11) {
    phoneNumber = '55' + phoneNumber
  }

  // Enviar notificação
  const message = buildNotificationMessageForUnknown({
    participantName: pending.participantName,
    creatorName: pending.creatorName,
    eventTitle: pending.eventTitle,
    eventDate: pending.eventDate,
    eventTime: pending.eventTime,
    eventLocation: pending.eventLocation,
  })

  const sendResult = await sendTextMessage({
    serverUrl,
    token,
    to: phoneNumber,
    text: message,
  })

  // Limpar contexto
  await clearPendingParticipantPhone(supabase, pending.creatorUserId)

  if (!sendResult.success) {
    console.error(`[NOTIFY-PHONE] Falha ao enviar para ${phoneNumber}:`, sendResult.error)
    return {
      message: `Não consegui enviar para ${phoneNumber}. Verifica se o número está correto.`,
      handled: true,
    }
  }

  console.log(`[NOTIFY-PHONE] ✅ Notificação enviada para ${pending.participantName} (${phoneNumber})`)

  // WA-06.9: Salvar contato automaticamente na agenda (tabela mestre)
  // Buscar auth.users.id do criador para usar como created_by
  const { data: creatorProfile } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('id', pending.creatorUserId)
    .single()

  const authUserId = creatorProfile?.user_id || pending.creatorUserId
  const saveResult = await saveContact(supabase, {
    name: pending.participantName,
    phone: phoneNumber,
    contactType: 'outro',
    createdBy: authUserId,
  })

  if (saveResult.success) {
    console.log(`[NOTIFY-PHONE] ✅ Contato ${pending.participantName} salvo na agenda (${saveResult.id})`)

    // Salvar event_confirmation para o contato — quando ele responder, o index.ts vai encontrar
    const contactId = saveResult.id!
    const pendingConfirmation: PendingEventConfirmation = {
      type: 'event_confirmation',
      eventId: '', // Evento ainda não foi criado
      eventTitle: pending.eventTitle,
      eventDate: pending.eventDate,
      eventTime: pending.eventTime,
      eventLocation: pending.eventLocation,
      creatorUserId: pending.creatorUserId,
      creatorName: pending.creatorName,
      creatorPhone: pending.creatorPhone || '',
      participantUserId: contactId,
      participantName: pending.participantName,
      sentAt: new Date().toISOString(),
      groupJid: pending.groupJid || null,
    }
    await saveEventConfirmationContext(supabase, contactId, pendingConfirmation)
  }

  return {
    message: `Pronto! Enviei o convite pro ${pending.participantName} e salvei na agenda 📩📇`,
    handled: true,
  }
}

/**
 * Monta mensagem de notificação para participante não cadastrado.
 */
function buildNotificationMessageForUnknown(params: {
  participantName: string
  creatorName: string
  eventTitle: string
  eventDate: string
  eventTime: string | null
  eventLocation: string | null
}): string {
  let msg = `Fala ${params.participantName}! ${params.creatorName} quer agendar:`
  msg += `\n\n📝 *${params.eventTitle}*`
  msg += `\n📅 ${formatDateShort(params.eventDate)}`
  if (params.eventTime) msg += ` às ${params.eventTime}`
  if (params.eventLocation) msg += `\n📍 ${params.eventLocation}`
  msg += `\n\nConfirma presença? (sim/não)`

  return msg
}

// =============================================================================
// WA-06.8: FLUXO "QUER SALVAR NA AGENDA?"
// Após enviar notificação para número não cadastrado, perguntar se quer salvar
// =============================================================================

export interface PendingSaveContact {
  type: 'pending_save_contact'
  contactName: string
  contactPhone: string
  creatorUserId: string
  contactType?: string
  notes?: string
}

/**
 * Salva contexto pedindo se quer salvar contato na agenda.
 */
async function savePendingSaveContact(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  data: PendingSaveContact
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: userId,
      context_type: 'pending_save_contact',
      context_data: data,
      is_active: true,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,context_type'
    })

  if (error) {
    console.error('[CONTACTS] Erro ao salvar pending_save_contact:', error)
  }
}

/**
 * Busca contexto de salvar contato pendente.
 */
export async function getPendingSaveContact(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<PendingSaveContact | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data, updated_at')
    .eq('user_id', userId)
    .eq('context_type', 'pending_save_contact')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  const updatedAt = new Date(data.updated_at)
  const diffMin = (Date.now() - updatedAt.getTime()) / 1000 / 60
  if (diffMin > 5) {
    await clearPendingSaveContact(supabase, userId)
    return null
  }

  return data.context_data as PendingSaveContact
}

/**
 * Limpa contexto de salvar contato.
 */
export async function clearPendingSaveContact(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string
): Promise<void> {
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('context_type', 'pending_save_contact')
}

/**
 * Processa resposta de "quer salvar na agenda?" (sim/não ou tipo do contato).
 */
export async function processSaveContactResponse(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pending: PendingSaveContact,
  response: string,
  authUserId: string
): Promise<{ message: string; handled: boolean }> {
  const lower = response.trim().toLowerCase()

  // Cancelar
  if (['não', 'nao', 'n', 'no', 'deixa', 'esquece', 'não precisa', 'nao precisa'].includes(lower)) {
    await clearPendingSaveContact(supabase, pending.creatorUserId)
    return { message: 'Beleza, não salvei na agenda.', handled: true }
  }

  // Confirmar (sim, ou informar tipo)
  const confirmWords = ['sim', 's', 'yes', 'ok', 'salva', 'grava', 'pode', 'bora', 'claro']
  const isConfirm = confirmWords.includes(lower)

  // Detectar tipo do contato na resposta
  let contactType = 'outro'
  const typeMap: Record<string, string> = {
    'fornecedor': 'fornecedor',
    'aluno': 'aluno',
    'cliente': 'cliente',
    'parceiro': 'parceiro',
    'artista': 'artista',
  }

  for (const [keyword, type] of Object.entries(typeMap)) {
    if (lower.includes(keyword)) {
      contactType = type
      break
    }
  }

  if (isConfirm || contactType !== 'outro') {
    // Salvar contato
    const result = await saveContact(supabase, {
      name: pending.contactName,
      phone: pending.contactPhone,
      contactType,
      createdBy: authUserId,
    })

    await clearPendingSaveContact(supabase, pending.creatorUserId)

    if (result.success) {
      const typeLabel = contactType !== 'outro' ? ` como *${contactType}*` : ''
      return {
        message: `Salvei ${pending.contactName}${typeLabel} na agenda! 📇\nPróxima vez que precisar, é só pedir: "Mike, qual o número do ${pending.contactName}?"`,
        handled: true,
      }
    }

    return {
      message: `Não consegui salvar na agenda: ${result.error}`,
      handled: true,
    }
  }

  // Resposta ambígua — re-perguntar
  return {
    message: `Não entendi. Quer salvar ${pending.contactName} na agenda? Responde "sim" (posso adicionar o tipo: fornecedor, aluno, cliente, parceiro, artista) ou "não".`,
    handled: true,
  }
}
