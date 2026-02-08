// =============================================================================
// GROUP-MEMORY.TS — WA-06.7: Memória de conversa do grupo
// Mike escuta TUDO e armazena para ter contexto quando ativado
// =============================================================================

import { GROUP_MEMORY_HOURS_BACK, GROUP_MEMORY_MAX_MESSAGES } from './group-config.ts'

// =============================================================================
// TIPOS
// =============================================================================

export interface GroupMemoryMessage {
  sender_name: string
  sender_phone: string
  message_text: string
  message_type: string
  media_caption: string | null
  image_analysis: string | null
  is_from_mike: boolean
  message_timestamp: string
}

// =============================================================================
// SALVAR MENSAGENS
// =============================================================================

/**
 * Salva uma mensagem do grupo na memória.
 * Chamado para TODA mensagem recebida no grupo (mesmo em silêncio).
 */
// deno-lint-ignore no-explicit-any
export async function saveGroupMessage(
  supabase: any,
  params: {
    groupJid: string
    senderPhone: string
    senderName: string
    messageText: string
    messageType?: string
    mediaCaption?: string | null
    imageAnalysis?: string | null
    messageId?: string | null
    isFromMike?: boolean
    repliedToMessageId?: string | null
    messageTimestamp?: string | null
  }
): Promise<void> {
  try {
    // Se não tem messageId, gerar um baseado em timestamp para evitar null no unique
    const effectiveMessageId = params.messageId || `gen_${params.groupJid}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    const { error } = await supabase
      .from('group_message_memory')
      .upsert({
        group_jid: params.groupJid,
        sender_phone: params.senderPhone,
        sender_name: params.senderName,
        message_text: params.messageText,
        message_type: params.messageType || 'text',
        media_caption: params.mediaCaption || null,
        image_analysis: params.imageAnalysis || null,
        message_id: effectiveMessageId,
        is_from_mike: params.isFromMike || false,
        replied_to_message_id: params.repliedToMessageId || null,
        message_timestamp: params.messageTimestamp || new Date().toISOString(),
      }, {
        onConflict: 'group_jid,message_id',
        ignoreDuplicates: true,
      })

    if (error) {
      console.error('[GROUP-MEMORY] Erro ao salvar mensagem:', error.message)
    } else {
      console.log(`[GROUP-MEMORY] Mensagem salva: ${params.senderName} em ${params.groupJid.substring(0, 10)}...`)
    }
  } catch (e) {
    // Não bloquear o fluxo se memória falhar
    console.error('[GROUP-MEMORY] Exception:', e)
  }
}

/**
 * Salva a resposta do Mike no grupo (para ele saber o que ele mesmo disse).
 */
// deno-lint-ignore no-explicit-any
export async function saveMikeResponse(
  supabase: any,
  params: {
    groupJid: string
    responseText: string
    messageId?: string | null
  }
): Promise<void> {
  await saveGroupMessage(supabase, {
    groupJid: params.groupJid,
    senderPhone: 'mike',
    senderName: 'Mike',
    messageText: params.responseText,
    messageType: 'text',
    messageId: params.messageId || `mike_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    isFromMike: true,
  })
}

// =============================================================================
// RECUPERAR CONTEXTO
// =============================================================================

/**
 * Recupera as últimas N mensagens do grupo (contexto recente).
 * Usado quando Mike é ativado para ter contexto da conversa.
 */
// deno-lint-ignore no-explicit-any
export async function getRecentGroupMessages(
  supabase: any,
  groupJid: string,
  hoursBack: number = GROUP_MEMORY_HOURS_BACK,
  maxMessages: number = GROUP_MEMORY_MAX_MESSAGES,
): Promise<GroupMemoryMessage[]> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('group_message_memory')
    .select('sender_name, sender_phone, message_text, message_type, media_caption, image_analysis, is_from_mike, message_timestamp')
    .eq('group_jid', groupJid)
    .gte('message_timestamp', since)
    .order('message_timestamp', { ascending: true })
    .limit(maxMessages)

  if (error) {
    console.error('[GROUP-MEMORY] Erro ao buscar mensagens:', error.message)
    return []
  }

  return (data || []) as GroupMemoryMessage[]
}

// =============================================================================
// FORMATAR CONTEXTO PARA O PROMPT
// =============================================================================

/**
 * Formata o contexto do grupo para injetar no prompt do NLP/Gemini.
 * Cria um resumo legível da conversa recente.
 */
export function formatGroupContext(messages: GroupMemoryMessage[]): string {
  if (!messages || messages.length === 0) {
    return '(Nenhuma mensagem recente no grupo)'
  }

  const lines = messages.map(msg => {
    const time = new Date(msg.message_timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
    const sender = msg.is_from_mike ? '🤖 Mike' : msg.sender_name || msg.sender_phone
    let content = msg.message_text

    // Adicionar contexto de mídia
    if (msg.message_type === 'audio') {
      content = `[Áudio transcrito] ${content}`
    } else if (msg.message_type === 'image') {
      content = msg.media_caption
        ? `[Foto: ${msg.media_caption}]`
        : `[Foto] ${msg.image_analysis || ''}`
    }

    return `[${time}] ${sender}: ${content}`
  })

  return lines.join('\n')
}

/**
 * Gera o contexto completo da conversa para injetar no prompt do NLP.
 * Retorna string vazia se não há mensagens recentes.
 */
// deno-lint-ignore no-explicit-any
export async function getGroupContextSummary(
  supabase: any,
  groupJid: string,
  hoursBack: number = GROUP_MEMORY_HOURS_BACK,
  maxMessages: number = GROUP_MEMORY_MAX_MESSAGES,
): Promise<string> {
  const messages = await getRecentGroupMessages(supabase, groupJid, hoursBack, maxMessages)

  if (messages.length === 0) {
    return ''
  }

  const formatted = formatGroupContext(messages)

  console.log(`[GROUP-MEMORY] Contexto carregado: ${messages.length} mensagens das últimas ${hoursBack}h`)

  return `\n--- CONVERSA RECENTE NO GRUPO (últimas ${messages.length} mensagens) ---\n${formatted}\n--- FIM DO CONTEXTO DO GRUPO ---`
}
