/**
 * memory-manager.ts — WA-04
 * Gerencia leitura e escrita de memória do agente.
 * 
 * LEITURA: Chamado ANTES da classificação para injetar contexto no Gemini.
 * ESCRITA: Chamado DEPOIS da execução/resposta para registrar episódio e aprender fatos.
 */

// ============================================
// TIPOS
// ============================================

export interface MemoryContext {
  recent_episodes: EpisodeMemory[]
  user_facts: FactMemory[]
  team_knowledge: TeamMemory[]
  retrieved_at: string
}

export interface EpisodeMemory {
  summary: string
  outcome: string
  entities: Record<string, any>
  importance: number
  created_at: string
}

export interface FactMemory {
  category: string
  fact: string
  metadata: Record<string, any>
  confidence: number
  reinforcement_count: number
  user_confirmed: boolean
}

export interface TeamMemory {
  category: string
  fact: string
  scope: string | null
  metadata: Record<string, any>
  is_verified: boolean
}

// ============================================
// LEITURA
// ============================================

/**
 * Carrega contexto completo de memória para injetar no prompt do Gemini.
 * Non-blocking: retorna null se houver erro (agente funciona sem memória).
 */
export async function loadMemoryContext(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  profileId: string,
  options?: { maxEpisodes?: number; maxFacts?: number; maxTeam?: number }
): Promise<MemoryContext | null> {
  try {
    const { data, error } = await supabase.rpc('get_agent_memory_context', {
      p_user_id: profileId,
      p_max_episodes: options?.maxEpisodes ?? 5,
      p_max_facts: options?.maxFacts ?? 20,
      p_max_team: options?.maxTeam ?? 15,
    })

    if (error) {
      console.error('[Memory] Error loading context:', error)
      return null
    }
    return data as MemoryContext
  } catch (err) {
    console.error('[Memory] Fatal error loading:', err)
    return null
  }
}

/**
 * Formata memória como texto para injetar no prompt do Gemini.
 * Datas de episódios convertidas para São Paulo (UTC-3).
 */
export function formatMemoryForPrompt(memory: MemoryContext): string {
  const sections: string[] = []

  // 1. Fatos do usuário (mais importante — vai primeiro)
  if (memory.user_facts.length > 0) {
    const factsText = memory.user_facts
      .map(f => `- [${f.category}] ${f.fact}${f.user_confirmed ? ' ✓' : ''}`)
      .join('\n')
    sections.push(`## Sobre este usuário:\n${factsText}`)
  }

  // 2. Conhecimento da equipe
  if (memory.team_knowledge.length > 0) {
    const teamText = memory.team_knowledge
      .map(t => `- [${t.category}${t.scope ? ':' + t.scope : ''}] ${t.fact}`)
      .join('\n')
    sections.push(`## Conhecimento da equipe:\n${teamText}`)
  }

  // 3. Episódios recentes (contexto temporal)
  if (memory.recent_episodes.length > 0) {
    const episodesText = memory.recent_episodes
      .map(e => {
        // Converter UTC → São Paulo (UTC-3) antes de formatar
        const utcDate = new Date(e.created_at)
        const spMs = utcDate.getTime() - 3 * 60 * 60000
        const sp = new Date(spMs)
        const dd = sp.getUTCDate().toString().padStart(2, '0')
        const mm = (sp.getUTCMonth() + 1).toString().padStart(2, '0')
        const hh = sp.getUTCHours().toString().padStart(2, '0')
        const min = sp.getUTCMinutes().toString().padStart(2, '0')
        return `- [${dd}/${mm} ${hh}:${min}] ${e.summary}`
      })
      .join('\n')
    sections.push(`## Interações recentes:\n${episodesText}`)
  }

  return sections.length > 0 ? sections.join('\n\n') : ''
}


// ============================================
// ESCRITA
// ============================================

/**
 * Salva episódio (resumo de uma interação). Non-blocking.
 */
export async function saveEpisode(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    userId: string         // profile_id
    summary: string
    entities?: Record<string, any>
    outcome?: string       // action_completed | query_answered | info_provided | conversation | error_occurred | cancelled
    importance?: number    // 0.0 a 1.0
    agentId?: string
    source?: string
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('save_memory_episode', {
      p_user_id: params.userId,
      p_summary: params.summary,
      p_entities: params.entities ?? {},
      p_outcome: params.outcome ?? 'action_completed',
      p_importance: params.importance ?? 0.5,
      p_agent_id: params.agentId ?? null,
      p_source: params.source ?? 'whatsapp',
    })
    if (error) { console.error('[Memory] Error saving episode:', error); return null }
    return data as string
  } catch (err) { console.error('[Memory] Fatal error saving episode:', err); return null }
}

/**
 * Aprende ou reforça fato sobre o usuário. Non-blocking.
 */
export async function learnFact(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    userId: string         // profile_id
    category: string       // preference | pattern | identity | skill | relationship | workflow | communication | schedule | correction
    fact: string
    metadata?: Record<string, any>
    agentId?: string
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('learn_or_reinforce_fact', {
      p_user_id: params.userId,
      p_category: params.category,
      p_fact: params.fact,
      p_metadata: params.metadata ?? {},
      p_agent_id: params.agentId ?? null,
    })
    if (error) { console.error('[Memory] Error learning fact:', error); return null }
    return data as string
  } catch (err) { console.error('[Memory] Fatal error learning fact:', err); return null }
}
