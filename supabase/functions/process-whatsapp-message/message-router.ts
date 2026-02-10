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
import { getEventConfirmation, processParticipantResponse, notifyParticipants, notifyParticipantsOfChange, parseParticipantNames, findParticipantByName, getPendingParticipantPhone, processPhoneResponse, savePendingParticipantPhone, getPendingSaveContact, processSaveContactResponse, saveContact, queryContacts } from './participant-notifier.ts'
import type { PendingParticipantPhone } from './participant-notifier.ts'
import { sendTextMessage } from './send-message.ts'
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
      const result = await executeConfirmedAction(activeContext.context_type, { supabase, profileId: userId, authUserId, userName: firstName, phone, entities: ents })
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

        // Fila vazia — todos os participantes resolvidos
        if (isSkip && resolved.length === 0) {
          // Pulou todos → criar evento direto sem esperar confirmação
          const result = await executeConfirmedAction(activeContext.context_type, { supabase, profileId: userId, authUserId, userName: firstName, phone, entities: ents })
          await supabase
            .from('whatsapp_conversation_context')
            .update({ is_active: false, context_data: { ...activeContext.context_data, step: result.success ? 'executed' : 'execution_failed', executed_at: new Date().toISOString(), record_id: result.record_id || null }, updated_at: new Date().toISOString() })
            .eq('id', activeContext.id)

          // Notificar participantes cadastrados
          if (result.success && ents.participants) {
            const allNames = parseParticipantNames(ents.participants as string)
            const cadastrados = []
            for (const n of allNames) {
              const found = await findParticipantByName(supabase, n)
              if (found && found.id !== userId) cadastrados.push(n)
            }
            if (cadastrados.length > 0) {
              const notifyResults = await notifyParticipants(supabase, params.uazapiUrl, params.uazapiToken, {
                eventId: result.record_id || '', eventTitle: (ents.title as string) || 'Evento', eventDate: (ents.date as string) || '',
                eventTime: (ents.time as string) || null, eventLocation: (ents.location as string) || null,
                creatorUserId: userId, creatorName: firstName, creatorPhone: user.phone_number, participantNames: cadastrados, groupJid: params.groupJid || null,
              })
              const notified = notifyResults.filter(r => r.notified)
              if (notified.length > 0) result.message += `\nNotifiquei ${notified.map(r => r.participantName).join(', ')} pelo WhatsApp.`
            }
          }

          return { text: `${phoneResult.message}\n\n${result.message}`, intent: 'creating_calendar_executed', confidence: 1.0 }
        }

        // Pelo menos um participante externo foi notificado → esperar confirmação
        const notifiedNames = resolved.join(', ')
        await supabase
          .from('whatsapp_conversation_context')
          .update({
            context_data: {
              ...activeContext.context_data,
              step: 'awaiting_external_confirmation',
              notified_participants: resolved,
              notified_participant: resolved[resolved.length - 1], // último para compatibilidade
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeContext.id)

        return {
          text: `${phoneResult.message}\n\nEnviei convites para: ${notifiedNames}\nQuando confirmarem, me avisa aqui que eu agendo.\nÉ só dizer: *"confirmaram"* ou *"pode agendar"*`,
          intent: 'awaiting_external_confirmation',
          confidence: 1.0,
        }
      }
    }
  }

  // ========================================
  // WA-06.8: AGUARDANDO CONFIRMAÇÃO EXTERNA do participante não cadastrado
  // Criador diz "ele confirmou" / "pode agendar" → criar evento
  // ========================================
  if (activeContext?.context_data?.step === 'awaiting_external_confirmation') {
    const lower = parsed.text.toLowerCase().trim().replace(/[.,!?;:]+$/g, '').trim()
    const ents = activeContext.context_data?.entities || {}
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
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, context_data: { ...activeContext.context_data, step: 'cancelled_no_confirmation' }, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)
      return { text: `Ok, cancelei o agendamento. Se mudar de ideia, é só pedir de novo.`, intent: 'external_confirmation_cancelled', confidence: 1.0 }
    }

    if (isConfirm) {
      // Participante confirmou → criar evento agora
      const result = await executeConfirmedAction(activeContext.context_type, { supabase, profileId: userId, authUserId, userName: firstName, phone, entities: ents })
      await supabase
        .from('whatsapp_conversation_context')
        .update({ is_active: false, context_data: { ...activeContext.context_data, step: result.success ? 'executed' : 'execution_failed', executed_at: new Date().toISOString(), record_id: result.record_id || null }, updated_at: new Date().toISOString() })
        .eq('id', activeContext.id)

      // Notificar participantes cadastrados (outros além do externo)
      if (result.success && ents.participants) {
        const participantNames = parseParticipantNames(ents.participants as string)
        const cadastrados = []
        for (const n of participantNames) {
          const found = await findParticipantByName(supabase, n)
          if (found) cadastrados.push(n)
        }
        if (cadastrados.length > 0) {
          const notifyResults = await notifyParticipants(supabase, params.uazapiUrl, params.uazapiToken, {
            eventId: result.record_id || '', eventTitle: (ents.title as string) || 'Evento', eventDate: (ents.date as string) || '',
            eventTime: (ents.time as string) || null, eventLocation: (ents.location as string) || null,
            creatorUserId: userId, creatorName: firstName, creatorPhone: user.phone_number, participantNames: cadastrados, groupJid: params.groupJid || null,
          })
          const notified = notifyResults.filter(r => r.notified)
          if (notified.length > 0) result.message += `\nNotifiquei ${notified.map(r => r.participantName).join(', ')} pelo WhatsApp.`
        }
      }

      return { text: result.message, intent: 'creating_calendar_executed', confidence: 1.0 }
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

            const { notifiedNames } = await notifyParticipantsOfChange(supabase, params.uazapiUrl, params.uazapiToken, {
              eventTitle,
              eventDate,
              changeType,
              changeDescription,
              creatorName: firstName,
              creatorUserId: userId,
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
// WA-06.5: MENSAGEM DE CONFIRMAÇÃO (TOM MIKE)
// ============================================

function buildConfirmationMessage(action: string, entities: Record<string, unknown>): string {
  const parts: string[] = []

  if (action === 'create_calendar') {
    parts.push('📝 *' + (entities.title || 'Evento') + '*')
    if (entities.date) {
      let dateLine = `📅 ${entities.date}`
      if (entities.time) dateLine += ` às ${entities.time}`
      parts.push(dateLine)
    }
    if (entities.location) parts.push(`📍 ${entities.location}`)
    if (entities.participants) parts.push(`👤 ${entities.participants}`)
    if (entities.duration_minutes) parts.push(`⏱️ ${entities.duration_minutes} min`)
  } else if (action === 'create_card') {
    parts.push('📝 *' + (entities.title || 'Tarefa') + '*')
    if (entities.priority === 'urgent') parts.push('🔴 Urgente')
    else if (entities.priority === 'high') parts.push('🟠 Alta prioridade')
    if (entities.assigned_to) parts.push(`👤 ${entities.assigned_to}`)
    if (entities.deadline || entities.date) parts.push(`📅 Prazo: ${entities.deadline || entities.date}`)
    if (entities.content_type) parts.push(`🎬 ${entities.content_type}`)
  } else if (action === 'create_reminder') {
    parts.push('⏰ *' + (entities.reminder_text || 'Lembrete') + '*')
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
