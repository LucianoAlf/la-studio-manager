// =============================================================================
// FOLLOWUP-HANDLER.TS — Gerencia diálogos de follow-up (perguntas antes de criar)
// LA Studio Manager — WA-06.5
// =============================================================================

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { CANCEL_WORDS, FOLLOWUP_QUESTIONS, isSubjectChange } from './mike-personality.ts'

// =============================================================================
// TIPOS
// =============================================================================

export interface PendingAction {
  action: string                         // 'create_calendar' | 'create_card'
  entities: Record<string, unknown>      // Dados já coletados
  missingFields: string[]                // Campos que faltam
  currentQuestion: string                // Pergunta ativa
  waitingForField: string                // Campo que está aguardando
  source: 'text' | 'audio' | 'image'    // Origem da mensagem original
  createdAt: string                      // ISO timestamp
}

export interface FollowUpResult {
  complete: boolean
  entities: Record<string, unknown>
  nextQuestion?: string
  nextField?: string
}

// Expiração de follow-up em minutos
const FOLLOWUP_EXPIRY_MINUTES = 5

// =============================================================================
// SALVAR AÇÃO PENDENTE
// =============================================================================

export async function savePendingAction(
  supabase: SupabaseClient,
  userId: string,
  pending: PendingAction
): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_conversation_context')
    .upsert(
      {
        user_id: userId,
        context_type: 'pending_action',
        context_data: pending,
        is_active: true,
        expires_at: new Date(Date.now() + FOLLOWUP_EXPIRY_MINUTES * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,context_type' }
    )

  if (error) {
    console.error('[FOLLOWUP] Erro ao salvar ação pendente:', error)
  } else {
    console.log(`[FOLLOWUP] Ação pendente salva: ${pending.action}, aguardando: ${pending.waitingForField}`)
  }
}

// =============================================================================
// BUSCAR AÇÃO PENDENTE
// =============================================================================

export async function getPendingAction(
  supabase: SupabaseClient,
  userId: string
): Promise<PendingAction | null> {
  const { data, error } = await supabase
    .from('whatsapp_conversation_context')
    .select('context_data, updated_at')
    .eq('user_id', userId)
    .eq('context_type', 'pending_action')
    .eq('is_active', true)
    .single()

  if (error || !data) return null

  // Expirar após N minutos de inatividade
  const updatedAt = new Date(data.updated_at)
  const now = new Date()
  const diffMinutes = (now.getTime() - updatedAt.getTime()) / 1000 / 60

  if (diffMinutes > FOLLOWUP_EXPIRY_MINUTES) {
    console.log(`[FOLLOWUP] Ação pendente expirada (${diffMinutes.toFixed(1)} min)`)
    await clearPendingAction(supabase, userId)
    return null
  }

  return data.context_data as PendingAction
}

// =============================================================================
// LIMPAR AÇÃO PENDENTE
// =============================================================================

export async function clearPendingAction(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from('whatsapp_conversation_context')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('context_type', 'pending_action')
}

// =============================================================================
// PROCESSAR RESPOSTA DO FOLLOW-UP
// =============================================================================

/**
 * Processa uma resposta do usuário no contexto de um follow-up.
 *
 * Retorna:
 * - { complete: true, entities } → Todos os campos preenchidos, pode pedir confirmação
 * - { complete: false, nextQuestion, nextField } → Ainda falta campo
 * - null → Cancelado ou mudou de assunto
 */
export function processFollowUpResponse(
  pending: PendingAction,
  userResponse: string
): FollowUpResult | null {
  const response = userResponse.trim().toLowerCase()

  // 1. Detectar cancelamento
  if (CANCEL_WORDS.some(w => response === w || response.startsWith(w))) {
    return null
  }

  // 2. Detectar mudança de assunto
  if (isSubjectChange(userResponse)) {
    return null
  }

  const field = pending.waitingForField
  const updatedEntities = { ...pending.entities }

  // 3. Preencher o campo baseado no tipo
  switch (field) {
    case 'time':
      updatedEntities.time = parseTimeResponse(response)
      break

    case 'date':
      // Manter texto como está — o resolveRelativeDate do action-executor normaliza
      updatedEntities.date = userResponse.trim()
      break

    case 'deadline':
      if (['sem prazo', 'não tem', 'nao tem', 'sem', 'nenhum', 'nao', 'não'].includes(response)) {
        updatedEntities.deadline = null // Sem prazo, pode criar
        updatedEntities._skipDeadline = true // Flag para não perguntar de novo
      } else {
        updatedEntities.deadline = userResponse.trim()
      }
      break

    case 'location':
      updatedEntities.location = parseLocationResponse(response)
      break

    case 'title':
      updatedEntities.title = userResponse.trim()
      break

    default:
      updatedEntities[field] = userResponse.trim()
  }

  // 4. Verificar se ainda falta algum campo
  const remainingMissing = pending.missingFields.filter(f => {
    if (f === field) return false
    if (f === 'deadline' && updatedEntities._skipDeadline) return false
    return !updatedEntities[f]
  })

  if (remainingMissing.length === 0) {
    // Limpar flags internas
    delete updatedEntities._skipDeadline
    return { complete: true, entities: updatedEntities }
  }

  // Ainda falta campo — gerar próxima pergunta
  const nextField = remainingMissing[0]
  const nextQuestion = FOLLOWUP_QUESTIONS[nextField] || `Qual o ${nextField}?`

  return {
    complete: false,
    entities: updatedEntities,
    nextQuestion,
    nextField,
  }
}

// =============================================================================
// PARSERS DE RESPOSTA
// =============================================================================

/**
 * Extrai horário de formatos comuns.
 * Assume horário comercial: se hora < 7 e sem indicador AM, assume PM.
 */
function parseTimeResponse(response: string): string {
  // Remover "às", "as", "pras" etc
  const cleaned = response.replace(/^(às|as|pras?|por volta das?|umas?)\s*/i, '').trim()

  // "10h", "10:00", "10h30", "14h", "3h da tarde"
  const match = cleaned.match(/(\d{1,2})\s*[h:]?\s*(\d{0,2})\s*(da\s*(?:manhã|manha|tarde|noite))?/i)
  if (match) {
    let hours = parseInt(match[1])
    const minutes = match[2] ? parseInt(match[2]) : 0

    // Ajustar AM/PM
    if (match[3]) {
      const period = match[3].toLowerCase()
      if ((period.includes('tarde') || period.includes('noite')) && hours < 12) {
        hours += 12
      }
    } else if (hours >= 1 && hours <= 6) {
      // Horário comercial: 1-6 sem indicador → PM (13-18)
      hours += 12
    }

    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
  }

  // Fallback: retornar como está
  return cleaned
}

/**
 * Normaliza resposta de local.
 */
function parseLocationResponse(response: string): string {
  if (response.includes('online') || response.includes('remoto')) {
    let location = 'Online'
    if (response.includes('zoom')) location += ' (Zoom)'
    else if (response.includes('meet')) location += ' (Google Meet)'
    else if (response.includes('teams')) location += ' (Teams)'
    return location
  }

  // Capitalizar primeira letra
  return response.charAt(0).toUpperCase() + response.slice(1)
}
