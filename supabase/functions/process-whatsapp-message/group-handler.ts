// =============================================================================
// GROUP-HANDLER.TS — WA-06.7: Gerenciamento de sessões de grupo
// Ativação por nome, dispensa, timeout, silêncio por padrão
// =============================================================================

import {
  isGroupEnabled,
  containsMikeName,
  isDismissPhrase,
  removeMikeName,
  getSessionTimeout,
  getEnabledGroups,
  getTriggerNames,
} from './group-config.ts'

// =============================================================================
// TIPOS
// =============================================================================

export interface GroupSessionData {
  groupJid: string
  senderPhone: string
  senderName: string
  activatedAt: string
  lastInteractionAt: string
}

export interface GroupHandlerResult {
  /** Se true, Mike deve responder */
  shouldRespond: boolean
  /** Resposta direta (saudação, dispensa) — enviar e parar */
  responseText?: string
  /** Texto processado (nome do Mike removido) — continuar pro NLP */
  processedText?: string
}

// =============================================================================
// GERENCIAMENTO DE SESSÃO
// =============================================================================

/**
 * Busca sessão ativa de grupo para um usuário.
 * Usa whatsapp_conversation_context com context_type='group_session'.
 */
// deno-lint-ignore no-explicit-any
export async function getGroupSession(
  supabase: any,
  userId: string,
): Promise<GroupSessionData | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversation_context')
    .select('*')
    .eq('user_id', userId)
    .eq('context_type', 'group_session')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) return null

  const sessionData = data.context_data as GroupSessionData

  // Verificar timeout
  const lastInteraction = new Date(sessionData.lastInteractionAt).getTime()
  const now = Date.now()
  const diffMinutes = (now - lastInteraction) / (1000 * 60)

  if (diffMinutes > getSessionTimeout()) {
    console.log(`[GROUP] Sessão expirada para ${sessionData.senderName} (${diffMinutes.toFixed(1)} min)`)
    await clearGroupSession(supabase, userId)
    return null
  }

  return sessionData
}

/**
 * Cria ou atualiza sessão de grupo para um usuário.
 */
// deno-lint-ignore no-explicit-any
export async function saveGroupSession(
  supabase: any,
  userId: string,
  sessionData: GroupSessionData,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: userId,
      context_type: 'group_session',
      context_data: sessionData,
      is_active: true,
      expires_at: new Date(Date.now() + getSessionTimeout() * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,context_type',
    })

  if (error) {
    console.error('[GROUP] Erro ao salvar sessão:', error.message)
  } else {
    console.log(`[GROUP] Sessão salva para ${sessionData.senderName} no grupo ${sessionData.groupJid.substring(0, 10)}...`)
  }
}

/**
 * Atualiza o timestamp de última interação (touch).
 */
// deno-lint-ignore no-explicit-any
export async function touchSession(
  supabase: any,
  userId: string,
  session: GroupSessionData,
): Promise<void> {
  await saveGroupSession(supabase, userId, {
    ...session,
    lastInteractionAt: new Date().toISOString(),
  })
}

/**
 * Encerra sessão de grupo.
 */
// deno-lint-ignore no-explicit-any
export async function clearGroupSession(
  supabase: any,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('context_type', 'group_session')

  if (error) {
    console.error('[GROUP] Erro ao limpar sessão:', error.message)
  }
}

// =============================================================================
// WA-06.8: DETECTAR CHAMADA A OUTRA PESSOA
// =============================================================================

/**
 * Detecta se o usuário está chamando outra pessoa no grupo (não o Mike).
 * Ex: "Fala John", "Oi Maria", "E aí Pedro" → true
 * Ex: "Fala Mike", "Cria um card", "10h" → false
 */
function isCallingAnotherPerson(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().trim()

  // Padrões de chamada direta:
  // 1. "Fala X", "Oi X", "E aí X", "Opa X" (saudação + nome)
  // 2. "Yuri, ..." (nome seguido de vírgula — dirigindo-se a alguém)
  const callingPatterns = [
    /^(?:fala|oi|e\s*a[ií]|opa|hey|ei|salve|ol[aá])\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
    /^([a-záàâãéèêíïóôõöúçñ]{2,})\s*,/i,
  ]

  for (const pattern of callingPatterns) {
    const match = lower.match(pattern)
    if (match) {
      const calledName = match[1].trim()
      // Se o nome chamado é o Mike → NÃO é outra pessoa
      const isMike = getTriggerNames().some((n: string) => calledName === n.toLowerCase())
      if (!isMike && calledName.length >= 2) {
        console.log(`[GROUP] Detectou chamada a outra pessoa: "${calledName}" (não é Mike)`)
        return true
      }
    }
  }

  return false
}

// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================

/**
 * Decide se o Mike deve responder uma mensagem de grupo.
 *
 * Fluxo:
 * 1. Grupo não habilitado → silêncio
 * 2. Usuário não cadastrado (userId null) → silêncio
 * 3. Frase de dispensa → encerrar sessão + responder
 * 4. Sessão ativa → touch + processar (sem precisar do nome)
 * 5. Mencionou nome do Mike → ativar sessão + processar
 * 6. Nenhum dos acima → silêncio
 */
// deno-lint-ignore no-explicit-any
export async function handleGroupMessage(
  supabase: any,
  text: string,
  groupJid: string,
  senderPhone: string,
  senderName: string,
  userId: string | null,
): Promise<GroupHandlerResult> {
  const groupName = getEnabledGroups()[groupJid] || groupJid

  // 1. Grupo não habilitado
  if (!isGroupEnabled(groupJid)) {
    console.log(`[GROUP] Grupo não habilitado: ${groupJid}`)
    return { shouldRespond: false }
  }

  // 2. Usuário não cadastrado
  if (!userId) {
    console.log(`[GROUP] Usuário não cadastrado: ${senderPhone} no grupo ${groupName}`)
    // Se mencionou o Mike, avisar que não é cadastrado
    if (containsMikeName(text)) {
      return {
        shouldRespond: true,
        responseText: `Opa! Não te encontrei no sistema. Pede pro admin te cadastrar e aí a gente conversa! 😉`,
      }
    }
    return { shouldRespond: false }
  }

  // 3. Frase de dispensa
  if (isDismissPhrase(text)) {
    const session = await getGroupSession(supabase, userId)
    if (session) {
      await clearGroupSession(supabase, userId)

      // Limpar TODOS os contextos pendentes do usuário (pending_action, creating_*, etc.)
      // para evitar que ações incompletas fiquem "presas"
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_active', true)
        .neq('context_type', 'group_session')

      console.log(`[GROUP] Sessão encerrada por dispensa: ${senderName} no grupo ${groupName} (contextos limpos)`)
      return {
        shouldRespond: true,
        responseText: `Beleza, ${senderName.split(' ')[0]}! Qualquer coisa é só me chamar. 🤙`,
      }
    }
    // Sem sessão ativa, ignorar a dispensa
    return { shouldRespond: false }
  }

  // 4. Sessão ativa — responder sem precisar do nome
  const existingSession = await getGroupSession(supabase, userId)
  if (existingSession && existingSession.groupJid === groupJid) {
    // WA-06.8: Detectar se o usuário está chamando OUTRA pessoa (não o Mike)
    // Ex: "Fala John", "Oi Maria" → encerrar sessão do Mike e ficar em silêncio
    if (isCallingAnotherPerson(text)) {
      await clearGroupSession(supabase, userId)
      console.log(`[GROUP] Sessão encerrada: ${senderName} chamou outra pessoa ("${text.substring(0, 40)}")`)
      return { shouldRespond: false }
    }

    await touchSession(supabase, userId, existingSession)
    console.log(`[GROUP] Sessão ativa: ${senderName} no grupo ${groupName}`)

    // Remover nome do Mike se presente (ex: "Mike, e o horário?")
    const processedText = containsMikeName(text) ? removeMikeName(text) : text
    return {
      shouldRespond: true,
      processedText,
    }
  }

  // 5. Mencionou nome do Mike → ativar sessão
  if (containsMikeName(text)) {
    const now = new Date().toISOString()
    const newSession: GroupSessionData = {
      groupJid,
      senderPhone,
      senderName,
      activatedAt: now,
      lastInteractionAt: now,
    }
    await saveGroupSession(supabase, userId, newSession)
    console.log(`[GROUP] Nova sessão ativada: ${senderName} no grupo ${groupName}`)

    const processedText = removeMikeName(text)

    // Se só chamou o nome sem comando (ex: "Mike", "Fala Mike")
    const trimmed = processedText.toLowerCase().trim()
    const greetings = ['', 'fala', 'oi', 'e ai', 'e aí', 'eai', 'opa', 'hey', 'ei', 'salve', 'ola', 'olá']
    if (greetings.includes(trimmed) || trimmed.length < 3) {
      return {
        shouldRespond: true,
        responseText: `Fala, ${senderName.split(' ')[0]}! Tô por aqui. No que posso ajudar? 💪`,
      }
    }

    // Tem comando junto com o nome
    return {
      shouldRespond: true,
      processedText,
    }
  }

  // 6. Nenhum trigger → silêncio
  return { shouldRespond: false }
}
