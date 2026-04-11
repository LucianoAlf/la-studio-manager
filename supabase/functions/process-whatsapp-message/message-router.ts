// ============================================
// Message Router — WA-04 (memória + consultas) + WA-06 (áudio/imagem)
// ============================================
// WA-02: Classifica intenção via Gemini e responde com confirmação
// WA-03: Executa ações reais após confirmação (INSERT no banco)
// WA-04: Sistema de memória + consultas reais ao banco
// WA-06: Processamento de áudio (transcrição) e imagem (Vision)

import { classifyMessage, getHelpText } from './gemini-classifier.ts'
import { executeConfirmedAction, checkCalendarConflicts } from './action-executor.ts'
import { loadMemoryContext, formatMemoryForPrompt, saveEpisode, learnFact } from './memory-manager.ts'
import { handleQueryCalendar, handleQueryCards, handleQueryProjects, handleGenerateReport } from './query-handler.ts'
import { transcribeAudio } from './audio-handler.ts'
import { analyzeImage } from './image-handler.ts'
import { getPendingAction, clearPendingAction, savePendingAction, processFollowUpResponse, smartProcessFollowUp } from './followup-handler.ts'
import type { PendingAction } from './followup-handler.ts'
import { generateFollowUp, getMissingFields, buildPartialSummary } from './mike-personality.ts'
import { getEventConfirmation, processParticipantResponse, notifyParticipants, notifyParticipantsOfChange, parseParticipantNames, findParticipantByName, getPendingParticipantPhone, processPhoneResponse, savePendingParticipantPhone, getPendingSaveContact, processSaveContactResponse, saveContact, queryContacts, linkPendingEventConfirmationsToEvent } from './participant-notifier.ts'
import type { PendingParticipantPhone } from './participant-notifier.ts'
import { sendTextMessage } from './send-message.ts'
import type { ClassificationResult } from './gemini-classifier.ts'
import type { RouteMessageParams, MessageResponse } from './types.ts'

export async function routeMessage(params: RouteMessageParams): Promise<MessageResponse> {
  const { supabase, user, parsed } = params
  const firstName = user.display_name || user.full_name.split(' ')[0]
  const userId = user.profile_id
  const authUserId = user.auth_user_id
  const phone = parsed.from

  async function notifyKnownParticipantsAfterEventCreation(entities: Record<string, unknown>, eventId: string): Promise<string[]> {
    if (!eventId || !entities.participants) return []

    const participantNames = parseParticipantNames(entities.participants as string | string[])
    const knownParticipants: string[] = []

    for (const participantName of participantNames) {
      const found = await findParticipantByName(supabase, participantName)
      if (found && found.id !== userId) {
        knownParticipants.push(participantName)
      }
    }

    if (knownParticipants.length === 0) return []

    const notifyResults = await notifyParticipants(supabase, params.uazapiUrl, params.uazapiToken, {
      eventId,
      eventTitle: (entities.title as string) || 'Evento',
      eventDate: (entities.date as string) || '',
      eventTime: (entities.time as string) || null,
      eventLocation: (entities.location as string) || null,
      creatorUserId: userId,
      creatorName: firstName,
      creatorPhone: user.phone_number,
      participantNames: knownParticipants,
      groupJid: params.groupJid || null,
    })

    return notifyResults.filter((result) => result.notified).map((result) => result.participantName)
  }

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
  // WA-06.6: VERIFICAR CONFIRMAÇÃO DE EVENTO (PARTICIPANTE)
  // Se o Mike mandou "Confirma presença? (sim/não)" para um participante,
  // a próxima mensagem desse participante é a resposta.
  // Prioridade MÁXIMA — antes de follow-up e NLP.
  // ========================================
  const eventConfirmation = await getEventConfirmation(supabase, userId)

  if (eventConfirmation) {
    console.log(`[NOTIFY] Resposta de confirmação de ${firstName} para evento "${eventConfirmation.eventTitle}"`)

    const responseResult = await processParticipantResponse(
      supabase,
      params.uazapiUrl,
      params.uazapiToken,
      eventConfirmation,
      parsed.text
    )

    let intent = 'event_confirmation_ambiguous'
    if (responseResult.confirmed) intent = 'event_confirmed'
    else if (responseResult.declined) intent = 'event_declined'

    return {
      text: responseResult.message,
      intent,
      confidence: 1.0,
    }
  }

  // ========================================
  // WA-06.8: VERIFICAR NÚMERO PENDENTE DE PARTICIPANTE NÃO CADASTRADO
  // Se o Mike pediu o número de um participante, a próxima mensagem é o número.
  // Prioridade: após event_confirmation, antes de follow-up e NLP.
  // NOTA: Se existe contexto awaiting_participant_phone, o handler abaixo trata (cria evento depois)
  // ========================================
  const pendingPhone = await getPendingParticipantPhone(supabase, userId)
  if (pendingPhone) {
    // Verificar se NÃO estamos no fluxo de pré-criação (awaiting_participant_phone)
    // Nesse caso, o handler de contexto abaixo vai processar e criar o evento
    const { data: calCtx } = await supabase
      .from('whatsapp_conversation_context')
      .select('context_data')
      .eq('user_id', userId)
      .eq('is_active', true)
      .eq('context_type', 'creating_calendar')
      .maybeSingle()

    const isPreCreationFlow = calCtx?.context_data?.step === 'awaiting_participant_phone'

    if (!isPreCreationFlow) {
      console.log(`[NOTIFY-PHONE] Resposta de número para ${pendingPhone.participantName} de ${firstName}`)
      const phoneResult = await processPhoneResponse(
        supabase, params.uazapiUrl, params.uazapiToken,
        pendingPhone, parsed.text
      )
      if (phoneResult.handled) {
        return {
          text: phoneResult.message,
          intent: 'pending_participant_phone_response',
          confidence: 1.0,
        }
      }
    }
  }

  // ========================================
  // WA-06.8: VERIFICAR "QUER SALVAR NA AGENDA?"
  // Se o Mike perguntou se quer salvar contato na agenda, processar resposta.
  // ========================================
  const pendingSave = await getPendingSaveContact(supabase, userId)
  if (pendingSave) {
    console.log(`[CONTACTS] Resposta de salvar contato: ${pendingSave.contactName} de ${firstName}`)
    const saveResult = await processSaveContactResponse(supabase, pendingSave, parsed.text, authUserId)
    if (saveResult.handled) {
      return {
        text: saveResult.message,
        intent: 'pending_save_contact_response',
        confidence: 1.0,
      }
    }
  }

  // ========================================
  // WA-06.5: VERIFICAR FOLLOW-UP PENDENTE
  // Se o Mike fez uma pergunta (ex: "Que horas?"), a próxima mensagem
  // do usuário é a resposta — não deve ir pro NLP como mensagem nova.
  // ========================================
  const pending = await getPendingAction(supabase, userId)

  if (pending) {
    console.log(`[FOLLOWUP] Ação pendente: ${pending.action}, aguardando: ${pending.waitingForField}`)

    // WA-06.8: Buscar membros da equipe para resolver "eu", nomes, etc.
    const { data: teamData } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('is_active', true)
    const teamMembers = (teamData || []).map((u: { full_name: string }) => u.full_name)

    // WA-06.8: Smart Follow-up — usa Gemini para respostas complexas
    const followUpResult = await smartProcessFollowUp(pending, parsed.text, firstName, teamMembers)

    if (!followUpResult) {
      // Cancelou ou mudou de assunto — limpar e continuar fluxo normal
      await clearPendingAction(supabase, userId)
      console.log('[FOLLOWUP] Cancelado ou mudou de assunto')

      // Se cancelou explicitamente, responder e parar
      const lower = parsed.text.toLowerCase().trim()
      const isCancelWord = ['cancelar', 'cancela', 'deixa', 'esquece', 'deixa pra la', 'deixa pra lá', 'nao quero', 'não quero', 'para', 'parar'].includes(lower)
      if (isCancelWord) {
        return {
          text: 'Ok, cancelei.',
          intent: 'followup_cancelled',
          confidence: 1.0,
        }
      }
      // Mudou de assunto — cair no fluxo normal (NLP vai classificar)
    } else if (followUpResult.complete) {
      // Todos os dados coletados — ir pro fluxo de confirmação
      await clearPendingAction(supabase, userId)
      console.log('[FOLLOWUP] Dados completos:', JSON.stringify(followUpResult.entities))

      // Salvar contexto de confirmação (mesmo fluxo do WA-02/03)
      const contextType = pending.action === 'create_calendar' ? 'creating_calendar'
        : pending.action === 'create_reminder' ? 'creating_reminder'
        : 'creating_card'
      await saveConversationContext(supabase, userId, contextType, {
        step: 'awaiting_confirmation',
        entities: followUpResult.entities,
        classified_at: new Date().toISOString(),
      })

      // Montar mensagem de confirmação no tom Mike
      const confirmMsg = buildConfirmationMessage(pending.action, followUpResult.entities)
      return {
        text: confirmMsg,
        intent: `followup_${pending.action}_complete`,
        confidence: 1.0,
      }
    } else {
      // Ainda falta campo — atualizar ação pendente e perguntar próximo
      const updatedPending: PendingAction = {
        ...pending,
        entities: followUpResult.entities,
        missingFields: pending.missingFields.filter(f => f !== pending.waitingForField),
        currentQuestion: followUpResult.nextQuestion!,
        waitingForField: followUpResult.nextField!,
      }
      await savePendingAction(supabase, userId, updatedPending)

      return {
        text: followUpResult.nextQuestion!,
        intent: `followup_asking_${followUpResult.nextField}`,
        confidence: 1.0,
      }
    }
  }

  // ========================================
  // VERIFICAR CONTEXTO ATIVO (sim/não)
  // Excluir group_session e pending_action (tratados separadamente)
  // ========================================
  let conversationContext: string | undefined

  const { data: activeContext } = await supabase
    .from('whatsapp_conversation_context')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .not('context_type', 'in', '("group_session","pending_action")')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // DEBUG: Logar contexto encontrado
  if (activeContext) {
    console.log(`[DEBUG] Contexto ativo encontrado: ${activeContext.context_type}, step: ${activeContext.context_data?.step}`)
  } else {
    console.log(`[DEBUG] Nenhum contexto ativo encontrado para user ${userId}`)
  }

  // ========================================
  // WA-06.9: PARTICIPANTE RECUSOU — criador decide se mantém evento
  // ========================================
  if (activeContext?.context_type === 'awaiting_decline_decision') {
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()
    const isYes = ['sim', 's', 'yes', 'y', 'pode', 'ok', 'bora', 'mantém', 'mantem', 'manter', 'quero', 'isso'].includes(lower)
    const isNo = ['não', 'nao', 'n', 'no', 'cancela', 'deixa', 'esquece', 'remove', 'deleta', 'apaga'].includes(lower)

    const declineData = activeContext.context_data || {}

    if (isYes) {
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)
      return {
        text: `Ok, mantive o evento *${declineData.eventTitle}* na agenda. ${declineData.participantName} não vai participar, mas o evento segue! 👍`,
        intent: 'decline_decision_keep',
        confidence: 1.0,
      }
    }

    if (isNo) {
      // Deletar o evento do calendário
      if (declineData.eventId) {
        await supabase
          .from('calendar_items')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', declineData.eventId)
      }
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)
      return {
        text: `Ok, removi o evento *${declineData.eventTitle}* da agenda.`,
        intent: 'decline_decision_remove',
        confidence: 1.0,
      }
    }

    // Resposta ambígua — re-perguntar
    return {
      text: `${declineData.participantName} recusou a *${declineData.eventTitle}*. Quer manter o evento mesmo assim? (sim/não)`,
      intent: 'decline_decision_ambiguous',
      confidence: 1.0,
    }
  }

  // ========================================
  // WA-06.8: CONFLITO DE HORÁRIO — aguardando "quer marcar mesmo assim?"
  // ========================================
  if (activeContext?.context_data?.step === 'awaiting_conflict_confirmation') {
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()
    const isYes = ['sim', 's', 'yes', 'y', 'pode', 'ok', 'bora', 'marca', 'confirma', 'isso', 'quero', 'manda'].includes(lower)
    const isNo = ['não', 'nao', 'n', 'no', 'cancela', 'deixa', 'esquece', 'desculpa', 'foi mal', 'não precisa', 'nao precisa'].includes(lower)

    if (isNo) {
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, context_data: { ...activeContext.context_data, step: 'cancelled_conflict' }, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)
      return { text: `Ok, cancelei. Se precisar de outra coisa, só avisar.`, intent: 'conflict_cancelled', confidence: 1.0 }
    }

    if (isYes) {
      // Verificar TODOS os participantes de uma vez (suporte a múltiplos)
      const ents = activeContext.context_data?.entities || {}
      if (ents.participants) {
        const participantNames = parseParticipantNames(ents.participants as string)
        const notFoundNames: string[] = []
        for (const pName of participantNames) {
          const found = await findParticipantByName(supabase, pName)
          if (!found) notFoundNames.push(pName)
        }

        if (notFoundNames.length > 0) {
          const currentName = notFoundNames[0]
          const remainingQueue = notFoundNames.slice(1)

          const pendingPhoneData: PendingParticipantPhone = {
            type: 'pending_participant_phone',
            participantName: currentName,
            eventId: '',
            eventTitle: (ents.title as string) || 'Evento',
            eventDate: (ents.date as string) || '',
            eventTime: (ents.time as string) || null,
            eventLocation: (ents.location as string) || null,
            creatorUserId: userId,
            creatorName: firstName,
            creatorPhone: user.phone_number,
            groupJid: params.groupJid || null,
          }
          await savePendingParticipantPhone(supabase, userId, pendingPhoneData)
          await supabase
            .from('whatsapp_conversation_context')
            .update({
              context_data: {
                ...activeContext.context_data,
                step: 'awaiting_participant_phone',
                pending_participants_queue: remainingQueue,
                resolved_participants: [],
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeContext.id)

          const queueMsg = remainingQueue.length > 0
            ? `\n\n_(Depois vou pedir o número de: ${remainingQueue.join(', ')})_`
            : ''

          return { text: `${currentName} não está cadastrado. Me passa o WhatsApp dele pra eu notificar? (manda o número com DDD ou "não" pra pular)${queueMsg}`, intent: 'pending_participant_phone', confidence: 1.0 }
        }
      }

      // Sem problemas de participante — criar evento
      await supabase
        .from('whatsapp_conversation_context')
        .update({ context_data: { ...activeContext.context_data, step: 'awaiting_confirmation' }, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)
      // Redirecionar para o fluxo normal de confirmação (recursão controlada)
      const result = await executeConfirmedAction(activeContext.context_type, { supabase, profileId: userId, authUserId, userName: firstName, phone, entities: ents, uazapiUrl: params.uazapiUrl, uazapiToken: params.uazapiToken })
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, context_data: { ...activeContext.context_data, step: result.success ? 'executed' : 'execution_failed', executed_at: new Date().toISOString(), record_id: result.record_id || null }, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)

      // Notificar participantes cadastrados após criar
      if (result.success && ents.participants) {
        const participantNames = parseParticipantNames(ents.participants as string)
        if (participantNames.length > 0) {
          const notifyResults = await notifyParticipants(supabase, params.uazapiUrl, params.uazapiToken, {
            eventId: result.record_id || '', eventTitle: (ents.title as string) || 'Evento', eventDate: (ents.date as string) || '',
            eventTime: (ents.time as string) || null, eventLocation: (ents.location as string) || null,
            creatorUserId: userId, creatorName: firstName, creatorPhone: user.phone_number, participantNames, groupJid: params.groupJid || null,
          })
          const notified = notifyResults.filter(r => r.notified)
          if (notified.length > 0) result.message += `\nNotifiquei ${notified.map(r => r.participantName).join(', ')} pelo WhatsApp.`
        }
      }

      return { text: result.message, intent: result.success ? 'creating_calendar_executed' : 'creating_calendar_failed', confidence: 1.0 }
    }

    // Resposta ambígua
    return { text: `Não entendi. Quer marcar a reunião mesmo assim? (sim/não)`, intent: 'conflict_warning', confidence: 1.0 }
  }

  // ========================================
  // WA-06.8: PARTICIPANTE NÃO CADASTRADO — aguardando número (contexto creating_calendar ativo)
  // Após receber número: envia convite → NÃO cria evento → espera confirmação do participante
  // ========================================
  if (activeContext?.context_data?.step === 'awaiting_participant_phone') {
    const pendingPhone = await getPendingParticipantPhone(supabase, userId)
    if (pendingPhone) {
      const phoneResult = await processPhoneResponse(supabase, params.uazapiUrl, params.uazapiToken, pendingPhone, parsed.text)
      if (phoneResult.handled) {
        const lower = parsed.text.trim().toLowerCase()
        const firstWord = lower.split(/[\s.,!?;:]+/)[0]
        const isSkip = ['não', 'nao', 'n', 'no', 'deixa', 'esquece', 'cancela'].includes(lower) || ['não', 'nao', 'no', 'n'].includes(firstWord)
        const ents = activeContext.context_data?.entities || {}
        const pName = pendingPhone.participantName
        const queue: string[] = activeContext.context_data?.pending_participants_queue || []
        const resolved: string[] = activeContext.context_data?.resolved_participants || []

        // Adicionar participante atual à lista de resolvidos (se não pulou)
        if (!isSkip) {
          resolved.push(pName)
        }

        // Verificar se há mais participantes na fila
        if (queue.length > 0) {
          const nextName = queue[0]
          const remainingQueue = queue.slice(1)

          // Salvar pending_participant_phone para o próximo
          const nextPendingData: PendingParticipantPhone = {
            type: 'pending_participant_phone',
            participantName: nextName,
            eventId: '',
            eventTitle: (ents.title as string) || 'Evento',
            eventDate: (ents.date as string) || '',
            eventTime: (ents.time as string) || null,
            eventLocation: (ents.location as string) || null,
            creatorUserId: userId,
            creatorName: firstName,
            creatorPhone: user.phone_number,
            groupJid: params.groupJid || null,
          }
          await savePendingParticipantPhone(supabase, userId, nextPendingData)

          await supabase
            .from('whatsapp_conversation_context')
            .update({
              context_data: {
                ...activeContext.context_data,
                step: 'awaiting_participant_phone',
                pending_participants_queue: remainingQueue,
                resolved_participants: resolved,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeContext.id)

          const queueMsg = remainingQueue.length > 0
            ? `\n\n_(Depois vou pedir o número de: ${remainingQueue.join(', ')})_`
            : ''

          return {
            text: `${phoneResult.message}\n\nAgora, ${nextName} também não está cadastrado. Me passa o WhatsApp dele? (número com DDD ou "não" pra pular)${queueMsg}`,
            intent: 'pending_participant_phone',
            confidence: 1.0,
          }
        }

        const result = await executeConfirmedAction(activeContext.context_type, { supabase, profileId: userId, authUserId, userName: firstName, phone, entities: ents, uazapiUrl: params.uazapiUrl, uazapiToken: params.uazapiToken })

        await supabase
          .from('whatsapp_conversation_context')
          .update({
            is_active: false,
            context_data: {
              ...activeContext.context_data,
              step: result.success ? 'executed_with_pending_confirmations' : 'execution_failed',
              executed_at: new Date().toISOString(),
              record_id: result.record_id || null,
              pending_external_confirmations: resolved,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeContext.id)

        if (!result.success) {
          return { text: `${phoneResult.message}\n\n${result.message}`, intent: 'creating_calendar_failed', confidence: 1.0 }
        }

        if (resolved.length > 0 && result.record_id) {
          await linkPendingEventConfirmationsToEvent(supabase, userId, resolved, result.record_id)
        }

        const notifiedKnownParticipants = await notifyKnownParticipantsAfterEventCreation(ents, result.record_id || '')

        let responseText = `${phoneResult.message}\n\n${result.message}`

        if (notifiedKnownParticipants.length > 0) {
          responseText += `\nAvisei ${notifiedKnownParticipants.join(', ')} pelo WhatsApp.`
        }

        if (resolved.length > 0) {
          responseText += `\nFico aguardando só a confirmação de ${resolved.join(', ')} por fora. Se ele responder, eu te aviso.`
        }

        return { text: responseText, intent: 'creating_calendar_executed', confidence: 1.0 }
      }
    }
  }

  // ========================================
  // WA-06.8: AGUARDANDO CONFIRMAÇÃO EXTERNA do participante não cadastrado
  // Criador diz "ele confirmou" / "pode agendar" → criar evento
  // ========================================
  if (activeContext?.context_data?.step === 'awaiting_external_confirmation') {
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()
    const pName = activeContext.context_data?.notified_participant || ''

    // Verificar se é resposta de salvar na agenda (sim/não para pending_save_contact)
    const pendingSave = await getPendingSaveContact(supabase, userId)
    if (pendingSave) {
      const saveResult = await processSaveContactResponse(supabase, pendingSave, parsed.text, authUserId)
      if (saveResult.handled) {
        return { text: saveResult.message, intent: 'pending_save_contact_response', confidence: 1.0 }
      }
    }

    // Detectar confirmação do participante — patterns EXATOS para evitar falsos positivos
    // "Marcou com os outros?" NÃO deve ser interpretado como confirmação
    const confirmExact = ['sim', 's', 'ok', 'bora', 'manda', 'pode agendar', 'pode marcar', 'agenda', 'marca']
    const confirmIncludes = ['confirmou', 'confirmaram', 'ele confirmou', 'ela confirmou', 'aceitou', 'topou', 'tá confirmado', 'ta confirmado']
    const cancelPatterns = [
      'não', 'nao', 'cancela', 'deixa', 'esquece', 'não vai', 'nao vai',
      'recusou', 'não pode', 'nao pode', 'desistiu',
    ]

    const isConfirm = confirmExact.includes(lower) || confirmIncludes.some(p => lower.includes(p))
    const isCancel = cancelPatterns.some(p => lower === p || lower.includes(p))

    if (isCancel) {
      return { text: 'Beleza. O evento segue mantido; só não vou esperar a confirmação pendente aqui no chat.', intent: 'external_confirmation_dismissed', confidence: 1.0 }
    }

    if (isConfirm) {
      return { text: 'Perfeito. O evento já está mantido na agenda e eu te aviso assim que a confirmação externa chegar.', intent: 'external_confirmation_registered', confidence: 1.0 }
    }

    // Resposta não reconhecida — lembrar que está aguardando
    const notifiedList: string[] = activeContext.context_data?.notified_participants || (pName ? [pName] : [])
    const waitingMsg = notifiedList.length > 1
      ? `Ainda aguardando confirmação de: ${notifiedList.join(', ')}. Quando confirmarem, me diz: *"confirmaram"* ou *"cancela"*.`
      : `Ainda aguardando a confirmação do ${pName}. Quando ele responder, me diz: *"${pName} confirmou"* ou *"cancela"*.`
    return {
      text: waitingMsg,
      intent: 'awaiting_external_confirmation',
      confidence: 1.0,
    }
  }

  if (activeContext?.context_data?.step === 'awaiting_confirmation') {
    console.log(`[DEBUG] Processando awaiting_confirmation para ${activeContext.context_type}`)
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()

    // --- CONFIRMOU: SIM → executar ação real (WA-03) ---
    if (['sim', 's', 'yes', 'y', 'confirma', 'confirmo', 'ok', 'pode', 'pode criar', 'manda', 'bora', 'isso'].includes(lower)) {
      console.log(`[DEBUG] Confirmação detectada: "${lower}". Executando ${activeContext.context_type}`)

      const ents = activeContext.context_data?.entities || {}

      // ========================================
      // WA-06.8: PRÉ-VERIFICAÇÕES para creating_calendar (ANTES de criar)
      // 1. Verificar conflitos de horário
      // 2. Verificar se participante está cadastrado
      // ========================================
      if (activeContext.context_type === 'creating_calendar') {
        // 1. Verificar conflitos
        const conflictCheck = await checkCalendarConflicts(supabase, authUserId, ents)
        if (conflictCheck.hasConflict) {
          // Salvar contexto de conflito pendente — NÃO criar evento ainda
          await supabase
            .from('whatsapp_conversation_context')
            .update({
              context_data: {
                ...activeContext.context_data,
                step: 'awaiting_conflict_confirmation',
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeContext.id)

          return {
            text: conflictCheck.conflictMessage,
            intent: 'conflict_warning',
            confidence: 1.0,
          }
        }

        // 2. Verificar TODOS os participantes de uma vez (suporte a múltiplos)
        if (ents.participants) {
          const participantNames = parseParticipantNames(ents.participants as string)
          const notFoundNames: string[] = []
          for (const pName of participantNames) {
            const found = await findParticipantByName(supabase, pName)
            if (!found) notFoundNames.push(pName)
          }

          if (notFoundNames.length > 0) {
            // Pedir número do PRIMEIRO não cadastrado, guardar fila dos demais
            const currentName = notFoundNames[0]
            const remainingQueue = notFoundNames.slice(1)

            const pendingPhoneData: PendingParticipantPhone = {
              type: 'pending_participant_phone',
              participantName: currentName,
              eventId: '',
              eventTitle: (ents.title as string) || 'Evento',
              eventDate: (ents.date as string) || '',
              eventTime: (ents.time as string) || null,
              eventLocation: (ents.location as string) || null,
              creatorUserId: userId,
              creatorName: firstName,
              creatorPhone: user.phone_number,
              groupJid: params.groupJid || null,
            }
            await savePendingParticipantPhone(supabase, userId, pendingPhoneData)

            await supabase
              .from('whatsapp_conversation_context')
              .update({
                context_data: {
                  ...activeContext.context_data,
                  step: 'awaiting_participant_phone',
                  pending_participants_queue: remainingQueue,
                  resolved_participants: [],
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', activeContext.id)

            const queueMsg = remainingQueue.length > 0
              ? `\n\n_(Depois vou pedir o número de: ${remainingQueue.join(', ')})_`
              : ''

            return {
              text: `${currentName} não está cadastrado no sistema. Me passa o WhatsApp dele pra eu notificar? (manda o número com DDD ou "não" pra pular)${queueMsg}`,
              intent: 'pending_participant_phone',
              confidence: 1.0,
            }
          }
        }
      }

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
          uazapiUrl: params.uazapiUrl,
          uazapiToken: params.uazapiToken,
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

        // ========================================
        // WA-06.6: NOTIFICAR PARTICIPANTES CADASTRADOS APÓS CRIAR EVENTO
        // Participantes não cadastrados já foram tratados ANTES de criar (pré-verificação)
        // ========================================
        if (result.success && activeContext.context_type === 'creating_calendar' && ents.participants) {
          const participantNames = parseParticipantNames(ents.participants as string)

          if (participantNames.length > 0) {
            console.log(`[NOTIFY] Notificando participantes: ${participantNames.join(', ')}`)

            const notifyResults = await notifyParticipants(supabase, params.uazapiUrl, params.uazapiToken, {
              eventId: result.record_id || '',
              eventTitle: (ents.title as string) || 'Evento',
              eventDate: (ents.date as string) || '',
              eventTime: (ents.time as string) || null,
              eventLocation: (ents.location as string) || null,
              creatorUserId: userId,
              creatorName: firstName,
              creatorPhone: user.phone_number,
              participantNames,
              groupJid: params.groupJid || null,
            })

            const notified = notifyResults.filter(r => r.notified)
            if (notified.length > 0) {
              const names = notified.map(r => r.participantName).join(', ')
              result.message += `\nNotifiquei ${names} pelo WhatsApp.`
            }
          }
        }

        // ========================================
        // WA-09.2: NOTIFICAR PARTICIPANTES APÓS ALTERAR/CANCELAR EVENTO
        // Extrai nomes do título do evento e envia DM avisando da mudança
        // ========================================
        if (result.success && (activeContext.context_type === 'updating_calendar' || activeContext.context_type === 'cancelling_calendar')) {
          try {
            const eventTitle = (ents.event_title as string) || ''
            const eventDate = ents.event_start_time
              ? new Date(ents.event_start_time as string).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              : ''
            const changeType = activeContext.context_type === 'updating_calendar' ? 'update' : 'cancel'
            const changeDescription = (ents.change_description as string) || 'Alterações aplicadas.'

            const messageToParticipant = (ents.message_to_participant as string) || null

            const { notifiedNames } = await notifyParticipantsOfChange(supabase, params.uazapiUrl, params.uazapiToken, {
              eventTitle,
              eventDate,
              changeType,
              changeDescription,
              creatorName: firstName,
              creatorUserId: userId,
              messageToParticipant,
            })

            if (notifiedNames.length > 0) {
              result.message += `\nAvisei ${notifiedNames.join(', ')} sobre ${changeType === 'update' ? 'a alteração' : 'o cancelamento'}.`
            }
          } catch (e) {
            console.error('[NOTIFY-CHANGE] Erro ao notificar participantes:', e)
          }
        }

        // ========================================
        // WA-06.8: NOTIFICAR RESPONSÁVEL APÓS CRIAR CARD DELEGADO
        // Se o card foi delegado a outra pessoa, notificar via WhatsApp
        // ========================================
        if (result.success && activeContext.context_type === 'creating_card' && ents.assigned_to) {
          const assigneeName = String(ents.assigned_to)
          // Só notificar se NÃO é o próprio criador
          const isSelf = assigneeName.toLowerCase() === 'eu' ||
            assigneeName.toLowerCase() === firstName.toLowerCase() ||
            assigneeName.toLowerCase() === user.full_name.toLowerCase()

          if (!isSelf) {
            try {
              const participant = await findParticipantByName(supabase, assigneeName)
              if (participant && participant.id !== userId) {
                const notifyMsg = `Fala ${participant.displayName}! ${firstName} criou uma tarefa pra você:\n\n` +
                  `📝 *${ents.title || 'Tarefa'}*\n` +
                  (ents.deadline ? `📅 Prazo: ${ents.deadline}\n` : '') +
                  (ents.priority === 'urgent' ? `🔴 Urgente\n` : '') +
                  `\nConfere lá em Projetos! 💪`

                await sendTextMessage({
                  serverUrl: params.uazapiUrl,
                  token: params.uazapiToken,
                  to: participant.phoneNumber,
                  text: notifyMsg,
                })
                result.message += `\nNotifiquei ${participant.displayName} pelo WhatsApp.`
                console.log(`[NOTIFY-CARD] ✅ Notificação enviada para ${participant.displayName}`)
              }
            } catch (notifyErr) {
              console.error('[NOTIFY-CARD] Erro ao notificar responsável:', notifyErr)
            }
          }
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
        text: `Ok, cancelei.`,
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
  // WA-06.9: MEMÓRIA DE CURTO PRAZO NA DM
  // Carregar últimas mensagens da conversa para dar contexto ao NLP
  // Similar ao group_memory, mas usando whatsapp_messages
  // ========================================
  let dmContext = ''
  if (!params.groupContext && supabase && user.phone_number) {
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data: recentMsgs } = await supabase
        .from('whatsapp_messages')
        .select('direction, content, created_at')
        .eq('phone_number', user.phone_number)
        .gte('created_at', twoHoursAgo)
        .order('created_at', { ascending: true })
        .limit(20)

      if (recentMsgs && recentMsgs.length > 0) {
        const lines = recentMsgs.map((m: { direction: string; content: string }) => {
          const who = m.direction === 'inbound' ? firstName : 'Mike'
          return `${who}: ${m.content}`
        })
        dmContext = `HISTÓRICO RECENTE DA CONVERSA (últimas ${recentMsgs.length} mensagens):\n${lines.join('\n')}`
        console.log(`[WA-06.9] DM context loaded: ${recentMsgs.length} messages`)
      }
    } catch (e) {
      console.error('[WA-06.9] Erro ao carregar DM context:', e)
    }
  }

  // Carregar lembretes pendentes do usuário para contexto do NLP
  let remindersContext = ''
  if (supabase && userId) {
    try {
      const { data: pendingReminders } = await supabase
        .from('whatsapp_scheduled_messages')
        .select('content, scheduled_for, recurrence, source')
        .eq('target_user_id', userId)
        .eq('status', 'pending')
        .in('source', ['manual', 'dashboard'])
        .order('scheduled_for', { ascending: true })
        .limit(10)

      if (pendingReminders && pendingReminders.length > 0) {
        const recLabels: Record<string, string> = { daily: 'todo dia', weekdays: 'dias úteis', weekly: 'toda semana', monthly: 'todo mês' }
        const lines = pendingReminders.map((r: { content: string; scheduled_for: string; recurrence: string | null }) => {
          const dt = new Date(r.scheduled_for)
          const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          const rec = r.recurrence ? ` (${recLabels[r.recurrence] || r.recurrence})` : ' (único)'
          return `- "${r.content}" → ${dateStr}${rec}`
        })
        remindersContext = `LEMBRETES PENDENTES DO USUÁRIO (dados reais do banco — use estes dados, NÃO invente):\n${lines.join('\n')}`
      }
    } catch (e) {
      console.error('[WA-09] Erro ao carregar lembretes para contexto:', e)
    }
  }

  // Carregar próximos eventos do calendário para contexto do NLP
  let calendarContext = ''
  if (supabase && userId) {
    try {
      const futureMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: upcomingEvents } = await supabase
        .from('calendar_items')
        .select('title, start_time, type, location, participants')
        .eq('created_by', userId)
        .gte('start_time', new Date().toISOString())
        .lte('start_time', futureMonth)
        .is('deleted_at', null)
        .order('start_time', { ascending: true })
        .limit(10)

      if (upcomingEvents && upcomingEvents.length > 0) {
        const typeEmoji: Record<string, string> = { event: '📅', delivery: '✅', creation: '🎨', task: '📋', meeting: '🤝' }
        const lines = upcomingEvents.map((ev: { title: string; start_time: string; type: string; location: string | null; participants: string | null }) => {
          const dt = new Date(ev.start_time)
          const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          const emoji = typeEmoji[ev.type] || '📅'
          const loc = ev.location ? ` | ${ev.location}` : ''
          const part = ev.participants ? ` | com ${ev.participants}` : ''
          return `- ${emoji} "${ev.title}" → ${dateStr}${loc}${part}`
        })
        calendarContext = `REFERÊNCIA DE EVENTOS (APENAS para identificar eventos em update_calendar/cancel_calendar — NUNCA use para responder consultas de agenda, que devem ir para query_calendar):\n${lines.join('\n')}`
      }
    } catch (e) {
      console.error('[WA-09] Erro ao carregar eventos para contexto:', e)
    }
  }

  // Combinar contextos: conversa ativa + DM history + lembretes + calendário
  let fullContext = conversationContext || ''
  if (dmContext) fullContext = fullContext ? `${fullContext}\n\n${dmContext}` : dmContext
  if (remindersContext) fullContext = fullContext ? `${fullContext}\n\n${remindersContext}` : remindersContext
  if (calendarContext) fullContext = fullContext ? `${fullContext}\n\n${calendarContext}` : calendarContext

  // ========================================
  // CLASSIFICAR MENSAGEM COM GEMINI
  // ========================================
  const classification = await classifyMessage(parsed.text, firstName, fullContext || undefined, memoryPrompt, params.groupContext)

  // ========================================
  // ROTEAR POR INTENÇÃO
  // ========================================
  console.log(`[WA-ROUTE-V69] intent=${classification.intent}, text="${parsed.text?.substring(0, 60)}", userId=${userId}, authUserId=${authUserId}`)
  switch (classification.intent) {
    case 'create_card':
      return handleCreateCard(classification, firstName, supabase, userId)

    case 'create_calendar':
      return handleCreateCalendar(classification, firstName, supabase, userId)

    case 'create_reminder':
      return handleCreateReminder(classification, firstName, supabase, userId)

    case 'update_reminder':
      return handleUpdateReminder(classification, firstName, supabase, userId)

    case 'cancel_reminder':
      return handleCancelReminder(classification, firstName, supabase, userId)

    case 'update_calendar':
      return handleUpdateCalendar(classification, firstName, supabase, authUserId, userId)

    case 'cancel_calendar':
      return handleCancelCalendar(classification, firstName, supabase, authUserId, userId)

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

    // ========================================
    // WA-06.8: SALVAR CONTATO NA AGENDA
    // ========================================
    case 'save_contact': {
      const contactName = classification.entities.contact_name as string
      const contactPhone = classification.entities.contact_phone as string
      const contactType = (classification.entities.contact_type as string) || 'outro'
      const contactNotes = classification.entities.notes as string | undefined

      if (!contactName || !contactPhone) {
        return {
          text: `Preciso do nome e número pra salvar na agenda, ${firstName}. Ex: "Salva na agenda Jereh, 5521985525984, fornecedor"`,
          intent: 'save_contact',
          confidence: classification.confidence,
        }
      }

      const result = await saveContact(supabase, {
        name: contactName,
        phone: contactPhone,
        contactType,
        notes: contactNotes,
        createdBy: authUserId,
      })

      if (result.success) {
        const typeLabel = contactType !== 'outro' ? ` como *${contactType}*` : ''
        return {
          text: `Salvei ${contactName}${typeLabel} na agenda! 📇\nQuando precisar, é só perguntar: "Mike, qual o número do ${contactName}?"`,
          intent: 'save_contact',
          confidence: 1.0,
        }
      }

      return {
        text: `Não consegui salvar: ${result.error}`,
        intent: 'save_contact',
        confidence: 1.0,
      }
    }

    // ========================================
    // WA-06.8: CONSULTAR CONTATO NA AGENDA
    // ========================================
    case 'query_contact': {
      const searchName = (classification.entities.contact_name as string) || parsed.text
      const contacts = await queryContacts(supabase, searchName)

      if (contacts.length === 0) {
        return {
          text: `Não encontrei "${searchName}" na agenda, ${firstName}. Quer que eu salve um contato novo?`,
          intent: 'query_contact',
          confidence: 1.0,
        }
      }

      if (contacts.length === 1) {
        const c = contacts[0]
        const typeLabel = c.contactType !== 'outro' ? ` (${c.contactType})` : ''
        return {
          text: `📇 *${c.name}*${typeLabel}\n📱 ${c.phone}${c.notes ? `\n📝 ${c.notes}` : ''}`,
          intent: 'query_contact',
          confidence: 1.0,
        }
      }

      // Múltiplos resultados
      const list = contacts.slice(0, 5).map(c => {
        const typeLabel = c.contactType !== 'outro' ? ` (${c.contactType})` : ''
        return `• *${c.name}*${typeLabel} — ${c.phone}`
      }).join('\n')

      return {
        text: `Encontrei ${contacts.length} contatos:\n\n${list}`,
        intent: 'query_contact',
        confidence: 1.0,
      }
    }

    // ========================================
    // WA-10: NOTIFICAR USUÁRIO NO PRIVADO
    // ========================================
    case 'notify_user': {
      const notifyTarget = classification.entities.notify_target as string
      const notifyMessage = classification.entities.notify_message as string || ''
      const cardTitle = classification.entities.card_title as string || ''

      if (!notifyTarget) {
        return { text: `Quem você quer que eu notifique, ${firstName}?`, intent: 'notify_user_missing_target', confidence: 0.9 }
      }

      // Buscar em contacts (fonte única de verdade — equipe + agenda)
      const { data: targetContact } = await supabase
        .from('contacts')
        .select('id, name, phone, contact_type, user_profile_id')
        .ilike('name', `%${notifyTarget.trim()}%`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (!targetContact) {
        return { text: `Não encontrei "${notifyTarget}" na agenda. Confere o nome.`, intent: 'notify_user_not_found', confidence: 1.0 }
      }
      if (!targetContact.phone) {
        return { text: `${targetContact.name} não tem telefone cadastrado.`, intent: 'notify_user_no_phone', confidence: 1.0 }
      }

      const targetName = targetContact.name
      const targetPhone = targetContact.phone
      console.log(`[WA-NOTIFY] Telefone resolvido para ${targetName}: ${targetPhone} (tipo: ${targetContact.contact_type})`)

      // Buscar card relacionado se mencionado
      let cardInfo = ''
      if (cardTitle || notifyMessage) {
        const searchTerm = cardTitle || notifyMessage
        const { data: relatedCard } = await supabase
          .from('kanban_cards')
          .select('id, title, priority, due_date, column_id')
          .is('deleted_at', null)
          .ilike('title', `%${searchTerm.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (relatedCard) {
          const { data: col } = await supabase
            .from('kanban_columns')
            .select('name')
            .eq('id', relatedCard.column_id)
            .single()

          cardInfo = `\n\n📝 *${relatedCard.title}*`
          if (col?.name) cardInfo += `\n📋 ${col.name}`
          if (relatedCard.due_date) {
            const d = new Date(relatedCard.due_date)
            cardInfo += `\n📅 Prazo: ${d.getDate()}/${d.getMonth() + 1}`
          }
          if (relatedCard.priority && relatedCard.priority !== 'medium') {
            cardInfo += `\n⚡ Prioridade: ${relatedCard.priority}`
          }
        }
      }

      // Montar e enviar mensagem
      let msgText = `Fala ${targetName}! 👋\n${firstName} pediu pra te avisar`
      if (notifyMessage) {
        msgText += ` sobre: ${notifyMessage}`
      }
      if (cardInfo) {
        msgText += cardInfo
      }
      if (!notifyMessage && !cardInfo) {
        msgText += `. Entra em contato com ele!`
      }
      msgText += `\n\nQualquer dúvida, fala comigo! 🤙`

      console.log(`[WA-NOTIFY] Enviando para ${targetName}: phone=${targetPhone}, serverUrl=${params.uazapiUrl}, hasToken=${!!params.uazapiToken}, msgLen=${msgText.length}`)

      const sendResult = await sendTextMessage({
        serverUrl: params.uazapiUrl,
        token: params.uazapiToken,
        to: targetPhone,
        text: msgText,
      })

      console.log(`[WA-NOTIFY] sendResult: success=${sendResult.success}, messageId=${sendResult.messageId || 'none'}, error=${sendResult.error || 'none'}`)

      if (!sendResult.success) {
        console.error(`[WA-NOTIFY] Falha ao enviar para ${targetName}:`, sendResult.error)
        return { text: `Não consegui enviar a mensagem pro ${targetName}. Tenta de novo daqui a pouco.`, intent: 'notify_user_error', confidence: 1.0 }
      }

      console.log(`[WA-NOTIFY] ✅ ${targetName} notificado no privado (${targetPhone})`)
      return {
        text: `Pronto! Notifiquei ${targetName} no privado 📩`,
        intent: 'notify_user',
        confidence: 1.0,
      }
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

    // ========================================
    // STUDIO: FLUXO CONVERSACIONAL DE CLIPS
    // ========================================
    case 'list_clips':
      return handleListClips(firstName, supabase, userId)

    case 'select_clip':
      return handleSelectClip(classification, firstName, supabase, userId)

    case 'select_format':
      return handleSelectFormat(classification, firstName, supabase, userId)

    case 'set_mentions':
      return handleSetMentions(classification, firstName, supabase, userId)

    case 'set_schedule':
      return handleSetSchedule(classification, firstName, supabase, userId)

    case 'confirm_publish':
      return handleConfirmPublish(firstName, supabase, userId)

    case 'cancel_publish':
      return handleCancelPublish(firstName, supabase, userId)

    case 'delegate_to_john':
      return handleDelegateToJohn(firstName, supabase, userId)

    // LEGADO: approve_clips (para compatibilidade)
    case 'approve_clips':
      return handleApproveClips(classification, firstName, supabase, userId)

    case 'unknown':
    default:
      return {
        text: classification.response_text || `Não entendi, ${firstName}. Pode reformular? Ou manda "ajuda".`,
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

  // WA-06.5: Verificar se falta informação antes de criar
  const ents = entities as unknown as Record<string, unknown>
  const followUp = generateFollowUp('create_card', ents)
  if (followUp) {
    // Falta informação — iniciar follow-up
    const summary = buildPartialSummary('create_card', ents)
    const pending: PendingAction = {
      action: 'create_card',
      entities: { ...ents },
      missingFields: getMissingFields('create_card', ents),
      currentQuestion: followUp.question,
      waitingForField: followUp.missingField,
      source: 'text',
      createdAt: new Date().toISOString(),
    }
    await savePendingAction(supabase, userId, pending)

    return {
      text: `${summary}\n${followUp.question}`,
      intent: `followup_asking_${followUp.missingField}`,
      confidence: classification.confidence,
    }
  }

  // Tem tudo — pedir confirmação
  if (classification.needs_confirmation) {
    await saveConversationContext(supabase, userId, 'creating_card', {
      step: 'awaiting_confirmation',
      entities,
      classified_at: new Date().toISOString(),
    })
  }

  return {
    text: buildConfirmationMessage('create_card', ents),
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

  // WA-06.5: Verificar se falta informação antes de criar
  const ents = entities as unknown as Record<string, unknown>
  const followUp = generateFollowUp('create_calendar', ents)
  if (followUp) {
    // Falta informação — iniciar follow-up
    const summary = buildPartialSummary('create_calendar', ents)
    const pending: PendingAction = {
      action: 'create_calendar',
      entities: { ...ents },
      missingFields: getMissingFields('create_calendar', ents),
      currentQuestion: followUp.question,
      waitingForField: followUp.missingField,
      source: 'text',
      createdAt: new Date().toISOString(),
    }
    await savePendingAction(supabase, userId, pending)

    return {
      text: `${summary}\n${followUp.question}`,
      intent: `followup_asking_${followUp.missingField}`,
      confidence: classification.confidence,
    }
  }

  // Tem tudo — pedir confirmação
  if (classification.needs_confirmation) {
    await saveConversationContext(supabase, userId, 'creating_calendar', {
      step: 'awaiting_confirmation',
      entities,
      classified_at: new Date().toISOString(),
    })
  }

  return {
    text: buildConfirmationMessage('create_calendar', ents),
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

  // Mapear entidades para campos do follow-up
  const mappedEntities: Record<string, unknown> = { ...entities }

  // Se tem recorrência, não precisa de data (a data é calculada pelo tipo)
  if (entities.reminder_recurrence && !entities.reminder_date) {
    // Para recorrentes, a "data" é o próximo dia relevante
    // Ex: "toda segunda" → próxima segunda
    if (entities.reminder_recurrence === 'daily' || entities.reminder_recurrence === 'weekdays') {
      mappedEntities.reminder_date = 'hoje'
    }
  }

  // Verificar se falta informação importante (horário, recorrência)
  const followUp = generateFollowUp('create_reminder', mappedEntities)

  if (followUp) {
    // Falta informação → iniciar follow-up
    const summary = buildPartialSummary('create_reminder', mappedEntities)
    const allMissing = getMissingFields('create_reminder', mappedEntities)
    await savePendingAction(supabase, userId, {
      action: 'create_reminder',
      entities: mappedEntities,
      missingFields: allMissing,
      currentQuestion: followUp.question,
      waitingForField: followUp.missingField,
      source: 'text',
      createdAt: new Date().toISOString(),
    })

    const text = summary
      ? `${summary}\n\n${followUp.question}`
      : followUp.question

    return {
      text,
      intent: classification.intent,
      confidence: classification.confidence,
    }
  }

  // Tudo preenchido → pedir confirmação
  // Se recurrence não foi definida explicitamente, tratar como único
  if (!mappedEntities.reminder_recurrence) {
    mappedEntities.reminder_recurrence = null
  }

  await saveConversationContext(supabase, userId, 'creating_reminder', {
    step: 'awaiting_confirmation',
    entities: mappedEntities,
    classified_at: new Date().toISOString(),
  })

  const parts: string[] = ['⏰ Entendi! Vou criar um *lembrete*:\n']
  if (entities.reminder_text) parts.push(`📝 *${entities.reminder_text}*`)
  if (entities.reminder_date) parts.push(`� ${entities.reminder_date}`)
  if (entities.reminder_time) parts.push(`🕐 ${entities.reminder_time}`)
  if (entities.reminder_recurrence) {
    const recLabels: Record<string, string> = {
      daily: '🔄 Todo dia', weekdays: '🔄 Dias úteis (seg-sex)',
      weekly: '🔄 Toda semana', monthly: '🔄 Todo mês',
    }
    parts.push(recLabels[entities.reminder_recurrence] || `🔄 ${entities.reminder_recurrence}`)
  } else {
    parts.push('📌 Lembrete único')
  }
  parts.push('\nConfirma? (sim/não)')

  return {
    text: parts.join('\n'),
    intent: classification.intent,
    confidence: classification.confidence,
  }
}

// ============================================
// HANDLER: ALTERAR LEMBRETE EXISTENTE
// ============================================

// deno-lint-ignore no-explicit-any
async function handleUpdateReminder(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string
): Promise<MessageResponse> {
  const { entities } = classification
  const searchText = entities.reminder_search_text || entities.reminder_text || entities.raw_text || ''

  // Buscar lembretes pendentes do usuário
  const reminders = await findUserReminders(supabase, userId)

  if (reminders.length === 0) {
    return {
      text: `Você não tem nenhum lembrete pendente pra alterar, ${userName}.`,
      intent: 'update_reminder',
      confidence: classification.confidence,
    }
  }

  // Encontrar o lembrete mais relevante
  const match = findBestReminderMatch(reminders, searchText)

  if (!match) {
    // Listar lembretes para o usuário escolher
    const list = reminders.slice(0, 5).map((r: ReminderRow, i: number) => {
      const dateStr = new Date(r.scheduled_for).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      const recLabel = r.recurrence ? ` (${RECURRENCE_LABELS_ROUTER[r.recurrence] || r.recurrence})` : ''
      return `${i + 1}. ${r.content.substring(0, 60)} — ${dateStr}${recLabel}`
    }).join('\n')

    return {
      text: `Não consegui identificar qual lembrete você quer alterar. Seus lembretes pendentes:\n\n${list}\n\nQual deles?`,
      intent: 'update_reminder',
      confidence: classification.confidence,
    }
  }

  // Montar updates
  const updates: Record<string, unknown> = {}
  let changeDesc = ''

  if (entities.reminder_new_time) {
    // Resolver novo horário mantendo a data original
    const original = new Date(match.scheduled_for)
    const timeParts = entities.reminder_new_time.match(/(\d{1,2}):?(\d{2})?/)
    if (timeParts) {
      let hour = parseInt(timeParts[1])
      const min = parseInt(timeParts[2] || '0')
      if (hour < 7) hour += 12 // Horário comercial
      original.setHours(hour, min, 0, 0)
      updates.scheduled_for = original.toISOString()
      changeDesc += `🕐 Horário: ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}\n`
    }
  }

  if (entities.reminder_new_date) {
    changeDesc += `📅 Data: ${entities.reminder_new_date}\n`
    // Resolver data relativa
    const now = new Date(Date.now() - 3 * 60 * 60000) // SP timezone
    const dateStr = entities.reminder_new_date.toLowerCase()
    const original = new Date(match.scheduled_for)

    if (dateStr.includes('amanhã') || dateStr.includes('amanha')) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      original.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
      updates.scheduled_for = original.toISOString()
    } else if (dateStr.includes('segunda') || dateStr.includes('terça') || dateStr.includes('terca') ||
               dateStr.includes('quarta') || dateStr.includes('quinta') || dateStr.includes('sexta') ||
               dateStr.includes('sábado') || dateStr.includes('sabado') || dateStr.includes('domingo')) {
      const dayMap: Record<string, number> = {
        domingo: 0, segunda: 1, terça: 2, terca: 2, quarta: 3,
        quinta: 4, sexta: 5, sábado: 6, sabado: 6,
      }
      for (const [name, dayNum] of Object.entries(dayMap)) {
        if (dateStr.includes(name)) {
          const diff = (dayNum - now.getDay() + 7) % 7 || 7
          const target = new Date(now)
          target.setDate(target.getDate() + diff)
          original.setFullYear(target.getFullYear(), target.getMonth(), target.getDate())
          updates.scheduled_for = original.toISOString()
          break
        }
      }
    }
  }

  if (entities.reminder_new_recurrence !== undefined) {
    updates.recurrence = entities.reminder_new_recurrence
    const recLabels: Record<string, string> = {
      daily: 'todo dia', weekdays: 'dias úteis', weekly: 'toda semana', monthly: 'todo mês',
    }
    changeDesc += `🔄 Recorrência: ${entities.reminder_new_recurrence ? recLabels[entities.reminder_new_recurrence] || entities.reminder_new_recurrence : 'único'}\n`
  }

  if (Object.keys(updates).length === 0) {
    return {
      text: `Achei o lembrete *${match.content.substring(0, 60)}*, mas não entendi o que quer mudar. Me diz o novo horário, data ou recorrência.`,
      intent: 'update_reminder',
      confidence: classification.confidence,
    }
  }

  // Salvar contexto de confirmação
  await saveConversationContext(supabase, userId, 'updating_reminder', {
    step: 'awaiting_confirmation',
    entities: {
      reminder_id: match.id,
      reminder_content: match.content.substring(0, 80),
      updates,
      change_description: changeDesc,
    },
    classified_at: new Date().toISOString(),
  })

  const cleanContent = match.content
    .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, '')
    .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, '')
    .substring(0, 60)

  return {
    text: `Achei o lembrete: *${cleanContent}*\n\nAlterações:\n${changeDesc}\nConfirma? (sim/não)`,
    intent: 'update_reminder',
    confidence: classification.confidence,
  }
}

// ============================================
// HANDLER: CANCELAR LEMBRETE EXISTENTE
// ============================================

// deno-lint-ignore no-explicit-any
async function handleCancelReminder(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string
): Promise<MessageResponse> {
  const { entities } = classification
  const searchText = entities.reminder_search_text || entities.reminder_text || entities.raw_text || ''

  // Buscar lembretes pendentes do usuário
  const reminders = await findUserReminders(supabase, userId)

  if (reminders.length === 0) {
    return {
      text: `Você não tem nenhum lembrete pendente pra cancelar, ${userName}.`,
      intent: 'cancel_reminder',
      confidence: classification.confidence,
    }
  }

  // Encontrar o lembrete mais relevante
  const match = findBestReminderMatch(reminders, searchText)

  if (!match) {
    const list = reminders.slice(0, 5).map((r: ReminderRow, i: number) => {
      const dateStr = new Date(r.scheduled_for).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      const recLabel = r.recurrence ? ` (${RECURRENCE_LABELS_ROUTER[r.recurrence] || r.recurrence})` : ''
      return `${i + 1}. ${r.content.substring(0, 60)} — ${dateStr}${recLabel}`
    }).join('\n')

    return {
      text: `Não consegui identificar qual lembrete cancelar. Seus lembretes pendentes:\n\n${list}\n\nQual deles?`,
      intent: 'cancel_reminder',
      confidence: classification.confidence,
    }
  }

  // Salvar contexto de confirmação
  await saveConversationContext(supabase, userId, 'cancelling_reminder', {
    step: 'awaiting_confirmation',
    entities: {
      reminder_id: match.id,
      reminder_content: match.content.substring(0, 80),
    },
    classified_at: new Date().toISOString(),
  })

  const cleanContent = match.content
    .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, '')
    .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, '')
    .substring(0, 60)

  const recLabel = match.recurrence ? ` (${RECURRENCE_LABELS_ROUTER[match.recurrence] || match.recurrence})` : ' (único)'
  const dateStr = new Date(match.scheduled_for).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return {
    text: `Achei o lembrete: *${cleanContent}*\n📅 ${dateStr}${recLabel}\n\nCancelo? (sim/não)`,
    intent: 'cancel_reminder',
    confidence: classification.confidence,
  }
}

// ============================================
// HELPERS: BUSCA DE LEMBRETES
// ============================================

interface ReminderRow {
  id: string
  content: string
  scheduled_for: string
  recurrence: string | null
  source: string
}

const RECURRENCE_LABELS_ROUTER: Record<string, string> = {
  daily: '🔄 todo dia',
  weekdays: '🔄 dias úteis',
  weekly: '🔄 toda semana',
  monthly: '🔄 todo mês',
}

// deno-lint-ignore no-explicit-any
async function findUserReminders(supabase: any, userId: string): Promise<ReminderRow[]> {
  const { data } = await supabase
    .from('whatsapp_scheduled_messages')
    .select('id, content, scheduled_for, recurrence, source')
    .eq('target_user_id', userId)
    .eq('status', 'pending')
    .in('source', ['manual', 'dashboard'])
    .order('scheduled_for', { ascending: true })
    .limit(20)

  return data || []
}

function findBestReminderMatch(reminders: ReminderRow[], searchText: string): ReminderRow | null {
  if (!searchText || reminders.length === 0) {
    // Se só tem 1 lembrete, retorna ele
    return reminders.length === 1 ? reminders[0] : null
  }

  const search = searchText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let bestMatch: ReminderRow | null = null
  let bestScore = 0

  for (const r of reminders) {
    let score = 0
    const content = r.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const scheduledDate = new Date(r.scheduled_for)

    // Match por conteúdo (palavras em comum)
    const searchWords = search.split(/\s+/).filter(w => w.length > 2)
    for (const word of searchWords) {
      if (content.includes(word)) score += 3
    }

    // Match por recorrência mencionada
    if (search.includes('segunda') && scheduledDate.getDay() === 1) score += 2
    if (search.includes('terca') && scheduledDate.getDay() === 2) score += 2
    if (search.includes('quarta') && scheduledDate.getDay() === 3) score += 2
    if (search.includes('quinta') && scheduledDate.getDay() === 4) score += 2
    if (search.includes('sexta') && scheduledDate.getDay() === 5) score += 2

    if (search.includes('diario') || search.includes('todo dia')) {
      if (r.recurrence === 'daily') score += 3
    }
    if (search.includes('semanal') || search.includes('toda semana') || search.includes('toda segunda')) {
      if (r.recurrence === 'weekly') score += 3
    }
    if (search.includes('mensal') || search.includes('todo mes')) {
      if (r.recurrence === 'monthly') score += 3
    }

    // Match por horário mencionado
    const timeMatch = search.match(/(\d{1,2})\s*(?:h|hora|:)/)
    if (timeMatch) {
      const searchHour = parseInt(timeMatch[1])
      const reminderHour = scheduledDate.getHours()
      if (searchHour === reminderHour || (searchHour < 7 && searchHour + 12 === reminderHour)) score += 2
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = r
    }
  }

  // Threshold mínimo para considerar match
  return bestScore >= 2 ? bestMatch : (reminders.length === 1 ? reminders[0] : null)
}

// ============================================
// WA-09: UPDATE/CANCEL CALENDAR EVENT
// ============================================

interface CalendarRow {
  id: string
  title: string
  start_time: string
  end_time: string | null
  type: string
  location: string | null
  responsible_user_id: string
}

const CALENDAR_TYPE_EMOJI: Record<string, string> = {
  event: '📅', delivery: '✅', creation: '🎨', task: '📋', meeting: '🤝',
}

// deno-lint-ignore no-explicit-any
async function findUserCalendarEvents(supabase: any, authUserId: string): Promise<CalendarRow[]> {
  // Buscar eventos futuros e recentes (últimos 7 dias + próximos 30 dias)
  const pastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const futureMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  console.log(`[WA-09] findUserCalendarEvents: authUserId=${authUserId}, range=${pastWeek} to ${futureMonth}`)

  // BUGFIX WA-09.1: responsible_user_id referencia auth.users.id, não user_profiles.id
  // Usar authUserId (auth.users.id) para filtrar corretamente
  const { data, error } = await supabase
    .from('calendar_items')
    .select('id, title, start_time, end_time, type, location, responsible_user_id')
    .eq('responsible_user_id', authUserId)
    .gte('start_time', pastWeek)
    .lte('start_time', futureMonth)
    .is('deleted_at', null)
    .order('start_time', { ascending: true })
    .limit(30)

  if (error) {
    console.error(`[WA-09] findUserCalendarEvents ERROR:`, error)
  }
  console.log(`[WA-09] findUserCalendarEvents result: ${data?.length || 0} eventos`)

  return data || []
}

function findBestCalendarMatch(events: CalendarRow[], searchText: string): CalendarRow | null {
  if (!searchText || events.length === 0) {
    return events.length === 1 ? events[0] : null
  }

  const search = searchText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  let bestMatch: CalendarRow | null = null
  let bestScore = 0

  for (const ev of events) {
    let score = 0
    const title = ev.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const eventDate = new Date(ev.start_time)
    // participants não existe como coluna — buscar no título (nomes de participantes geralmente estão no título)

    // Match por título (palavras em comum)
    const searchWords = search.split(/\s+/).filter(w => w.length > 2)
    for (const word of searchWords) {
      if (title.includes(word)) score += 4
      // participantes podem estar no título do evento (ex: 'Reunião com Jereh')
    }

    // Match por tipo de evento
    if (search.includes('reuniao') || search.includes('reunião')) {
      if (ev.type === 'meeting') score += 2
    }
    if (search.includes('gravacao') || search.includes('gravação')) {
      if (ev.type === 'creation' || title.includes('gravação') || title.includes('gravacao')) score += 3
    }
    if (search.includes('entrega') || search.includes('delivery')) {
      if (ev.type === 'delivery') score += 2
    }

    // Match por dia da semana
    const dayNames: Record<string, number> = {
      'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
      'quinta': 4, 'sexta': 5, 'sabado': 6,
    }
    for (const [dayName, dayNum] of Object.entries(dayNames)) {
      if (search.includes(dayName) && eventDate.getDay() === dayNum) score += 3
    }

    // Match por data relativa
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eventDay = new Date(eventDate)
    eventDay.setHours(0, 0, 0, 0)
    const diffDays = Math.round((eventDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

    if (search.includes('hoje') && diffDays === 0) score += 3
    if (search.includes('amanha') && diffDays === 1) score += 3
    if ((search.includes('semana que vem') || search.includes('proxima semana')) && diffDays >= 7 && diffDays <= 14) score += 2

    // Match por horário mencionado
    const timeMatch = search.match(/(\d{1,2})\s*(?:h|hora|:)/)
    if (timeMatch) {
      const searchHour = parseInt(timeMatch[1])
      const eventHour = eventDate.getHours()
      if (searchHour === eventHour || (searchHour < 7 && searchHour + 12 === eventHour)) score += 2
    }

    // Match por participante mencionado (nomes geralmente estão no título)
    if (search.includes('john') && title.includes('john')) score += 4
    if (search.includes('jereh') && title.includes('jereh')) score += 4
    if (search.includes('rayan') && title.includes('rayan')) score += 4

    // Priorizar eventos futuros sobre passados
    if (eventDate.getTime() > Date.now()) score += 1

    if (score > bestScore) {
      bestScore = score
      bestMatch = ev
    }
  }

  return bestScore >= 2 ? bestMatch : (events.length === 1 ? events[0] : null)
}

function formatCalendarEventSummary(ev: CalendarRow): string {
  const emoji = CALENDAR_TYPE_EMOJI[ev.type] || '📅'
  const dt = new Date(ev.start_time)
  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  const locationLine = ev.location ? `\n📍 ${ev.location}` : ''
  return `${emoji} *${ev.title}*\n🗓️ ${dateStr}${locationLine}`
}

// deno-lint-ignore no-explicit-any
async function handleUpdateCalendar(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  authUserId: string,
  profileId: string,
): Promise<{ text: string; intent: string; confidence: number }> {
  const entities = classification.entities as Record<string, unknown>
  const searchText = String(entities.event_search_text || entities.title || '')

  // DEBUG WA-09.1: Log dos parâmetros
  console.log(`[WA-09] handleUpdateCalendar: authUserId=${authUserId}, profileId=${profileId}, searchText="${searchText}"`)

  // Buscar eventos do usuário (responsible_user_id = auth.users.id)
  const events = await findUserCalendarEvents(supabase, authUserId)

  console.log(`[WA-09] findUserCalendarEvents retornou ${events.length} eventos`)

  if (events.length === 0) {
    console.log(`[WA-09] Nenhum evento encontrado para authUserId=${authUserId}`)
    return {
      text: `Não encontrei nenhum evento seu na agenda pra alterar, ${userName}.`,
      intent: 'update_calendar',
      confidence: classification.confidence,
    }
  }

  // Encontrar o evento mais relevante
  const match = findBestCalendarMatch(events, searchText)

  if (!match) {
    const list = events.filter(e => new Date(e.start_time).getTime() > Date.now()).slice(0, 5).map((ev: CalendarRow, i: number) => {
      const emoji = CALENDAR_TYPE_EMOJI[ev.type] || '📅'
      const dt = new Date(ev.start_time)
      const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      return `${i + 1}. ${emoji} ${ev.title} — ${dateStr}`
    }).join('\n')

    return {
      text: `Não consegui identificar qual evento alterar. Seus próximos eventos:\n\n${list}\n\nQual deles?`,
      intent: 'update_calendar',
      confidence: classification.confidence,
    }
  }

  // Montar descrição das mudanças
  const changes: string[] = []
  if (entities.event_new_date) changes.push(`📅 Nova data: ${entities.event_new_date}`)
  if (entities.event_new_time) changes.push(`🕐 Novo horário: ${entities.event_new_time}`)
  if (entities.event_new_location) changes.push(`📍 Novo local: ${entities.event_new_location}`)
  if (entities.event_new_title) changes.push(`📝 Novo título: ${entities.event_new_title}`)
  const changeDesc = changes.length > 0 ? changes.join('\n') : '(sem alterações especificadas)'

  // Salvar contexto de confirmação (usa profileId para whatsapp_conversation_context)
  await saveConversationContext(supabase, profileId, 'updating_calendar', {
    step: 'awaiting_confirmation',
    entities: {
      event_id: match.id,
      event_title: match.title,
      event_start_time: match.start_time,
      event_new_date: entities.event_new_date || null,
      event_new_time: entities.event_new_time || null,
      event_new_location: entities.event_new_location || null,
      event_new_title: entities.event_new_title || null,
      change_description: changeDesc,
      message_to_participant: entities.message_to_participant || null,
    },
    classified_at: new Date().toISOString(),
  })

  return {
    text: `Achei o evento:\n${formatCalendarEventSummary(match)}\n\nAlterações:\n${changeDesc}\n\nConfirma? (sim/não)`,
    intent: 'update_calendar',
    confidence: classification.confidence,
  }
}

// deno-lint-ignore no-explicit-any
async function handleCancelCalendar(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  authUserId: string,
  profileId: string,
): Promise<{ text: string; intent: string; confidence: number }> {
  const entities = classification.entities as Record<string, unknown>
  const searchText = String(entities.event_search_text || entities.title || '')

  // Buscar eventos do usuário (responsible_user_id = auth.users.id)
  const events = await findUserCalendarEvents(supabase, authUserId)

  if (events.length === 0) {
    return {
      text: `Não encontrei nenhum evento seu na agenda pra cancelar, ${userName}.`,
      intent: 'cancel_calendar',
      confidence: classification.confidence,
    }
  }

  // Encontrar o evento mais relevante
  const match = findBestCalendarMatch(events, searchText)

  if (!match) {
    const list = events.filter(e => new Date(e.start_time).getTime() > Date.now()).slice(0, 5).map((ev: CalendarRow, i: number) => {
      const emoji = CALENDAR_TYPE_EMOJI[ev.type] || '📅'
      const dt = new Date(ev.start_time)
      const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      return `${i + 1}. ${emoji} ${ev.title} — ${dateStr}`
    }).join('\n')

    return {
      text: `Não consegui identificar qual evento cancelar. Seus próximos eventos:\n\n${list}\n\nQual deles?`,
      intent: 'cancel_calendar',
      confidence: classification.confidence,
    }
  }

  // Salvar contexto de confirmação (usa profileId para whatsapp_conversation_context)
  await saveConversationContext(supabase, profileId, 'cancelling_calendar', {
    step: 'awaiting_confirmation',
    entities: {
      event_id: match.id,
      event_title: match.title,
      event_start_time: match.start_time,
      message_to_participant: entities.message_to_participant || null,
    },
    classified_at: new Date().toISOString(),
  })

  return {
    text: `Achei o evento:\n${formatCalendarEventSummary(match)}\n\nCancelo? (sim/não)`,
    intent: 'cancel_calendar',
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
  // WA-06.6: VERIFICAR CONFIRMAÇÃO DE EVENTO (áudio)
  // Se o participante respondeu por áudio à notificação de evento
  // ========================================
  const audioEventConfirmation = await getEventConfirmation(supabase, userId)
  if (audioEventConfirmation) {
    console.log(`[NOTIFY-AUDIO] Resposta de confirmação de ${firstName} para evento "${audioEventConfirmation.eventTitle}"`)
    const audioEventResult = await processParticipantResponse(
      supabase, uazapiUrl, uazapiToken,
      audioEventConfirmation, result.transcription
    )
    return {
      text: audioEventResult.message,
      intent: audioEventResult.confirmed ? 'event_confirmed' : audioEventResult.declined ? 'event_declined' : 'audio_event_confirmation',
      confidence: 1.0,
      metadata: { transcription: result.transcription },
    }
  }

  // ========================================
  // WA-06.5: VERIFICAR FOLLOW-UP PENDENTE (áudio)
  // Se o Mike perguntou "Que horas?" e o usuário respondeu por áudio
  // ========================================
  const audioPending = await getPendingAction(supabase, userId)
  if (audioPending) {
    console.log(`[FOLLOWUP-AUDIO] Ação pendente: ${audioPending.action}, aguardando: ${audioPending.waitingForField}`)
    const audioFollowUp = processFollowUpResponse(audioPending, result.transcription)

    if (!audioFollowUp) {
      await clearPendingAction(supabase, userId)
      // Cancelou — responder e parar
      return {
        text: 'Ok, cancelei.',
        intent: 'audio_followup_cancelled',
        confidence: 1.0,
        metadata: { transcription: result.transcription },
      }
    } else if (audioFollowUp.complete) {
      await clearPendingAction(supabase, userId)
      const contextType = audioPending.action === 'create_calendar' ? 'creating_calendar' : 'creating_card'
      await saveConversationContext(supabase, userId, contextType, {
        step: 'awaiting_confirmation',
        entities: audioFollowUp.entities,
        classified_at: new Date().toISOString(),
      })
      const confirmMsg = buildConfirmationMessage(audioPending.action, audioFollowUp.entities)
      return {
        text: confirmMsg,
        intent: `audio_followup_${audioPending.action}_complete`,
        confidence: 1.0,
        metadata: { transcription: result.transcription },
      }
    } else {
      const updatedPending: PendingAction = {
        ...audioPending,
        entities: audioFollowUp.entities,
        missingFields: audioPending.missingFields.filter(f => f !== audioPending.waitingForField),
        currentQuestion: audioFollowUp.nextQuestion!,
        waitingForField: audioFollowUp.nextField!,
      }
      await savePendingAction(supabase, userId, updatedPending)
      return {
        text: audioFollowUp.nextQuestion!,
        intent: `audio_followup_asking_${audioFollowUp.nextField}`,
        confidence: 1.0,
        metadata: { transcription: result.transcription },
      }
    }
  }

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
          uazapiUrl: params.uazapiUrl,
          uazapiToken: params.uazapiToken,
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
  const classification = await classifyMessage(result.transcription, firstName, undefined, memoryPrompt, params.groupContext)

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
    if (ents.date) parts.push(`📆 Data: *${ents.date}*`)
    if (ents.time) parts.push(`⏰ Horário: *${ents.time}*`)
    if (ents.location) parts.push(`📍 Local: *${ents.location}*`)
    if (ents.people) parts.push(`👥 Participantes: *${ents.people}*`)
    if (ents.calendar_type) parts.push(`📌 Tipo: *${ents.calendar_type}*`)
    if (ents.notes) parts.push(`💡 ${ents.notes}`)
    parts.push('\n✅ Confirma? (sim/não)')

    await saveConversationContextForMedia(supabase, userId, 'creating_calendar', {
      step: 'awaiting_confirmation',
      entities: {
        title: ents.title,
        date: ents.date || null,
        time: ents.time || null,
        location: ents.location || null,
        calendar_type: ents.calendar_type || 'meeting',
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

    // WA-10 FIX: Intents faltantes no fluxo de áudio
    case 'update_reminder':
      return handleUpdateReminder(classification, firstName, supabase, userId)
    case 'cancel_reminder':
      return handleCancelReminder(classification, firstName, supabase, userId)
    case 'update_calendar':
      return handleUpdateCalendar(classification, firstName, supabase, authUserId, userId)
    case 'cancel_calendar':
      return handleCancelCalendar(classification, firstName, supabase, authUserId, userId)
    case 'update_card':
      return {
        text: classification.response_text || `✏️ Vou atualizar o card, ${firstName}. (Em breve!)`,
        intent: classification.intent || 'update_card',
        confidence: classification.confidence,
      }

    // WA-10 FIX: Salvar contato (áudio)
    case 'save_contact': {
      const contactName = classification.entities.contact_name as string
      const contactPhone = classification.entities.contact_phone as string
      const contactType = (classification.entities.contact_type as string) || 'outro'
      const contactNotes = classification.entities.notes as string | undefined

      if (!contactName || !contactPhone) {
        return {
          text: `Preciso do nome e número pra salvar na agenda, ${firstName}. Ex: "Salva na agenda Jereh, 5521985525984, fornecedor"`,
          intent: 'save_contact',
          confidence: classification.confidence,
        }
      }

      const result = await saveContact(supabase, {
        name: contactName,
        phone: contactPhone,
        contactType,
        notes: contactNotes,
        createdBy: authUserId,
      })

      if (result.success) {
        const typeLabel = contactType !== 'outro' ? ` como *${contactType}*` : ''
        return {
          text: `Salvei ${contactName}${typeLabel} na agenda! 📇\nQuando precisar, é só perguntar: "Mike, qual o número do ${contactName}?"`,
          intent: 'save_contact',
          confidence: 1.0,
        }
      }

      return {
        text: `Não consegui salvar: ${result.error}`,
        intent: 'save_contact',
        confidence: 1.0,
      }
    }

    // WA-10 FIX: Consultar contato (áudio)
    case 'query_contact': {
      const searchName = (classification.entities.contact_name as string) || params.parsed?.text || ''
      const contacts = await queryContacts(supabase, searchName)

      if (contacts.length === 0) {
        return {
          text: `Não encontrei "${searchName}" na agenda, ${firstName}. Quer que eu salve um contato novo?`,
          intent: 'query_contact',
          confidence: 1.0,
        }
      }

      if (contacts.length === 1) {
        const c = contacts[0]
        const typeLabel = c.contactType !== 'outro' ? ` (${c.contactType})` : ''
        return {
          text: `📇 *${c.name}*${typeLabel}\n📱 ${c.phone}${c.notes ? `\n📝 ${c.notes}` : ''}`,
          intent: 'query_contact',
          confidence: 1.0,
        }
      }

      const list = contacts.slice(0, 5).map(c => {
        const typeLabel = c.contactType !== 'outro' ? ` (${c.contactType})` : ''
        return `• *${c.name}*${typeLabel} — ${c.phone}`
      }).join('\n')

      return {
        text: `Encontrei ${contacts.length} contatos:\n\n${list}`,
        intent: 'query_contact',
        confidence: 1.0,
      }
    }

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
    // WA-10: Notificar usuário (áudio)
    case 'notify_user': {
      const notifyTarget = classification.entities.notify_target as string
      const notifyMessage = classification.entities.notify_message as string || ''
      const cardTitle = classification.entities.card_title as string || ''

      if (!notifyTarget) {
        return { text: `Quem você quer que eu notifique, ${firstName}?`, intent: 'notify_user_missing_target', confidence: 0.9 }
      }

      // Buscar em contacts (fonte única de verdade — equipe + agenda)
      const { data: targetContact } = await supabase
        .from('contacts')
        .select('id, name, phone, contact_type')
        .ilike('name', `%${notifyTarget.trim()}%`)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (!targetContact) {
        return { text: `Não encontrei "${notifyTarget}" na agenda.`, intent: 'notify_user_not_found', confidence: 1.0 }
      }
      if (!targetContact.phone) {
        return { text: `${targetContact.name} não tem telefone cadastrado.`, intent: 'notify_user_no_phone', confidence: 1.0 }
      }

      const targetName = targetContact.name
      const targetPhone = targetContact.phone

      let cardInfo = ''
      if (cardTitle || notifyMessage) {
        const searchTerm = cardTitle || notifyMessage
        const { data: relatedCard } = await supabase
          .from('kanban_cards')
          .select('id, title, priority, due_date, column_id')
          .is('deleted_at', null)
          .ilike('title', `%${searchTerm.trim()}%`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (relatedCard) {
          const { data: col } = await supabase
            .from('kanban_columns').select('name').eq('id', relatedCard.column_id).single()
          cardInfo = `\n\n📝 *${relatedCard.title}*`
          if (col?.name) cardInfo += `\n📋 ${col.name}`
          if (relatedCard.due_date) {
            const d = new Date(relatedCard.due_date)
            cardInfo += `\n📅 Prazo: ${d.getDate()}/${d.getMonth() + 1}`
          }
        }
      }

      let msgText = `Fala ${targetName}! 👋\n${firstName} pediu pra te avisar`
      if (notifyMessage) msgText += ` sobre: ${notifyMessage}`
      if (cardInfo) msgText += cardInfo
      if (!notifyMessage && !cardInfo) msgText += `. Entra em contato com ele!`
      msgText += `\n\nQualquer dúvida, fala comigo! 🤙`

      const sendResult = await sendTextMessage({
        serverUrl: params.uazapiUrl,
        token: params.uazapiToken,
        to: targetPhone,
        text: msgText,
      })

      if (!sendResult.success) {
        return { text: `Não consegui enviar a mensagem pro ${targetName}.`, intent: 'notify_user_error', confidence: 1.0 }
      }

      console.log(`[WA-NOTIFY] ✅ ${targetName} notificado no privado (${targetPhone}) via áudio`)
      return { text: `Pronto! Notifiquei ${targetName} no privado 📩`, intent: 'notify_user', confidence: 1.0 }
    }

    case 'help':
      return { text: getHelpText(), intent: 'help', confidence: 1.0 }
    case 'general_chat':
      return { text: classification.response_text, intent: 'general_chat', confidence: classification.confidence }

    // STUDIO: FLUXO CONVERSACIONAL DE CLIPS (áudio)
    case 'list_clips':
      return handleListClips(firstName, supabase, userId)
    case 'select_clip':
      return handleSelectClip(classification, firstName, supabase, userId)
    case 'select_format':
      return handleSelectFormat(classification, firstName, supabase, userId)
    case 'set_mentions':
      return handleSetMentions(classification, firstName, supabase, userId)
    case 'set_schedule':
      return handleSetSchedule(classification, firstName, supabase, userId)
    case 'confirm_publish':
      return handleConfirmPublish(firstName, supabase, userId)
    case 'cancel_publish':
      return handleCancelPublish(firstName, supabase, userId)
    case 'delegate_to_john':
      return handleDelegateToJohn(firstName, supabase, userId)
    // LEGADO
    case 'approve_clips':
      return handleApproveClips(classification, firstName, supabase, userId)

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
// WA-06.5: MENSAGEM DE CONFIRMAÇÃO (TOM MIKE)
// ============================================

function buildConfirmationMessage(action: string, entities: Record<string, unknown>): string {
  const parts: string[] = []

  if (action === 'create_calendar') {
    parts.push('📅 *Criar evento?*\n')
    parts.push(`📌 ${entities.title || 'Evento'}`)
    if (entities.date) {
      let dateLine = `🕐 ${entities.date}`
      if (entities.time) dateLine += ` às ${entities.time}`
      parts.push(dateLine)
    }
    if (entities.location) parts.push(`📍 ${entities.location}`)
    if (entities.participants) parts.push(`👤 ${entities.participants}`)
    if (entities.duration_minutes) parts.push(`⏱️ ${entities.duration_minutes} min`)
  } else if (action === 'create_card') {
    parts.push('📋 *Criar card?*\n')
    parts.push(`📌 ${entities.title || 'Tarefa'}`)
    if (entities.assigned_to) parts.push(`👤 ${entities.assigned_to}`)
    if (entities.deadline || entities.date) parts.push(`📅 Prazo: ${entities.deadline || entities.date}`)
    if (entities.content_type) parts.push(`🎬 ${entities.content_type}`)
    if (entities.priority === 'urgent') parts.push('🔥 Urgente')
    else if (entities.priority === 'high') parts.push('🔥 Prioridade alta')
  } else if (action === 'create_reminder') {
    parts.push('⏰ *Criar lembrete?*\n')
    parts.push(`📌 ${entities.reminder_text || 'Lembrete'}`)
    if (entities.reminder_date) parts.push(`📅 ${entities.reminder_date}`)
    if (entities.reminder_time) parts.push(`🕐 ${entities.reminder_time}`)
    if (entities.reminder_recurrence) {
      const recLabels: Record<string, string> = {
        daily: '🔄 Todo dia', weekdays: '🔄 Dias úteis (seg-sex)',
        weekly: '🔄 Toda semana', monthly: '🔄 Todo mês',
      }
      parts.push(recLabels[entities.reminder_recurrence as string] || `🔄 ${entities.reminder_recurrence}`)
    } else {
      parts.push('📌 Lembrete único')
    }
  }

  parts.push('\nConfirma? (sim/não)')
  return parts.join('\n')
}

// ============================================
// FORMATADORES
// ============================================

function formatPriority(p: string): string {
  const map: Record<string, string> = {
    urgent: '🔥 Urgente', high: '🔥 Alta', medium: 'Média', low: 'Baixa',
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

// ============================================
// STUDIO: HANDLERS DE CLIPS (Submagic → Instagram)
// ============================================

// deno-lint-ignore no-explicit-any
async function handleListClips(
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  // Buscar vídeo mais recente com clips prontos (incluindo brand)
  const { data: latestVideo } = await supabase
    .from('studio_videos')
    .select('id, title, brand')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestVideo) {
    return {
      text: `Nenhum vídeo com clipes prontos no momento, ${userName}.`,
      intent: 'list_clips',
      confidence: 1.0
    }
  }

  // Determinar conta do Instagram
  const igAccount = latestVideo.brand === 'la_music_kids' ? '@lamusickids' : '@lamusicschool'

  // Buscar clips (incluindo file_url para preview)
  const { data: clips } = await supabase
    .from('studio_clips')
    .select('id, title, file_url, metadata')
    .eq('video_id', latestVideo.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!clips || clips.length === 0) {
    return {
      text: `Nenhum clipe pronto de "${latestVideo.title}".`,
      intent: 'list_clips',
      confidence: 1.0
    }
  }

  // Sort by virality score in memory
  const sortedClips = [...clips].sort((a: any, b: any) => {
    const scoreA = a.metadata?.virality_score || 0
    const scoreB = b.metadata?.virality_score || 0
    return scoreB - scoreA
  })

  // Salvar contexto do fluxo conversacional
  const clipIds = sortedClips.map((c: any) => c.id)
  const clipTitles = sortedClips.map((c: any) => c.title || 'Sem título')

  await supabase
    .from('whatsapp_conversation_context')
    .upsert({
      user_id: userId,
      context_type: 'clips_approval_flow',
      context_data: {
        step: 'select_clip',
        video_id: latestVideo.id,
        video_title: latestVideo.title,
        brand: latestVideo.brand || 'la_music_school',
        ig_account: igAccount,
        clip_ids: clipIds,
        clip_titles: clipTitles,
      },
      is_active: true,
    }, { onConflict: 'user_id,context_type' })

  console.log(`[CLIPS] Started approval flow for user ${userId}: ${clipIds.length} clips`)

  // Formatar lista com preview URLs
  const lines = sortedClips.map((c: any, i: number) => {
    const score = c.metadata?.virality_score || '?'
    const previewUrl = c.metadata?.preview_url || c.file_url
    const previewLine = previewUrl ? `\n   👁 ${previewUrl}` : ''
    return `${i + 1}. "${c.title || 'Sem título'}" — ${score}${previewLine}`
  })

  return {
    text: `🎬 *Clipes de "${latestVideo.title}"*\n📍 ${igAccount}\n\n${lines.join('\n\n')}\n\n` +
          `Manda o número do clip (ex: *1*).`,
    intent: 'list_clips',
    confidence: 1.0,
  }
}

// ============================================
// HANDLERS DO FLUXO CONVERSACIONAL DE CLIPS
// ============================================

// deno-lint-ignore no-explicit-any
async function handleSelectClip(
  classification: { entities: { clip_index?: number } },
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  const clipIndex = classification.entities.clip_index

  // Buscar contexto do fluxo
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data?.clip_ids) {
    return {
      text: `Manda *VER* primeiro pra ver os clipes disponíveis, ${userName}.`,
      intent: 'select_clip',
      confidence: 1.0
    }
  }

  const { clip_ids, clip_titles, ig_account } = ctx.context_data

  // Tratar "o último" (clip_index: -1)
  let resolvedIndex = clipIndex
  if (clipIndex === -1) {
    resolvedIndex = clip_ids.length // último clip
  }

  if (!resolvedIndex || resolvedIndex < 1 || resolvedIndex > clip_ids.length) {
    return {
      text: `Número inválido. Escolhe de 1 a ${clip_ids.length}.`,
      intent: 'select_clip',
      confidence: 1.0
    }
  }

  const selectedClipId = clip_ids[resolvedIndex - 1]
  const selectedClipTitle = clip_titles[resolvedIndex - 1] || 'Sem título'

  // Atualizar contexto com clip selecionado
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      context_data: {
        ...ctx.context_data,
        step: 'select_format',
        selected_clip_id: selectedClipId,
        selected_clip_title: selectedClipTitle,
        selected_clip_index: resolvedIndex,
      }
    })
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  return {
    text: `📱 *Clip ${resolvedIndex}:* "${selectedClipTitle}"\n📍 ${ig_account}\n\n` +
          `Onde publicar?\n` +
          `• *R* → Reels\n` +
          `• *S* → Stories\n` +
          `• *RS* → Reels + Stories`,
    intent: 'select_clip',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleSelectFormat(
  classification: { entities: { format?: string } },
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  const format = (classification.entities.format || 'R').toUpperCase()

  // Buscar contexto do fluxo
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data?.selected_clip_id) {
    return {
      text: `Primeiro escolhe um clip. Manda *VER* pra ver a lista.`,
      intent: 'select_format',
      confidence: 1.0
    }
  }

  // Validar formato
  const validFormats = ['R', 'S', 'RS']
  const normalizedFormat = format === 'REELS' ? 'R' : format === 'STORIES' ? 'S' : format

  if (!validFormats.includes(normalizedFormat)) {
    return {
      text: `Formato inválido. Manda *R* (Reels), *S* (Stories) ou *RS* (ambos).`,
      intent: 'select_format',
      confidence: 1.0
    }
  }

  // Atualizar contexto
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      context_data: {
        ...ctx.context_data,
        step: 'set_mentions',
        format: normalizedFormat,
      }
    })
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  const formatLabel = normalizedFormat === 'RS' ? 'Reels + Stories' : normalizedFormat === 'S' ? 'Stories' : 'Reels'

  return {
    text: `✅ Formato: *${formatLabel}*\n\n` +
          `Quer marcar alguém no post?\n\n` +
          `Manda os @usernames (ex: *@fulano @ciclano*)\n` +
          `ou *PULAR* para publicar sem marcações.`,
    intent: 'select_format',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleSetMentions(
  classification: { entities: { mentions?: string[]; skip_mentions?: boolean } },
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  const mentions = classification.entities.mentions || []
  const skipMentions = classification.entities.skip_mentions || false

  // Buscar contexto do fluxo
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data?.format) {
    return {
      text: `Primeiro escolhe o formato. Manda *R*, *S* ou *RS*.`,
      intent: 'set_mentions',
      confidence: 1.0
    }
  }

  // Atualizar contexto
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      context_data: {
        ...ctx.context_data,
        step: 'set_schedule',
        mentions: skipMentions ? [] : mentions,
      }
    })
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  const mentionsText = skipMentions || mentions.length === 0
    ? 'Sem marcações'
    : mentions.join(' ')

  return {
    text: `✅ Marcações: *${mentionsText}*\n\n` +
          `Publicar agora ou agendar?\n\n` +
          `• *AGORA* → publica imediatamente\n` +
          `• Ou manda horário: *18h*, *amanhã 10h*, *seg 15h*`,
    intent: 'set_mentions',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleSetSchedule(
  classification: { entities: { schedule_type?: string; schedule_datetime?: string } },
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  const scheduleType = classification.entities.schedule_type || 'now'
  const scheduleDatetime = classification.entities.schedule_datetime

  // Buscar contexto do fluxo
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data?.mentions === undefined) {
    return {
      text: `Primeiro define as marcações. Manda @usernames ou *PULAR*.`,
      intent: 'set_schedule',
      confidence: 1.0
    }
  }

  // Atualizar contexto
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      context_data: {
        ...ctx.context_data,
        step: 'confirm',
        schedule: {
          type: scheduleType,
          datetime: scheduleDatetime || null,
        }
      }
    })
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  const { selected_clip_title, selected_clip_index, format, mentions, ig_account } = ctx.context_data
  const formatLabel = format === 'RS' ? 'Reels + Stories' : format === 'S' ? 'Stories' : 'Reels'
  const mentionsText = mentions && mentions.length > 0 ? mentions.join(' ') : 'Nenhuma'

  let scheduleText = 'Agora'
  if (scheduleType === 'scheduled' && scheduleDatetime) {
    const dt = new Date(scheduleDatetime)
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    scheduleText = `${dias[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1} às ${dt.getHours()}h`
  }

  return {
    text: `📋 *Confirma publicação:*\n\n` +
          `📹 Clip: "${selected_clip_title}"\n` +
          `📱 Formato: ${formatLabel}\n` +
          `👥 Marcações: ${mentionsText}\n` +
          `🕐 Horário: ${scheduleText}\n` +
          `📍 Conta: ${ig_account}\n\n` +
          `*SIM* para confirmar ou *NÃO* para cancelar.`,
    intent: 'set_schedule',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleConfirmPublish(
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  // Buscar contexto do fluxo
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data?.schedule) {
    return {
      text: `Nenhuma publicação pendente. Manda *VER* pra começar.`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }

  const {
    selected_clip_id,
    selected_clip_title,
    format,
    mentions,
    schedule,
    brand,
    ig_account
  } = ctx.context_data

  // Buscar clip do banco
  const { data: clip } = await supabase
    .from('studio_clips')
    .select('*')
    .eq('id', selected_clip_id)
    .single()

  if (!clip) {
    return {
      text: `Clip não encontrado. Manda *VER* pra ver os disponíveis.`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }

  // Buscar credenciais do Instagram
  const integrationName = brand === 'la_music_kids' ? 'instagram_kids' : 'instagram_school'
  const igUserId = brand === 'la_music_kids' ? '17841404041835860' : '17841401761485758'

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('*')
    .eq('integration_name', integrationName)
    .single()

  if (!cred) {
    return {
      text: `❌ Credenciais do Instagram não encontradas.`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }

  const credData = cred as { credentials?: { access_token?: string } }
  const accessToken = credData.credentials?.access_token

  if (!accessToken) {
    return {
      text: `❌ Token do Instagram não configurado.`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }

  // Se agendado, salvar para publicação futura
  if (schedule.type === 'scheduled' && schedule.datetime) {
    await supabase
      .from('studio_clips')
      .update({
        status: 'scheduled',
        metadata: {
          ...clip.metadata,
          scheduled_at: schedule.datetime,
          scheduled_format: format,
          scheduled_mentions: mentions || [],
          scheduled_ig_account: ig_account,
        }
      })
      .eq('id', selected_clip_id)

    // Limpar contexto
    await supabase
      .from('whatsapp_conversation_context')
      .delete()
      .eq('user_id', userId)
      .eq('context_type', 'clips_approval_flow')

    const dt = new Date(schedule.datetime)
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const scheduleText = `${dias[dt.getDay()]} ${dt.getDate()}/${dt.getMonth()+1} às ${dt.getHours()}h`

    return {
      text: `✅ Agendado para ${scheduleText}!\n📍 ${ig_account}`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }

  // Publicar agora
  const formatsToPublish = format === 'RS' ? ['REELS', 'STORIES'] : [format === 'S' ? 'STORIES' : 'REELS']
  const results: string[] = []
  const errors: string[] = []

  // Montar caption com mentions
  let caption = clip.title || '🎵 #LAMusic'
  if (mentions && mentions.length > 0) {
    caption += '\n\n' + mentions.join(' ')
  }

  // Função auxiliar para publicar um formato
  async function publishFormat(mediaType: string): Promise<{ success: boolean; label: string; error?: string }> {
    const label = mediaType === 'REELS' ? 'Reels' : 'Stories'
    try {
      // Criar container
      const createPayload: Record<string, any> = {
        video_url: clip.file_url,
        media_type: mediaType,
        access_token: accessToken,
      }
      if (mediaType === 'REELS') {
        createPayload.caption = caption
      }

      const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        }
      )
      const createData = await createRes.json()

      if (!createRes.ok || !createData.id) {
        return { success: false, label, error: createData.error?.message || 'Erro ao criar' }
      }

      // Polling: aguardar FINISHED (max 45s = 9 × 5s)
      let containerReady = false
      for (let attempt = 0; attempt < 9; attempt++) {
        await new Promise(r => setTimeout(r, 5000))
        const statusRes = await fetch(
          `https://graph.facebook.com/v19.0/${createData.id}?fields=status_code&access_token=${accessToken}`
        )
        const statusData = await statusRes.json()
        console.log(`[CLIPS] ${mediaType} status (attempt ${attempt + 1}): ${statusData.status_code}`)

        if (statusData.status_code === 'FINISHED') {
          containerReady = true
          break
        }
        if (statusData.status_code === 'ERROR') {
          return { success: false, label, error: 'Erro no processamento' }
        }
      }

      if (!containerReady) {
        return { success: false, label, error: 'Timeout no processamento' }
      }

      // Publicar
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: createData.id, access_token: accessToken }),
        }
      )
      const publishData = await publishRes.json()

      if (publishRes.ok && publishData.id) {
        return { success: true, label }
      } else {
        return { success: false, label, error: publishData.error?.message || 'Erro ao publicar' }
      }
    } catch (e) {
      return { success: false, label, error: String(e).substring(0, 50) }
    }
  }

  // Processar formatos em PARALELO (crítico para RS não dar timeout)
  const publishResults = await Promise.all(formatsToPublish.map(publishFormat))

  for (const result of publishResults) {
    if (result.success) {
      results.push(result.label)
    } else {
      errors.push(`${result.label}: ${result.error}`)
    }
  }

  // Atualizar status do clip
  if (results.length > 0) {
    await supabase
      .from('studio_clips')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        metadata: {
          ...clip.metadata,
          published_formats: results,
          published_mentions: mentions || [],
        }
      })
      .eq('id', selected_clip_id)
  }

  // Limpar contexto
  await supabase
    .from('whatsapp_conversation_context')
    .delete()
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  // Nota sobre Stories + mentions
  const hasMentions = mentions && mentions.length > 0
  const hasStories = results.includes('Stories')
  const hasReels = results.includes('Reels')
  const storiesNote = (hasMentions && hasStories)
    ? `\n\nℹ️ Marcações adicionadas no Reels.${hasReels ? '' : '\nStories não suportam tags via API.'}`
    : ''

  // Resposta
  if (results.length > 0 && errors.length === 0) {
    return {
      text: `✅ Publicado como ${results.join(' + ')}! 🎉\n📍 ${ig_account}${storiesNote}`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  } else if (results.length > 0) {
    return {
      text: `✅ Publicado: ${results.join(' + ')}\n⚠️ Erros: ${errors.join(', ')}\n📍 ${ig_account}${storiesNote}`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  } else {
    return {
      text: `❌ Falha na publicação: ${errors.join(', ')}`,
      intent: 'confirm_publish',
      confidence: 1.0
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleCancelPublish(
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  // Limpar contexto
  await supabase
    .from('whatsapp_conversation_context')
    .delete()
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  return {
    text: `❌ Publicação cancelada. Manda *VER* quando quiser recomeçar.`,
    intent: 'cancel_publish',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleDelegateToJohn(
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  // Buscar contexto atual
  const { data: ctx } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data')
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')
    .eq('is_active', true)
    .single()

  if (!ctx?.context_data) {
    return {
      text: `Não tem nenhum clip em andamento pra passar pro John. Manda *VER* pra começar.`,
      intent: 'delegate_to_john',
      confidence: 1.0
    }
  }

  const { video_title, ig_account, clip_ids } = ctx.context_data as {
    video_title?: string
    ig_account?: string
    clip_ids?: string[]
  }

  // Enviar notificação para o John
  const UAZAPI_SERVER_URL = Deno.env.get('UAZAPI_SERVER_URL')
  const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN')
  const JOHN_PHONE = Deno.env.get('JOHN_PHONE')

  if (UAZAPI_SERVER_URL && UAZAPI_TOKEN && JOHN_PHONE) {
    const clipsCount = clip_ids?.length || 0
    const msg =
      `📩 *${userName} passou pra você!*\n\n` +
      `🎬 Vídeo: "${video_title || 'Sem título'}"\n` +
      `📍 Conta: ${ig_account || '@lamusicschool'}\n` +
      `📊 ${clipsCount} clips disponíveis\n\n` +
      `Manda *VER* pra escolher qual publicar.`

    await fetch(`${UAZAPI_SERVER_URL}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'token': UAZAPI_TOKEN },
      body: JSON.stringify({ number: JOHN_PHONE, text: msg, delay: 500 })
    }).catch(e => console.error('[DELEGATE] WhatsApp error:', e))
  }

  // Limpar contexto do usuário atual
  await supabase
    .from('whatsapp_conversation_context')
    .delete()
    .eq('user_id', userId)
    .eq('context_type', 'clips_approval_flow')

  return {
    text: `✅ Passei pro John! Ele vai receber a notificação e pode escolher qual clip publicar.`,
    intent: 'delegate_to_john',
    confidence: 1.0
  }
}

// deno-lint-ignore no-explicit-any
async function handleApproveClips(
  classification: ClassificationResult,
  userName: string,
  supabase: any,
  userId: string,
): Promise<MessageResponse> {
  const approvalType = classification.entities.approval_type || 'all'
  const approvalCount = classification.entities.approval_count || 2
  const approvalIndices = classification.entities.approval_indices as number[] | undefined
  const publishFormat = classification.entities.publish_format || 'reels'
  const mediaType = publishFormat === 'stories' ? 'STORIES' : 'REELS'

  console.log(`[CLIPS] handleApproveClips: type=${approvalType}, indices=${JSON.stringify(approvalIndices)}, format=${publishFormat}`)

  // 1. Se for seleção específica, buscar contexto salvo
  let savedClipIds: string[] = []
  if (approvalType === 'specific' && approvalIndices?.length) {
    const { data: ctx } = await supabase
      .from('whatsapp_conversation_context')
      .select('context_data')
      .eq('user_id', userId)
      .eq('context_type', 'clips_list')
      .eq('is_active', true)
      .single()

    if (ctx?.context_data?.clip_ids) {
      savedClipIds = ctx.context_data.clip_ids
      console.log(`[CLIPS] Found saved context with ${savedClipIds.length} clip IDs`)
    }
  }

  // 2. Buscar vídeo mais recente com clips prontos
  const { data: latestVideo } = await supabase
    .from('studio_videos')
    .select('id, title, brand')
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestVideo) {
    return {
      text: `Não encontrei vídeos com clipes prontos, ${userName}.`,
      intent: 'approve_clips',
      confidence: 1.0
    }
  }

  // 3. Buscar clips prontos
  const { data: allClips, error: clipsError } = await supabase
    .from('studio_clips')
    .select('*')
    .eq('video_id', latestVideo.id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false })

  if (clipsError || !allClips || allClips.length === 0) {
    return {
      text: `Nenhum clipe pronto para publicar.`,
      intent: 'approve_clips',
      confidence: 1.0
    }
  }

  // Sort by virality score in memory (maior primeiro)
  const sortedClips = [...allClips].sort((a: any, b: any) => {
    const scoreA = a.metadata?.virality_score || 0
    const scoreB = b.metadata?.virality_score || 0
    return scoreB - scoreA
  })

  // 4. Selecionar clips baseado no approval_type
  let selectedClips: any[]
  let selectionDesc: string

  if (approvalType === 'specific' && approvalIndices?.length) {
    // Usar contexto salvo se disponível, senão usar ordem atual
    if (savedClipIds.length > 0) {
      // Resolver por IDs salvos
      selectedClips = approvalIndices
        .map((idx: number) => {
          const clipId = savedClipIds[idx - 1] // índice baseado em 1
          return allClips.find((c: any) => c.id === clipId)
        })
        .filter(Boolean)
    } else {
      // Fallback: usar ordem atual (sortedClips)
      selectedClips = approvalIndices
        .map((idx: number) => sortedClips[idx - 1])
        .filter(Boolean)
    }
    selectionDesc = `clips ${approvalIndices.join(', ')}`
  } else if (approvalType === 'top_n') {
    selectedClips = sortedClips.slice(0, approvalCount)
    selectionDesc = `top ${approvalCount}`
  } else {
    // 'all' → pegar os 2 melhores (limite de segurança)
    selectedClips = sortedClips.slice(0, 2)
    selectionDesc = 'melhores clips'
  }

  // LIMITE DE 2 CLIPS POR EXECUÇÃO (para evitar timeout)
  const MAX_CLIPS_PER_RUN = 2
  if (selectedClips.length > MAX_CLIPS_PER_RUN) {
    selectedClips = selectedClips.slice(0, MAX_CLIPS_PER_RUN)
    selectionDesc += ` (limitado a ${MAX_CLIPS_PER_RUN})`
  }

  if (selectedClips.length === 0) {
    return {
      text: `Não encontrei os clips selecionados. Manda *VER* pra ver a lista atualizada.`,
      intent: 'approve_clips',
      confidence: 1.0
    }
  }

  console.log(`[CLIPS] Selected ${selectedClips.length} clips (${selectionDesc}) to publish as ${mediaType}`)

  // 3. Buscar token do Instagram
  const integrationName = latestVideo.brand === 'la_music_kids' ? 'instagram_kids' : 'instagram_school'
  const igUserId = latestVideo.brand === 'la_music_kids' ? '17841404041835860' : '17841401761485758'

  const { data: cred } = await supabase
    .from('integration_credentials')
    .select('*')
    .eq('integration_name', integrationName)
    .single()

  if (!cred) {
    return {
      text: `❌ Credenciais do Instagram não encontradas para ${integrationName}.`,
      intent: 'approve_clips',
      confidence: 1.0
    }
  }

  // Token está em credentials.access_token (JSONB column)
  const credData = cred as { credentials?: { access_token?: string }; metadata?: { access_token?: string } }
  const accessToken = credData.credentials?.access_token || credData.metadata?.access_token

  if (!accessToken) {
    return {
      text: `❌ Token do Instagram não configurado.`,
      intent: 'approve_clips',
      confidence: 1.0
    }
  }

  // 5. Publicar cada clip via Meta Graph API
  let published = 0
  const errors: string[] = []

  for (const clip of selectedClips) {
    try {
      console.log(`[CLIPS] Publishing clip ${clip.id}: ${clip.title} as ${mediaType}`)

      // Passo 1: Criar container
      // Stories NÃO suporta caption
      const createPayload: Record<string, any> = {
        video_url: clip.file_url,
        media_type: mediaType,
        access_token: accessToken,
      }

      // Só adiciona caption se for Reels
      if (mediaType === 'REELS') {
        createPayload.caption = clip.title || '🎵 Novo clipe! #LAMusic'
      }

      const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createPayload),
        }
      )

      const createData = await createRes.json()

      if (!createRes.ok || !createData.id) {
        const errMsg = createData.error?.message || JSON.stringify(createData)
        console.error(`[CLIPS] Create failed for ${clip.id}:`, errMsg)
        errors.push(`${clip.title}: ${errMsg.substring(0, 60)}`)
        continue
      }

      console.log(`[CLIPS] Container created: ${createData.id}`)

      // Polling: aguardar container ficar FINISHED (max 25s = 5 x 5s)
      let containerReady = false
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(r => setTimeout(r, 5000))
        const statusRes = await fetch(
          `https://graph.facebook.com/v19.0/${createData.id}?fields=status_code&access_token=${accessToken}`
        )
        const statusData = await statusRes.json()
        console.log(`[CLIPS] Container status (attempt ${attempt + 1}): ${statusData.status_code}`)

        if (statusData.status_code === 'FINISHED') {
          containerReady = true
          break
        }
        if (statusData.status_code === 'ERROR') {
          errors.push(`${clip.title}: Instagram processing failed`)
          break
        }
      }

      if (!containerReady) {
        errors.push(`${clip.title}: Timeout - Instagram não processou`)
        continue
      }

      // Passo 2: Publicar
      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: accessToken,
          }),
        }
      )

      const publishData = await publishRes.json()

      if (publishRes.ok && publishData.id) {
        published++
        console.log(`[CLIPS] Published: ${publishData.id}`)

        await supabase
          .from('studio_clips')
          .update({
            status: 'published',
            published_at: new Date().toISOString(),
            metadata: {
              ...clip.metadata,
              instagram_media_id: publishData.id,
              published_as: mediaType.toLowerCase(),
            }
          })
          .eq('id', clip.id)
      } else {
        const errMsg = publishData.error?.message || JSON.stringify(publishData)
        console.error(`[CLIPS] Publish failed for ${clip.id}:`, errMsg)
        errors.push(`${clip.title}: ${errMsg.substring(0, 60)}`)
      }
    } catch (e) {
      console.error(`[CLIPS] Exception for ${clip.id}:`, e)
      errors.push(`${clip.title}: ${String(e).substring(0, 50)}`)
    }
  }

  const errText = errors.length > 0 ? `\n\n⚠️ Erros:\n${errors.join('\n')}` : ''
  const formatLabel = mediaType === 'STORIES' ? 'Stories' : 'Reels'

  // Limpar contexto de clips após publicar
  await supabase
    .from('whatsapp_conversation_context')
    .delete()
    .eq('user_id', userId)
    .eq('context_type', 'clips_list')

  return {
    text: `✅ Publiquei *${published}* ${formatLabel} no Instagram! (${selectionDesc})${errText}`,
    intent: 'approve_clips',
    confidence: 1.0,
  }
}
