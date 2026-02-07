// ============================================
// Message Router — WA-04 (memória + consultas) + WA-06 (áudio/imagem)
// ============================================
// WA-02: Classifica intenção via Gemini e responde com confirmação
// WA-03: Executa ações reais após confirmação (INSERT no banco)
// WA-04: Sistema de memória + consultas reais ao banco
// WA-06: Processamento de áudio (transcrição) e imagem (Vision)

import { classifyMessage, getHelpText } from './gemini-classifier.ts'
import { executeConfirmedAction } from './action-executor.ts'
import { loadMemoryContext, formatMemoryForPrompt, saveEpisode, learnFact } from './memory-manager.ts'
import { handleQueryCalendar, handleQueryCards, handleQueryProjects, handleGenerateReport } from './query-handler.ts'
import { transcribeAudio } from './audio-handler.ts'
import { analyzeImage } from './image-handler.ts'
import type { ClassificationResult } from './gemini-classifier.ts'
import type { RouteMessageParams, MessageResponse } from './types.ts'

export async function routeMessage(params: RouteMessageParams): Promise<MessageResponse> {
  const { supabase, user, parsed } = params
  const firstName = user.full_name.split(' ')[0]
  const userId = user.profile_id
  const authUserId = user.auth_user_id
  const phone = parsed.from

  // ========================================
  // WA-06: PROCESSAMENTO DE ÁUDIO
  // ========================================
  if (parsed.type === 'audio') {
    return await handleAudioMessage(params, firstName, userId)
  }

  // ========================================
  // WA-06: PROCESSAMENTO DE IMAGEM
  // ========================================
  if (parsed.type === 'image') {
    return await handleImageMessage(params, firstName, userId)
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
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()

    // --- CONFIRMOU: SIM → executar ação real (WA-03) ---
    if (['sim', 's', 'yes', 'y', 'confirma', 'confirmo', 'ok', 'pode', 'pode criar', 'manda', 'bora', 'isso'].includes(lower)) {
      // Executar ação real PRIMEIRO (se falhar, contexto fica rastreável)
      const result = await executeConfirmedAction(
        activeContext.context_type,
        {
          supabase,
          profileId: userId,
          authUserId,
          userName: firstName,
          phone,
          entities: activeContext.context_data.entities,
        }
      )

      // Desativar contexto APÓS execução (com status condicional)
      await supabase
        .from('whatsapp_conversation_context')
        .update({
          is_active: false,
          context_data: {
            ...activeContext.context_data,
            step: result.success ? 'executed' : 'execution_failed',
            executed_at: new Date().toISOString(),
            record_id: result.record_id || null,
            error: result.error || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeContext.id)

      // WA-04: Salvar episódio + aprender fatos
      if (result.success && supabase && userId) {
        const ents = activeContext.context_data?.entities || {}

        saveEpisode(supabase, {
          userId,
          summary: `${firstName} confirmou ${activeContext.context_type}: "${ents.title || 'sem título'}".`,
          entities: {
            action_type: activeContext.context_type, record_id: result.record_id,
            title: ents.title, priority: ents.priority, brand: ents.brand, content_type: ents.content_type,
          },
          outcome: 'action_completed', importance: 0.6,
        }).catch(e => console.error('[WA-04] Episode save error:', e))

        if (ents.priority === 'urgent') {
          learnFact(supabase, {
            userId, category: 'preference',
            fact: `${firstName} tende a usar prioridade "urgent" para ${ents.content_type || 'conteúdo'}.`,
            metadata: { applies_to: activeContext.context_type, content_type: ents.content_type, default_priority: 'urgent' },
          }).catch(e => console.error('[WA-04] Fact learn error:', e))
        }
        if (ents.brand) {
          learnFact(supabase, {
            userId, category: 'workflow',
            fact: `${firstName} trabalha com a marca ${ents.brand}.`,
            metadata: { applies_to: 'brand_usage', brand: ents.brand },
          }).catch(e => console.error('[WA-04] Fact learn error:', e))
        }
      }

      return {
        text: result.message,
        intent: `${activeContext.context_type}_${result.success ? 'executed' : 'failed'}`,
        confidence: 1.0,
        metadata: {
          record_id: result.record_id,
          success: result.success,
          error: result.error,
        },
      }
    }

    // --- CANCELOU: NÃO ---
    if (['não', 'nao', 'n', 'no', 'cancela', 'cancelar', 'deixa', 'esquece'].includes(lower)) {
      await supabase
        .from('whatsapp_conversation_context')
        .update({
          is_active: false,
          context_data: {
            ...activeContext.context_data,
            step: 'cancelled',
            cancelled_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeContext.id)

      // WA-04: Registrar cancelamento
      if (supabase && userId) {
        saveEpisode(supabase, {
          userId,
          summary: `${firstName} cancelou ${activeContext.context_type}: "${activeContext.context_data?.entities?.title || ''}".`,
          entities: { action_type: activeContext.context_type, cancelled: true },
          outcome: 'cancelled', importance: 0.2,
        }).catch(e => console.error('[WA-04] Episode save error:', e))
      }

      return {
        text: `👍 Tudo bem, cancelei! Nenhuma alteração foi feita.\n\nQuando quiser, é só me mandar um novo comando. 😉`,
        intent: `${activeContext.context_type}_cancelled`,
        confidence: 1.0,
      }
    }

    // Se respondeu outra coisa durante confirmação, incluir contexto na classificação
    conversationContext = `Contexto pendente: ${activeContext.context_type} aguardando confirmação. Dados: ${JSON.stringify(activeContext.context_data.entities)}`
  } else if (activeContext?.context_data) {
    conversationContext = JSON.stringify(activeContext.context_data)
  }

  // ========================================
  // WA-04: CARREGAR MEMÓRIA DO AGENTE
  // ========================================
  let memoryPrompt = ''
  if (supabase && userId) {
    const memory = await loadMemoryContext(supabase, userId)
    if (memory) {
      memoryPrompt = formatMemoryForPrompt(memory)
      if (memoryPrompt) {
        console.log(`[WA-04] Memory loaded: ${memory.user_facts.length} facts, ${memory.recent_episodes.length} episodes, ${memory.team_knowledge.length} team`)
      }
    }
  }

  // ========================================
  // CLASSIFICAR MENSAGEM COM GEMINI
  // ========================================
  const classification = await classifyMessage(parsed.text, firstName, conversationContext, memoryPrompt)

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

    case 'query_calendar': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryCalendar(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${firstName} consultou agenda (${classification.entities.query_period || 'hoje'}). ${result.resultCount} itens.`,
        entities: { query_type: 'calendar', period: classification.entities.query_period, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.3,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'query_calendar', confidence: classification.confidence }
    }

    case 'query_cards': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryCards(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${firstName} consultou cards${classification.entities.priority ? ` (${classification.entities.priority})` : ''}${classification.entities.column ? ` coluna ${classification.entities.column}` : ''}. ${result.resultCount} encontrados.`,
        entities: { query_type: 'cards', priority: classification.entities.priority, column: classification.entities.column, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.3,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      if (classification.entities.priority) {
        learnFact(supabase, {
          userId, category: 'pattern',
          fact: `${firstName} frequentemente consulta cards com prioridade "${classification.entities.priority}".`,
          metadata: { applies_to: 'query_cards', priority: classification.entities.priority },
        }).catch(e => console.error('[WA-04] Fact learn error:', e))
      }

      return { text: result.text, intent: 'query_cards', confidence: classification.confidence }
    }

    case 'query_projects': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryProjects(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${firstName} consultou status do projeto. ${result.resultCount} cards total.`,
        entities: { query_type: 'projects', result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.4,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'query_projects', confidence: classification.confidence }
    }

    case 'generate_report': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleGenerateReport(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${firstName} pediu relatório (${classification.entities.query_period || 'esta semana'}). ${result.resultCount} itens.`,
        entities: { query_type: 'report', period: classification.entities.query_period, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.5,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'generate_report', confidence: classification.confidence }
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

    case 'general_chat': {
      const msgPreview = (parsed.text || '').substring(0, 80)
      if (supabase && userId) {
        saveEpisode(supabase, {
          userId,
          summary: `${firstName} conversa livre: "${msgPreview}"`,
          outcome: 'conversation', importance: 0.1,
        }).catch(e => console.error('[WA-04] Episode save error:', e))
      }
      return { text: classification.response_text, intent: 'general_chat', confidence: classification.confidence }
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
    // UPSERT: tabela tem UNIQUE(user_id, context_type)
    // Se já existe registro para este user+type, atualiza em vez de falhar
    const { error } = await supabase
      .from('whatsapp_conversation_context')
      .upsert(
        {
          user_id: userId,
          context_type: contextType,
          context_data: contextData,
          is_active: true,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,context_type' }
      )

    if (error) {
      console.error('[WA] Context upsert error:', JSON.stringify(error))
    } else {
      console.log(`[WA] Context saved: ${contextType} for user ${userId}`)
    }
  } catch (error) {
    console.error('[WA] Error saving context:', error)
  }
}

// ============================================
// WA-06: HANDLER DE ÁUDIO
// ============================================

async function handleAudioMessage(
  params: RouteMessageParams,
  firstName: string,
  userId: string,
): Promise<MessageResponse> {
  const { supabase, user, parsed, uazapiUrl, uazapiToken } = params
  const authUserId = user.auth_user_id
  const startTime = Date.now()

  // Verificar se temos messageId para download
  if (!parsed.messageId) {
    console.error('[WA-06] No messageId for audio download')
    return {
      text: `🎤 Recebi seu áudio, ${firstName}, mas não consegui processá-lo. Tenta mandar de novo?`,
      intent: 'audio_error',
      confidence: 1.0,
    }
  }

  // Extrair duração do payload (msg.content.seconds no webhook)
  const durationSeconds = parsed.durationSeconds || null

  // Transcrever via UAZAPI (a UAZAPI chama Whisper internamente, precisa da openai_apikey)
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY') || ''
  const result = await transcribeAudio({
    serverUrl: uazapiUrl,
    token: uazapiToken,
    messageId: parsed.messageId,
    openaiApiKey,
    durationSeconds,
  })

  const processingTimeMs = Date.now() - startTime

  // Logar processamento
  await logMediaProcessing(supabase, {
    userId,
    messageId: params.message.id,
    mediaType: 'audio',
    status: result.success ? 'completed' : 'failed',
    transcription: result.transcription,
    durationSeconds: result.duration_seconds,
    mimeType: result.mime_type,
    uazapiMessageId: parsed.messageId,
    processingTimeMs,
    errorMessage: result.error,
  })

  if (!result.success || !result.transcription) {
    return {
      text: `🎤 Recebi seu áudio, ${firstName}, mas não consegui transcrever. ${result.error ? 'Tenta mandar de novo?' : 'Pode me mandar por texto?'}`,
      intent: 'audio_transcription_failed',
      confidence: 1.0,
    }
  }

  console.log(`[WA-06] Audio transcribed in ${processingTimeMs}ms: "${result.transcription.substring(0, 100)}"`)

  // Salvar episódio de memória
  saveEpisode(supabase, {
    userId,
    summary: `${firstName} enviou áudio (${result.duration_seconds || '?'}s). Transcrição: "${result.transcription.substring(0, 150)}"`,
    entities: { media_type: 'audio', duration_seconds: result.duration_seconds, transcription_length: result.transcription.length },
    outcome: 'media_processed',
    importance: 0.3,
  }).catch(e => console.error('[WA-06] Episode save error:', e))

  // ========================================
  // VERIFICAR CONTEXTO DE CONFIRMAÇÃO PENDENTE
  // Se o áudio transcrito for "sim/não" e houver contexto ativo,
  // tratar como confirmação (mesmo fluxo do texto)
  // ========================================
  // Normalizar: Whisper retorna "Sim." com ponto e maiúscula — remover pontuação
  const transcribedLower = result.transcription.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()
  console.log(`[WA-06] Transcribed normalized for confirmation check: "${transcribedLower}"`)
  const confirmWords = ['sim', 's', 'yes', 'y', 'confirma', 'confirmo', 'ok', 'pode', 'pode criar', 'manda', 'bora', 'isso']
  const cancelWords = ['não', 'nao', 'n', 'no', 'cancela', 'cancelar', 'deixa', 'esquece', 'para']

  const { data: activeContext } = await supabase
    .from('whatsapp_conversation_context')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeContext?.context_data?.step === 'awaiting_confirmation') {
    const phone = parsed.from

    if (confirmWords.includes(transcribedLower)) {
      // Executar ação confirmada (mesmo fluxo do texto)
      const execResult = await executeConfirmedAction(
        activeContext.context_type,
        {
          supabase,
          profileId: userId,
          authUserId,
          userName: firstName,
          phone,
          entities: activeContext.context_data.entities,
        }
      )

      await supabase
        .from('whatsapp_conversation_context')
        .update({
          is_active: false,
          context_data: {
            ...activeContext.context_data,
            step: execResult.success ? 'executed' : 'execution_failed',
            executed_at: new Date().toISOString(),
            record_id: execResult.record_id || null,
            error: execResult.error || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeContext.id)

      if (execResult.success) {
        saveEpisode(supabase, {
          userId,
          summary: `${firstName} confirmou por áudio ${activeContext.context_type}: "${activeContext.context_data.entities?.title || 'sem título'}".`,
          entities: { action_type: activeContext.context_type, record_id: execResult.record_id, source: 'audio_confirmation' },
          outcome: 'action_completed', importance: 0.6,
        }).catch(e => console.error('[WA-06] Episode save error:', e))
      }

      return {
        text: execResult.message,
        intent: `audio_${activeContext.context_type}_${execResult.success ? 'executed' : 'failed'}`,
        confidence: 1.0,
        metadata: { transcription: result.transcription, record_id: execResult.record_id },
      }
    }

    if (cancelWords.includes(transcribedLower)) {
      await supabase
        .from('whatsapp_conversation_context')
        .update({
          is_active: false,
          context_data: { ...activeContext.context_data, step: 'cancelled_by_user' },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeContext.id)

      return {
        text: `❌ Cancelado, ${firstName}! Se precisar de algo, é só falar.`,
        intent: `audio_${activeContext.context_type}_cancelled`,
        confidence: 1.0,
        metadata: { transcription: result.transcription },
      }
    }
  }

  // ========================================
  // SEM CONTEXTO PENDENTE — processar normalmente via NLP
  // ========================================
  const textParsed = { ...parsed, text: result.transcription, type: 'text' }
  const textParams = { ...params, parsed: textParsed }

  // Carregar memória
  let memoryPrompt = ''
  const memory = await loadMemoryContext(supabase, userId)
  if (memory) {
    memoryPrompt = formatMemoryForPrompt(memory)
  }

  // Classificar o texto transcrito
  const classification = await classifyMessage(result.transcription, firstName, undefined, memoryPrompt)

  // Rotear pela intenção classificada
  // A transcrição é interna — o usuário recebe apenas a resposta natural
  const response = await routeClassifiedMessage(classification, textParams, firstName, userId, authUserId, memoryPrompt)

  return {
    text: response.text || '',
    intent: `audio_${response.intent}`,
    confidence: response.confidence,
    metadata: { ...response.metadata, transcription: result.transcription, audio_duration: result.duration_seconds },
  }
}

// ============================================
// WA-06: HANDLER DE IMAGEM
// ============================================

async function handleImageMessage(
  params: RouteMessageParams,
  firstName: string,
  userId: string,
): Promise<MessageResponse> {
  const { supabase, user, parsed, uazapiUrl, uazapiToken } = params
  const startTime = Date.now()
  const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''

  if (!parsed.messageId) {
    console.error('[WA-06] No messageId for image download')
    return {
      text: `📸 Recebi sua imagem, ${firstName}, mas não consegui processá-la. Tenta mandar de novo?`,
      intent: 'image_error',
      confidence: 1.0,
    }
  }

  if (!geminiKey) {
    console.error('[WA-06] GEMINI_API_KEY not configured')
    return {
      text: `📸 Recebi sua imagem, ${firstName}! Mas a análise de imagens ainda não está configurada.`,
      intent: 'image_not_configured',
      confidence: 1.0,
    }
  }

  // Analisar imagem via UAZAPI + Gemini 3 Flash Preview
  const result = await analyzeImage({
    serverUrl: uazapiUrl,
    token: uazapiToken,
    geminiKey,
    messageId: parsed.messageId,
    caption: parsed.text,
    userName: firstName,
  })

  const processingTimeMs = Date.now() - startTime

  // Logar processamento
  await logMediaProcessing(supabase, {
    userId,
    messageId: params.message.id,
    mediaType: 'image',
    status: result.success ? 'completed' : 'failed',
    imageAnalysis: result.success ? {
      description: result.description,
      suggested_action: result.suggested_action,
      suggested_entities: result.suggested_entities,
    } : null,
    suggestedAction: result.suggested_action,
    suggestedEntities: result.suggested_entities,
    mimeType: result.mime_type,
    uazapiMessageId: parsed.messageId,
    processingTimeMs,
    errorMessage: result.error,
  })

  if (!result.success) {
    return {
      text: `📸 Recebi sua imagem, ${firstName}, mas não consegui analisar. ${result.error ? 'Tenta mandar de novo?' : 'Pode descrever por texto?'}`,
      intent: 'image_analysis_failed',
      confidence: 1.0,
    }
  }

  console.log(`[WA-06] Image analyzed in ${processingTimeMs}ms: action=${result.suggested_action}`)

  // Salvar episódio de memória
  saveEpisode(supabase, {
    userId,
    summary: `${firstName} enviou imagem${parsed.text ? ` com legenda "${parsed.text.substring(0, 80)}"` : ''}. Análise: ${result.description?.substring(0, 100)}`,
    entities: { media_type: 'image', suggested_action: result.suggested_action, has_caption: !!parsed.text },
    outcome: 'media_processed',
    importance: 0.4,
  }).catch(e => console.error('[WA-06] Episode save error:', e))

  // Montar resposta baseada na ação sugerida
  const ents = result.suggested_entities || {}

  if (result.suggested_action === 'create_card' && ents.title) {
    // Sugerir criação de card com base na análise
    const parts: string[] = [
      `📸 *Analisei sua imagem!*\n`,
      `📝 ${result.description}\n`,
      `Parece ser uma referência de conteúdo. Quer que eu crie um card?\n`,
    ]
    if (ents.title) parts.push(`📝 Título: *${ents.title}*`)
    if (ents.content_type) parts.push(`🎬 Tipo: *${ents.content_type}*`)
    if (ents.priority) parts.push(`⚡ Prioridade: *${ents.priority}*`)
    if (ents.notes) parts.push(`💡 ${ents.notes}`)
    parts.push('\n✅ Confirma? (sim/não)')

    // Salvar contexto para confirmação
    await saveConversationContextForMedia(supabase, userId, 'creating_card', {
      step: 'awaiting_confirmation',
      entities: {
        title: ents.title,
        content_type: ents.content_type || null,
        priority: ents.priority || 'medium',
        description: result.description,
        source: 'image_analysis',
      },
      classified_at: new Date().toISOString(),
    })

    return {
      text: parts.join('\n'),
      intent: 'image_create_card_suggestion',
      confidence: 0.8,
      metadata: { image_analysis: result.description, suggested_entities: ents },
    }
  }

  if (result.suggested_action === 'create_calendar' && ents.title) {
    const parts: string[] = [
      `📸 *Analisei sua imagem!*\n`,
      `📝 ${result.description}\n`,
      `Parece ser algo para agendar. Quer que eu crie um evento?\n`,
    ]
    if (ents.title) parts.push(`📝 Título: *${ents.title}*`)
    if (ents.notes) parts.push(`💡 ${ents.notes}`)
    parts.push('\n✅ Confirma? (sim/não)')

    await saveConversationContextForMedia(supabase, userId, 'creating_calendar', {
      step: 'awaiting_confirmation',
      entities: {
        title: ents.title,
        description: result.description,
        source: 'image_analysis',
      },
      classified_at: new Date().toISOString(),
    })

    return {
      text: parts.join('\n'),
      intent: 'image_create_calendar_suggestion',
      confidence: 0.7,
      metadata: { image_analysis: result.description, suggested_entities: ents },
    }
  }

  // Ação geral ou nenhuma — apenas descrever
  const caption = parsed.text ? `\n📝 Legenda: _"${parsed.text}"_` : ''
  return {
    text: `📸 *Analisei sua imagem!*\n\n${result.description}${caption}\n\nSe quiser que eu faça algo com isso, me diz! 😉`,
    intent: 'image_analyzed',
    confidence: 0.9,
    metadata: { image_analysis: result.description },
  }
}

// ============================================
// WA-06: ROTEAMENTO PÓS-CLASSIFICAÇÃO (áudio transcrito)
// ============================================

async function routeClassifiedMessage(
  classification: ClassificationResult,
  params: RouteMessageParams,
  firstName: string,
  userId: string,
  authUserId: string,
  _memoryPrompt: string,
): Promise<MessageResponse> {
  const { supabase } = params

  // Reutilizar a lógica de roteamento por intenção (mesma do routeMessage)
  switch (classification.intent) {
    case 'create_card':
      return handleCreateCard(classification, firstName, supabase, userId)
    case 'create_calendar':
      return handleCreateCalendar(classification, firstName, supabase, userId)
    case 'create_reminder':
      return handleCreateReminder(classification, firstName, supabase, userId)
    case 'query_calendar': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryCalendar(qCtx)
      return { text: result.text, intent: 'query_calendar', confidence: classification.confidence }
    }
    case 'query_cards': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryCards(qCtx)
      return { text: result.text, intent: 'query_cards', confidence: classification.confidence }
    }
    case 'query_projects': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleQueryProjects(qCtx)
      return { text: result.text, intent: 'query_projects', confidence: classification.confidence }
    }
    case 'generate_report': {
      const qCtx = { supabase, profileId: userId, authUserId, userName: firstName, entities: classification.entities }
      const result = await handleGenerateReport(qCtx)
      return { text: result.text, intent: 'generate_report', confidence: classification.confidence }
    }
    case 'help':
      return { text: getHelpText(), intent: 'help', confidence: 1.0 }
    case 'general_chat':
      return { text: classification.response_text, intent: 'general_chat', confidence: classification.confidence }
    default:
      return {
        text: classification.response_text || `Não entendi bem, ${firstName}. Pode reformular?`,
        intent: classification.intent || 'unknown',
        confidence: classification.confidence,
      }
  }
}

// ============================================
// WA-06: LOG DE PROCESSAMENTO DE MÍDIA
// ============================================

// deno-lint-ignore no-explicit-any
async function logMediaProcessing(supabase: any, data: {
  userId: string
  messageId: string
  mediaType: string
  status: string
  transcription?: string | null
  imageAnalysis?: Record<string, unknown> | null
  suggestedAction?: string | null
  suggestedEntities?: Record<string, unknown> | null
  durationSeconds?: number | null
  fileSizeBytes?: number | null
  mimeType?: string | null
  uazapiMessageId?: string | null
  processingTimeMs?: number | null
  errorMessage?: string | null
}): Promise<void> {
  try {
    const { error } = await supabase
      .from('wa_media_processing_log')
      .insert({
        user_id: data.userId,
        message_id: data.messageId,
        media_type: data.mediaType,
        processing_status: data.status,
        transcription: data.transcription || null,
        image_analysis: data.imageAnalysis || null,
        suggested_action: data.suggestedAction || null,
        suggested_entities: data.suggestedEntities || null,
        duration_seconds: data.durationSeconds || null,
        file_size_bytes: data.fileSizeBytes || null,
        mime_type: data.mimeType || null,
        uazapi_message_id: data.uazapiMessageId || null,
        processing_time_ms: data.processingTimeMs || null,
        error_message: data.errorMessage || null,
        completed_at: data.status === 'completed' ? new Date().toISOString() : null,
      })

    if (error) {
      console.error('[WA-06] Media log insert error:', error)
    }
  } catch (err) {
    console.error('[WA-06] Media log fatal error:', err)
  }
}

// ============================================
// WA-06: CONTEXTO DE CONVERSA PARA MÍDIA
// ============================================

// deno-lint-ignore no-explicit-any
async function saveConversationContextForMedia(
  supabase: any,
  userId: string,
  contextType: string,
  contextData: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('whatsapp_conversation_context')
      .upsert(
        {
          user_id: userId,
          context_type: contextType,
          context_data: contextData,
          is_active: true,
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,context_type' }
      )

    if (error) {
      console.error('[WA-06] Context upsert error:', JSON.stringify(error))
    }
  } catch (error) {
    console.error('[WA-06] Error saving media context:', error)
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
