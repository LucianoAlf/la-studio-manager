// ============================================
// Message Router — WA-02 (classificação Gemini)
// ============================================
// WA-02: Classifica intenção via Gemini e responde com confirmação
// WA-03: Vai adicionar execução de ações após confirmação

import { classifyMessage, getHelpText } from './gemini-classifier.ts'
import type { ClassificationResult } from './gemini-classifier.ts'
import type { RouteMessageParams, MessageResponse } from './types.ts'

export async function routeMessage(params: RouteMessageParams): Promise<MessageResponse> {
  const { supabase, user, parsed } = params
  const firstName = user.full_name.split(' ')[0]
  const userId = user.profile_id

  // Mensagens não-texto: informar limitação (WA-06 vai resolver)
  if (parsed.type === 'audio') {
    return {
      text: `🎤 Recebi seu áudio, ${firstName}! Em breve vou conseguir ouvir e processar áudios. Por enquanto, me manda por texto.`,
      intent: 'audio_received',
      confidence: 1.0,
    }
  }

  if (parsed.type === 'image') {
    return {
      text: `📸 Recebi sua imagem${parsed.text ? ` com legenda: "${parsed.text}"` : ''}! Em breve vou conseguir analisar imagens. Por enquanto, me manda por texto.`,
      intent: 'image_received',
      confidence: 1.0,
    }
  }

  if (parsed.type === 'video') {
    return {
      text: `🎥 Recebi seu vídeo${parsed.text ? ` com legenda: "${parsed.text}"` : ''}! Em breve vou poder processar vídeos.`,
      intent: 'video_received',
      confidence: 1.0,
    }
  }

  if (parsed.type === 'document') {
    return {
      text: `📄 Recebi seu documento, ${firstName}! Em breve vou conseguir processar documentos.`,
      intent: 'document_received',
      confidence: 1.0,
    }
  }

  if (parsed.type === 'sticker') {
    return {
      text: `😄 Recebi seu sticker, ${firstName}! Ainda não sei interpretar stickers, mas em breve!`,
      intent: 'sticker_received',
      confidence: 1.0,
    }
  }

  if (parsed.type === 'location') {
    return {
      text: `📍 Recebi sua localização, ${firstName}! Em breve vou poder usar isso.`,
      intent: 'location_received',
      confidence: 1.0,
    }
  }

  if (!parsed.text) {
    return {
      text: `Não consegui ler sua mensagem, ${firstName}. Tenta mandar por texto?`,
      intent: 'unknown',
      confidence: 0,
    }
  }

  // ========================================
  // VERIFICAR CONTEXTO ATIVO (sim/não)
  // ========================================
  let conversationContext: string | undefined

  const { data: activeContext } = await supabase
    .from('whatsapp_conversation_context')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeContext?.context_data?.step === 'awaiting_confirmation') {
    const lower = parsed.text.toLowerCase().trim()

    if (['sim', 's', 'confirma', 'ok', 'pode', 'isso', 'bora', 'manda'].includes(lower)) {
      // WA-03 vai executar a ação aqui
      // Por enquanto, confirmar e desativar contexto
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)

      return {
        text: `✅ Beleza, ${firstName}! Ação registrada. (A execução real vem no próximo update!)`,
        intent: `confirmed_${activeContext.context_type}`,
        confidence: 1.0,
      }
    }

    if (['não', 'nao', 'n', 'cancela', 'cancelar', 'deixa'].includes(lower)) {
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)

      return {
        text: `❌ Cancelado, ${firstName}! Se precisar de algo, é só falar.`,
        intent: 'cancelled',
        confidence: 1.0,
      }
    }

    // Se respondeu outra coisa durante confirmação, incluir contexto na classificação
    conversationContext = `Contexto pendente: ${activeContext.context_type} aguardando confirmação. Dados: ${JSON.stringify(activeContext.context_data.entities)}`
  } else if (activeContext?.context_data) {
    conversationContext = JSON.stringify(activeContext.context_data)
  }

  // ========================================
  // CLASSIFICAR MENSAGEM COM GEMINI
  // ========================================
  const classification = await classifyMessage(parsed.text, firstName, conversationContext)

  // ========================================
  // ROTEAR POR INTENÇÃO
  // ========================================
  switch (classification.intent) {
    case 'create_card':
      return handleCreateCard(classification, firstName, supabase, userId)

    case 'create_calendar':
      return handleCreateCalendar(classification, firstName, supabase, userId)

    case 'create_reminder':
      return handleCreateReminder(classification, firstName, supabase, userId)

    case 'query_calendar':
      return {
        text: classification.response_text || `📅 Vou consultar sua agenda, ${firstName}. (Em breve!)`,
        intent: classification.intent,
        confidence: classification.confidence,
      }

    case 'query_cards':
      return {
        text: classification.response_text || `📋 Vou verificar seus cards, ${firstName}. (Em breve!)`,
        intent: classification.intent,
        confidence: classification.confidence,
      }

    case 'query_projects':
      return {
        text: classification.response_text || `📊 Vou consultar o projeto, ${firstName}. (Em breve!)`,
        intent: classification.intent,
        confidence: classification.confidence,
      }

    case 'generate_report':
      return {
        text: classification.response_text || `📈 Vou gerar o relatório, ${firstName}. (Em breve!)`,
        intent: classification.intent,
        confidence: classification.confidence,
      }

    case 'update_card':
      return {
        text: classification.response_text || `✏️ Vou atualizar o card, ${firstName}. (Em breve!)`,
        intent: classification.intent,
        confidence: classification.confidence,
      }

    case 'help':
      return {
        text: getHelpText(),
        intent: 'help',
        confidence: 1.0,
      }

    case 'general_chat':
      return {
        text: classification.response_text,
        intent: 'general_chat',
        confidence: classification.confidence,
      }

    case 'unknown':
    default:
      return {
        text: classification.response_text || `Não entendi bem, ${firstName}. Pode reformular? Ou digite "ajuda".`,
        intent: 'unknown',
        confidence: classification.confidence,
      }
  }
}

// ============================================
// HANDLERS DE CRIAÇÃO (WA-02: salva contexto, pede confirmação)
// ============================================

// deno-lint-ignore no-explicit-any
async function handleCreateCard(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string
): Promise<MessageResponse> {
  const { entities } = classification

  if (classification.needs_confirmation) {
    await saveConversationContext(supabase, userId, 'creating_card', {
      step: 'awaiting_confirmation',
      entities,
      classified_at: new Date().toISOString(),
    })
  }

  const parts: string[] = ['🎯 Entendi! Vou criar um *card no Kanban*:\n']
  if (entities.title) parts.push(`📝 Título: *${entities.title}*`)
  if (entities.priority) parts.push(`⚡ Prioridade: *${formatPriority(entities.priority)}*`)
  if (entities.content_type) parts.push(`🎬 Tipo: *${formatContentType(entities.content_type)}*`)
  if (entities.brand) parts.push(`🏷️ Marca: *${formatBrand(entities.brand)}*`)
  if (entities.column) parts.push(`📋 Coluna: *${formatColumn(entities.column)}*`)
  if (entities.platforms?.length) parts.push(`📱 Plataformas: *${entities.platforms.join(', ')}*`)
  if (entities.description) parts.push(`📄 Descrição: ${entities.description}`)
  parts.push('\n✅ Confirma? (sim/não)')

  return {
    text: parts.join('\n'),
    intent: classification.intent,
    confidence: classification.confidence,
  }
}

// deno-lint-ignore no-explicit-any
async function handleCreateCalendar(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string
): Promise<MessageResponse> {
  const { entities } = classification

  if (classification.needs_confirmation) {
    await saveConversationContext(supabase, userId, 'creating_calendar', {
      step: 'awaiting_confirmation',
      entities,
      classified_at: new Date().toISOString(),
    })
  }

  const parts: string[] = ['📅 Entendi! Vou criar um *item no calendário*:\n']
  if (entities.title) parts.push(`📝 Título: *${entities.title}*`)
  if (entities.calendar_type) parts.push(`📌 Tipo: *${formatCalendarType(entities.calendar_type)}*`)
  if (entities.date) parts.push(`📆 Data: *${entities.date}*`)
  if (entities.time) parts.push(`⏰ Horário: *${entities.time}*`)
  if (entities.duration_minutes) parts.push(`⏱️ Duração: *${entities.duration_minutes} min*`)
  if (entities.platforms?.length) parts.push(`📱 Plataformas: *${entities.platforms.join(', ')}*`)
  parts.push('\n✅ Confirma? (sim/não)')

  return {
    text: parts.join('\n'),
    intent: classification.intent,
    confidence: classification.confidence,
  }
}

// deno-lint-ignore no-explicit-any
async function handleCreateReminder(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string
): Promise<MessageResponse> {
  const { entities } = classification

  if (classification.needs_confirmation) {
    await saveConversationContext(supabase, userId, 'creating_reminder', {
      step: 'awaiting_confirmation',
      entities,
      classified_at: new Date().toISOString(),
    })
  }

  const parts: string[] = ['⏰ Entendi! Vou criar um *lembrete*:\n']
  if (entities.reminder_text) parts.push(`📝 Lembrete: *${entities.reminder_text}*`)
  if (entities.reminder_date) parts.push(`📆 Data: *${entities.reminder_date}*`)
  if (entities.reminder_time) parts.push(`⏰ Horário: *${entities.reminder_time}*`)
  parts.push('\n✅ Confirma? (sim/não)')

  return {
    text: parts.join('\n'),
    intent: classification.intent,
    confidence: classification.confidence,
  }
}

// ============================================
// CONTEXTO DE CONVERSA
// ============================================

// deno-lint-ignore no-explicit-any
async function saveConversationContext(
  supabase: any,
  userId: string,
  contextType: string,
  contextData: Record<string, unknown>
): Promise<void> {
  try {
    // Desativar contextos anteriores do mesmo tipo
    await supabase
      .from('whatsapp_conversation_context')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('context_type', contextType)
      .eq('is_active', true)

    // Criar novo contexto (expira em 10 min)
    await supabase
      .from('whatsapp_conversation_context')
      .insert({
        user_id: userId,
        context_type: contextType,
        context_data: contextData,
        is_active: true,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })

    console.log(`[WA] Context saved: ${contextType} for user ${userId}`)
  } catch (error) {
    console.error('[WA] Error saving context:', error)
  }
}

// ============================================
// FORMATADORES
// ============================================

function formatPriority(p: string): string {
  const map: Record<string, string> = {
    urgent: '🔴 Urgente', high: '🟠 Alta', medium: '🟡 Média', low: '⚪ Baixa',
  }
  return map[p] || p
}

function formatContentType(ct: string): string {
  const map: Record<string, string> = {
    video: '🎬 Vídeo', carousel: '🎠 Carrossel', reels: '🎞️ Reels',
    story: '📱 Story', photo: '📸 Foto', live: '🔴 Live',
  }
  return map[ct] || ct
}

function formatBrand(b: string): string {
  const map: Record<string, string> = { la_music: '🎵 LA Music', la_kids: '🧒 LA Kids' }
  return map[b] || b
}

function formatColumn(c: string): string {
  const map: Record<string, string> = {
    brainstorm: '💡 Brainstorm', planning: '📋 Planejamento', todo: '📝 To Do',
    capturing: '🎥 Captação', editing: '✂️ Edição',
    awaiting_approval: '⏳ Aguardando Aprovação', approved: '✅ Aprovado',
    published: '🚀 Publicado', archived: '📦 Arquivado',
  }
  return map[c] || c
}

function formatCalendarType(t: string): string {
  const map: Record<string, string> = {
    event: '🎉 Evento', delivery: '📦 Entrega', creation: '🎨 Criação',
    task: '✅ Tarefa', meeting: '🤝 Reunião',
  }
  return map[t] || t
}
