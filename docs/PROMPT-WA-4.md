# 🔍 Prompt WA-04 v2: WhatsApp Agent — Consultas + Sistema de Memória

**Projeto:** LA Studio Manager  
**Data:** 07 de Fevereiro de 2026  
**Dependência:** WA-01 ✅ | WA-02 ✅ | WA-03 ✅  
**Supabase Project:** `rhxqwraqpabgecgojytj`  
**Objetivo:** Implementar consultas reais ao banco (agenda, cards, status) + sistema de memória em 4 camadas que enriquece TODAS as interações do agente — tanto queries quanto ações.

---

## 📋 CONTEXTO — O QUE JÁ EXISTE

### WA-01 (Infraestrutura) ✅
- 6 tabelas WhatsApp criadas (`whatsapp_connections`, `whatsapp_messages`, `whatsapp_conversation_context`, etc.)
- Edge Function `process-whatsapp-message` deployada (v13)
- Webhook UAZAPI operacional
- Função `get_user_by_phone()` retorna `profile_id` + `auth_user_id` + `full_name`

### WA-02 (NLP Classifier) ✅
- Gemini 2.0 Flash classifica mensagens em intents
- Intents de query já classificados: `query_calendar`, `query_cards`, `query_projects`, `generate_report`
- Entidades extraídas para queries: `query_period`, `query_filter`, `priority`, `column`, `brand`
- **Handlers de query são PLACEHOLDER** — retornam "(Em breve!)"

### WA-03 (Action Executor) ✅
- "sim" executa INSERT real em `kanban_cards`, `calendar_items`, `whatsapp_scheduled_messages`
- Confirmação interceptada ANTES do Gemini (economiza API calls)
- Realtime faz registros aparecerem no dashboard instantaneamente
- `authUserId` já é resolvido no início do `routeMessage` via `user.auth_user_id` — **REUSAR, NÃO duplicar!**

### Arquivos atuais da Edge Function:
```
supabase/functions/process-whatsapp-message/
├── index.ts              ← Entry point (NÃO modificar)
├── types.ts              ← Tipos (ADICIONAR: tipos de memória)
├── utils.ts              ← Helpers (NÃO modificar)
├── message-router.ts     ← Router principal (MODIFICAR: memória + queries)
├── gemini-classifier.ts  ← Classificador NLP (MODIFICAR: injetar memória no prompt)
├── action-executor.ts    ← Executor WA-03 (NÃO modificar)
├── send-message.ts       ← Envio UAZAPI (NÃO modificar)
├── memory-manager.ts     ← ✨ NOVO: gerenciador de memória
└── query-handler.ts      ← ✨ NOVO: executor de consultas
```

### ⚠️ DOIS IDs DIFERENTES — CRÍTICO
```
user_profiles.id       (profile_id)    → usar em whatsapp_*, agent_memory_*
user_profiles.user_id  (auth_user_id)  → usar em kanban_cards.created_by, calendar_items.created_by,
                                          kanban_cards.responsible_user_id, calendar_items.responsible_user_id
```

### ⚠️ FKs DE responsible_user_id APONTAM PARA auth.users — CRÍTICO
```
kanban_cards.responsible_user_id     → REFERENCES auth.users(id)  (NÃO user_profiles!)
calendar_items.responsible_user_id   → REFERENCES auth.users(id)  (NÃO user_profiles!)
kanban_cards.created_by              → REFERENCES auth.users(id)
calendar_items.created_by            → REFERENCES auth.users(id)
```
**NÃO é possível fazer join PostgREST entre kanban_cards/calendar_items e user_profiles via responsible_user_id.**
Para obter nomes de responsáveis, usar **lookup manual**: buscar os `responsible_user_id`, depois consultar `user_profiles WHERE user_id IN (...)`.

---

## 🗄️ SCHEMA DAS TABELAS EXISTENTES (referência para consultas)

### kanban_columns (lookup — não modificar)
```sql
-- Slugs reais: 'brainstorming', 'planning', 'todo', 'capturing', 'editing',
--              'awaiting_approval', 'approved', 'published', 'archived'
-- Cada coluna tem: id, name, slug, description, color, position, card_limit
```

### kanban_cards (consultar)
```sql
CREATE TABLE kanban_cards (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  card_type card_type DEFAULT 'single_post',   -- ENUM: single_post | campaign
  column_id uuid REFERENCES kanban_columns(id),
  position_in_column integer DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),          -- ← auth_user_id
  responsible_user_id uuid REFERENCES auth.users(id),  -- ← auth_user_id (FK → auth.users!)
  priority text DEFAULT 'medium',   -- urgent | high | medium | low
  due_date timestamptz,
  content_type text,   -- video | carousel | reels | story | photo | live
  platforms text[] DEFAULT '{}',
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  moved_to_column_at timestamptz,
  deleted_at timestamptz,   -- soft delete (NULL = ativo)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### calendar_items (consultar)
```sql
CREATE TABLE calendar_items (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  type calendar_item_type DEFAULT 'task',   -- ENUM: event | delivery | creation | task | meeting
  status text DEFAULT 'pending',            -- ⚠️ DEFAULT = 'pending' (NÃO 'scheduled')
  -- Valores reais: pending | in_progress | completed | cancelled
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean DEFAULT false,
  color text,
  created_by uuid REFERENCES auth.users(id),          -- ← auth_user_id
  responsible_user_id uuid REFERENCES auth.users(id),  -- ← auth_user_id (FK → auth.users!)
  kanban_card_id uuid REFERENCES kanban_cards(id),
  platforms text[] DEFAULT '{}',
  content_type text,
  metadata jsonb DEFAULT '{}',
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### user_profiles (para resolver nomes via lookup manual)
```sql
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY,                          -- profile_id
  user_id uuid REFERENCES auth.users(id),       -- auth_user_id
  full_name text,
  avatar_url text,
  role text DEFAULT 'viewer'                    -- admin | editor | viewer | developer
);
```

---

## 🆕 PARTE A — MIGRATION SQL (executar no Supabase SQL Editor PRIMEIRO)

```sql
-- ============================================
-- MIGRATION: agent_memory_system
-- LA Studio Manager — WA-04: Memória dos Agentes
-- 07/02/2026
-- ============================================

-- ──────────────────────────────────────────
-- 1. EPISODIC MEMORY — Resumos de conversa
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_memory_episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  entities JSONB DEFAULT '{}',
  outcome TEXT CHECK (outcome IN (
    'action_completed', 'query_answered', 'info_provided',
    'conversation', 'error_occurred', 'cancelled'
  )),
  messages_from TIMESTAMPTZ,
  messages_to TIMESTAMPTZ,
  message_count INTEGER DEFAULT 1,
  source TEXT DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'dashboard', 'api')),
  importance DECIMAL(3,2) DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mem_episodes_user ON agent_memory_episodes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mem_episodes_importance ON agent_memory_episodes(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_mem_episodes_entities ON agent_memory_episodes USING GIN (entities jsonb_path_ops);


-- ──────────────────────────────────────────
-- 2. SEMANTIC MEMORY — Fatos aprendidos
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  learned_by_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN (
    'preference', 'pattern', 'identity', 'skill', 'relationship',
    'workflow', 'communication', 'schedule', 'correction'
  )),
  fact TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  reinforcement_count INTEGER DEFAULT 1,
  last_observed_at TIMESTAMPTZ DEFAULT NOW(),
  user_confirmed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mem_facts_active ON agent_memory_facts(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_mem_facts_confidence ON agent_memory_facts(user_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_mem_facts_metadata ON agent_memory_facts USING GIN (metadata jsonb_path_ops);


-- ──────────────────────────────────────────
-- 3. TEAM MEMORY — Conhecimento compartilhado
-- ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_memory_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN (
    'team_member', 'brand_rule', 'process', 'platform_rule', 'client_info',
    'glossary', 'tool', 'schedule_rule', 'quality_standard', 'general'
  )),
  fact TEXT NOT NULL,
  scope TEXT,
  metadata JSONB DEFAULT '{}',
  created_by_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  learned_by_agent_id UUID REFERENCES ai_agents(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'learned' CHECK (source IN ('manual', 'learned', 'imported', 'system')),
  confidence DECIMAL(3,2) DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mem_team_category ON agent_memory_team(category);
CREATE INDEX IF NOT EXISTS idx_mem_team_scope ON agent_memory_team(scope) WHERE scope IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mem_team_active ON agent_memory_team(is_active) WHERE is_active = TRUE;


-- ============================================
-- RLS POLICIES (restritivas para episodes/facts, abertas para team)
-- ============================================
-- Edge Functions usam service_role key → bypass RLS automaticamente.
-- Policies protegem acesso via dashboard (anon/authenticated).

ALTER TABLE agent_memory_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory_team ENABLE ROW LEVEL SECURITY;

-- Episódios: só dono vê/edita (via user_profiles → auth.uid() match)
CREATE POLICY "episodes_select" ON agent_memory_episodes FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "episodes_insert" ON agent_memory_episodes FOR INSERT
  WITH CHECK (true);  -- Edge Function insere via service_role
CREATE POLICY "episodes_update" ON agent_memory_episodes FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

-- Fatos: só dono vê/edita
CREATE POLICY "facts_select" ON agent_memory_facts FOR SELECT
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "facts_insert" ON agent_memory_facts FOR INSERT
  WITH CHECK (true);
CREATE POLICY "facts_update" ON agent_memory_facts FOR UPDATE
  USING (user_id IN (SELECT id FROM user_profiles WHERE user_id = auth.uid()));

-- Team: todos lêem, inserção/edição livre (conhecimento compartilhado)
CREATE POLICY "team_select" ON agent_memory_team FOR SELECT USING (true);
CREATE POLICY "team_insert" ON agent_memory_team FOR INSERT WITH CHECK (true);
CREATE POLICY "team_update" ON agent_memory_team FOR UPDATE USING (true);
CREATE POLICY "team_delete" ON agent_memory_team FOR DELETE USING (true);


-- ============================================
-- FUNCTIONS
-- ============================================

-- Busca memória completa para injetar no prompt do agente
-- FIX v2: episódios limitados a 30 dias (safety net até cron WA-05)
CREATE OR REPLACE FUNCTION get_agent_memory_context(
  p_user_id UUID,
  p_max_episodes INTEGER DEFAULT 5,
  p_max_facts INTEGER DEFAULT 20,
  p_max_team INTEGER DEFAULT 15
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  v_episodes JSONB;
  v_facts JSONB;
  v_team JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(e ORDER BY e.created_at DESC), '[]'::jsonb) INTO v_episodes
  FROM (
    SELECT summary, outcome, entities, importance, created_at
    FROM agent_memory_episodes
    WHERE user_id = p_user_id
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY importance DESC, created_at DESC
    LIMIT p_max_episodes
  ) e;

  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) INTO v_facts
  FROM (
    SELECT category, fact, metadata, confidence, reinforcement_count, user_confirmed
    FROM agent_memory_facts
    WHERE user_id = p_user_id AND is_active = TRUE
    ORDER BY user_confirmed DESC, confidence DESC, reinforcement_count DESC
    LIMIT p_max_facts
  ) f;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_team
  FROM (
    SELECT category, fact, scope, metadata, is_verified
    FROM agent_memory_team
    WHERE is_active = TRUE
    ORDER BY is_verified DESC, confidence DESC
    LIMIT p_max_team
  ) t;

  result := jsonb_build_object(
    'recent_episodes', v_episodes,
    'user_facts', v_facts,
    'team_knowledge', v_team,
    'retrieved_at', NOW()
  );
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Registrar episódio após interação
CREATE OR REPLACE FUNCTION save_memory_episode(
  p_user_id UUID,
  p_summary TEXT,
  p_entities JSONB DEFAULT '{}',
  p_outcome TEXT DEFAULT 'action_completed',
  p_importance DECIMAL DEFAULT 0.5,
  p_agent_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'whatsapp'
)
RETURNS UUID AS $$
DECLARE
  episode_id UUID;
BEGIN
  INSERT INTO agent_memory_episodes (
    user_id, agent_id, summary, entities, outcome,
    importance, source, messages_from, messages_to
  ) VALUES (
    p_user_id, p_agent_id, p_summary, p_entities, p_outcome,
    p_importance, p_source, NOW(), NOW()
  )
  RETURNING id INTO episode_id;
  RETURN episode_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Aprender ou reforçar fato (dedup automático)
-- FIX v2: prioriza match por metadata->>'applies_to', substring aumentado para 50 chars
CREATE OR REPLACE FUNCTION learn_or_reinforce_fact(
  p_user_id UUID,
  p_category TEXT,
  p_fact TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_agent_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  existing_id UUID;
  fact_id UUID;
BEGIN
  -- Primeiro: match por metadata applies_to (mais preciso)
  IF p_metadata ? 'applies_to' THEN
    SELECT id INTO existing_id
    FROM agent_memory_facts
    WHERE user_id = p_user_id
      AND category = p_category
      AND is_active = TRUE
      AND metadata->>'applies_to' = p_metadata->>'applies_to'
    LIMIT 1;
  END IF;

  -- Fallback: match por substring (50 chars, menos falsos positivos)
  IF existing_id IS NULL THEN
    SELECT id INTO existing_id
    FROM agent_memory_facts
    WHERE user_id = p_user_id
      AND category = p_category
      AND is_active = TRUE
      AND fact ILIKE '%' || LEFT(p_fact, 50) || '%'
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    UPDATE agent_memory_facts
    SET reinforcement_count = reinforcement_count + 1,
        confidence = LEAST(confidence + 0.1, 1.0),
        last_observed_at = NOW(),
        updated_at = NOW(),
        fact = CASE WHEN LENGTH(p_fact) > LENGTH(fact) THEN p_fact ELSE fact END,
        metadata = metadata || p_metadata
    WHERE id = existing_id
    RETURNING id INTO fact_id;
  ELSE
    INSERT INTO agent_memory_facts (
      user_id, learned_by_agent_id, category, fact, metadata
    ) VALUES (
      p_user_id, p_agent_id, p_category, p_fact, p_metadata
    )
    RETURNING id INTO fact_id;
  END IF;

  RETURN fact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Cleanup: episódios antigos com baixa importância
CREATE OR REPLACE FUNCTION cleanup_old_episodes()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  DELETE FROM agent_memory_episodes
  WHERE created_at < NOW() - INTERVAL '90 days' AND importance < 0.3;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Decay: fatos não observados há muito tempo
CREATE OR REPLACE FUNCTION decay_stale_facts()
RETURNS INTEGER AS $$
DECLARE decayed_count INTEGER;
BEGIN
  UPDATE agent_memory_facts
  SET is_active = FALSE
  WHERE last_observed_at < NOW() - INTERVAL '180 days'
    AND confidence < 0.3
    AND user_confirmed = FALSE
    AND is_active = TRUE;
  GET DIAGNOSTICS decayed_count = ROW_COUNT;
  RETURN decayed_count;
END;
$$ LANGUAGE plpgsql;


-- ============================================
-- RPC: contagem de cards por coluna (evita N+1 queries)
-- ============================================
CREATE OR REPLACE FUNCTION get_cards_count_by_column()
RETURNS TABLE(column_id UUID, card_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT kc.column_id, COUNT(*)::BIGINT as card_count
  FROM kanban_cards kc
  WHERE kc.deleted_at IS NULL
  GROUP BY kc.column_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- SEED DATA — Conhecimento inicial da equipe
-- ============================================

INSERT INTO agent_memory_team (category, fact, scope, metadata, source, is_verified) VALUES
  ('team_member', 
   'Yuri é o diretor criativo e admin principal do sistema. Gerencia todos os projetos de LA Music e LA Kids.', 
   'general', '{"role": "admin", "brands": ["la_music", "la_kids"]}', 'system', TRUE),

  ('brand_rule', 
   'LA Music é a marca principal de produção musical e conteúdo audiovisual.', 
   'la_music', '{"type": "brand", "primary": true}', 'system', TRUE),

  ('brand_rule', 
   'LA Kids é a marca focada em conteúdo infantil e educacional.',
   'la_kids', '{"type": "brand"}', 'system', TRUE),

  ('process', 
   'Fluxo padrão de criação de conteúdo: Brainstorming → Planejamento → ToDo → Captação → Edição → Aguardando Aprovação → Aprovado → Publicado.',
   'general', '{"maps_to_columns": ["brainstorming","planning","todo","capturing","editing","awaiting_approval","approved","published"]}', 'system', TRUE),

  ('platform_rule', 
   'Conteúdo de vídeo curto (Reels/TikTok) deve ter no máximo 90 segundos.',
   'general', '{"platforms": ["instagram","tiktok"], "max_duration_seconds": 90}', 'system', TRUE),

  ('quality_standard',
   'Todo conteúdo precisa de aprovação antes de ser publicado. Não pular a coluna awaiting_approval.',
   'general', '{"enforced": true}', 'system', TRUE);
```

### ✅ Verificação pós-migration
```sql
SELECT 'agent_memory_episodes' as tabela, count(*) FROM agent_memory_episodes
UNION ALL SELECT 'agent_memory_facts', count(*) FROM agent_memory_facts
UNION ALL SELECT 'agent_memory_team', count(*) FROM agent_memory_team;
-- Esperado: episodes=0, facts=0, team=6

SELECT * FROM get_cards_count_by_column();
-- Deve retornar contagem de cards por coluna
```

---

## 🆕 PARTE B — NOVO ARQUIVO: `memory-manager.ts`

**Criar:** `supabase/functions/process-whatsapp-message/memory-manager.ts`

```typescript
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
 * Formata memória como texto para injetar no system prompt do Gemini.
 * FIX v2: Datas de episódios convertidas para São Paulo (UTC-3).
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
        // FIX v2: Converter UTC → São Paulo (UTC-3) antes de formatar
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
```

---

## 🆕 PARTE C — NOVO ARQUIVO: `query-handler.ts`

**Criar:** `supabase/functions/process-whatsapp-message/query-handler.ts`

⚠️ **ATENÇÃO — DECISÃO ARQUITETURAL CRÍTICA:**
- Este arquivo **NÃO usa joins PostgREST** para resolver nomes de responsáveis.
- As FKs `responsible_user_id` apontam para `auth.users`, não para `user_profiles`.
- Para obter nomes, usamos **`resolveUserNames()`** — lookup manual via `user_profiles.user_id`.
- O join de `column` (kanban_cards → kanban_columns) funciona normalmente porque é FK direta.

```typescript
/**
 * query-handler.ts — WA-04
 * Executa consultas reais ao banco para responder perguntas via WhatsApp.
 * 
 * ⚠️ responsible_user_id referencia auth.users, NÃO user_profiles.
 * Para obter nomes, fazemos lookup manual via user_profiles.user_id.
 */

import type { ExtractedEntities } from './gemini-classifier.ts'

// ============================================
// TIPOS
// ============================================

export interface QueryResult {
  text: string            // Mensagem formatada para WhatsApp
  resultCount: number     // Quantos itens retornaram
  queryType: string       // Para episódio de memória
}

interface QueryContext {
  supabase: any
  profileId: string       // user_profiles.id
  authUserId: string      // auth.users.id (vem do WA-03, já resolvido)
  userName: string
  entities: ExtractedEntities
}

// ============================================
// HELPER: Resolver nomes de auth_user_ids
// ============================================

/**
 * Recebe array de auth.users.id e retorna mapa { auth_user_id → full_name }.
 * Usa user_profiles.user_id para o lookup (user_id = auth_user_id).
 */
async function resolveUserNames(
  supabase: any,
  authUserIds: string[]
): Promise<Record<string, string>> {
  const nameMap: Record<string, string> = {}
  if (!authUserIds || authUserIds.length === 0) return nameMap

  // Deduplicar e filtrar nulls
  const uniqueIds = [...new Set(authUserIds.filter(Boolean))]
  if (uniqueIds.length === 0) return nameMap

  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('user_id, full_name')
    .in('user_id', uniqueIds)

  if (error || !profiles) {
    console.error('[WA-04] resolveUserNames error:', error)
    return nameMap
  }

  for (const p of profiles) {
    if (p.user_id && p.full_name) {
      nameMap[p.user_id] = p.full_name
    }
  }

  return nameMap
}

// ============================================
// HELPERS DE DATA — Timezone São Paulo (UTC-3)
// FIX v2: Usa Date.now() e Date.UTC() — funciona em qualquer runtime
// ============================================

/**
 * "Agora" em São Paulo. Funciona independente do timezone do runtime.
 */
function getSPNow(): Date {
  return new Date(Date.now() - 3 * 60 * 60000)
}

/**
 * Retorna { start, end } em UTC para o período solicitado.
 * Cálculos feitos em "hora SP", convertidos para UTC via Date.UTC(h+3).
 */
function getDateRange(period: string): { start: Date; end: Date } {
  const sp = getSPNow()
  const spYear = sp.getUTCFullYear()
  const spMonth = sp.getUTCMonth()
  const spDate = sp.getUTCDate()
  const spDay = sp.getUTCDay() // 0=dom

  // Cria timestamp UTC a partir de "hora SP" (soma 3h para converter SP→UTC)
  function spToUtc(y: number, m: number, d: number, h: number, min: number): Date {
    return new Date(Date.UTC(y, m, d, h + 3, min))
  }

  switch (period) {
    case 'today':
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }

    case 'tomorrow': {
      const tmrDate = spDate + 1 // Date.UTC normaliza overflow automaticamente
      return {
        start: spToUtc(spYear, spMonth, tmrDate, 0, 0),
        end: spToUtc(spYear, spMonth, tmrDate, 23, 59),
      }
    }

    case 'this_week': {
      // Segunda a Domingo da semana atual
      const mondayOffset = spDay === 0 ? -6 : 1 - spDay
      const mondayDate = spDate + mondayOffset
      return {
        start: spToUtc(spYear, spMonth, mondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, mondayDate + 6, 23, 59),
      }
    }

    case 'next_week': {
      const daysToNextMon = spDay === 0 ? 1 : 8 - spDay
      const nextMondayDate = spDate + daysToNextMon
      return {
        start: spToUtc(spYear, spMonth, nextMondayDate, 0, 0),
        end: spToUtc(spYear, spMonth, nextMondayDate + 6, 23, 59),
      }
    }

    case 'this_month':
      return {
        start: spToUtc(spYear, spMonth, 1, 0, 0),
        end: spToUtc(spYear, spMonth + 1, 0, 23, 59), // dia 0 do mês seguinte = último dia
      }

    default: // fallback: hoje
      return {
        start: spToUtc(spYear, spMonth, spDate, 0, 0),
        end: spToUtc(spYear, spMonth, spDate, 23, 59),
      }
  }
}

function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  return `${days[sp.getUTCDay()]} ${sp.getUTCDate().toString().padStart(2,'0')}/${(sp.getUTCMonth()+1).toString().padStart(2,'0')} ${sp.getUTCHours().toString().padStart(2,'0')}:${sp.getUTCMinutes().toString().padStart(2,'0')}`
}

function formatDateOnlyBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const sp = new Date(d.getTime() - 3 * 60 * 60000)
  return `${sp.getUTCDate().toString().padStart(2,'0')}/${(sp.getUTCMonth()+1).toString().padStart(2,'0')}`
}

function getPeriodLabel(period: string): string {
  return ({ today: 'hoje', tomorrow: 'amanhã', this_week: 'esta semana', next_week: 'semana que vem', this_month: 'este mês' } as Record<string,string>)[period] || period
}

function getPriorityEmoji(p: string): string {
  return ({ urgent: '🔴', high: '🟠', medium: '🟡', low: '⚪' } as Record<string,string>)[p] || '🟡'
}

function getCalendarTypeEmoji(t: string): string {
  return ({ event: '🎉', delivery: '📦', creation: '🎨', task: '✅', meeting: '🤝' } as Record<string,string>)[t] || '📅'
}

// ============================================
// QUERY: CALENDÁRIO
// ============================================

export async function handleQueryCalendar(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx
  const period = entities.query_period || 'today'
  const { start, end } = getDateRange(period)

  console.log(`[WA-04] Query calendar: period=${period}, range=${start.toISOString()} → ${end.toISOString()}`)

  // Buscar itens SEM join de responsible (FK → auth.users, não user_profiles)
  let query = supabase
    .from('calendar_items')
    .select('id, title, type, status, start_time, end_time, all_day, content_type, platforms, responsible_user_id')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .order('start_time', { ascending: true })
    .limit(20)

  // Filtro por tipo se especificado
  if (entities.query_filter) {
    const filter = entities.query_filter.toLowerCase()
    if (['event', 'delivery', 'creation', 'task', 'meeting'].includes(filter)) {
      query = query.eq('type', filter)
    }
  }

  const { data: items, error } = await query

  if (error) {
    console.error('[WA-04] Calendar query error:', error)
    return { text: `❌ Erro ao consultar agenda, ${userName}. Tente novamente.`, resultCount: 0, queryType: 'query_calendar' }
  }

  if (!items || items.length === 0) {
    return {
      text: `📅 Nenhum item na agenda para ${getPeriodLabel(period)}, ${userName}.\n\nQuer adicionar algo? Ex: "agenda reunião pra sexta às 14h"`,
      resultCount: 0, queryType: 'query_calendar',
    }
  }

  // Resolver nomes via lookup manual
  const responsibleIds = items.map((i: any) => i.responsible_user_id).filter(Boolean)
  const nameMap = await resolveUserNames(supabase, responsibleIds)

  const header = `📅 *Agenda ${getPeriodLabel(period)}* (${items.length} ${items.length === 1 ? 'item' : 'itens'}):\n`

  const lines = items.map((item: any, i: number) => {
    const emoji = getCalendarTypeEmoji(item.type)
    const time = item.all_day ? '🕐 Dia inteiro' : formatDateTimeBR(item.start_time)
    const responsible = item.responsible_user_id ? nameMap[item.responsible_user_id] : null
    const responsibleText = responsible ? ` → ${responsible}` : ''
    const statusEmoji = item.status === 'completed' ? ' ✅' : item.status === 'in_progress' ? ' 🔄' : ''
    return `${i + 1}. ${emoji} *${item.title}*${statusEmoji}\n   ${time}${responsibleText}`
  })

  return { text: header + lines.join('\n\n'), resultCount: items.length, queryType: 'query_calendar' }
}

// ============================================
// QUERY: CARDS / KANBAN
// ============================================

export async function handleQueryCards(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx

  console.log(`[WA-04] Query cards: filter=${entities.query_filter}, priority=${entities.priority}, column=${entities.column}`)

  // Join de column OK (kanban_cards.column_id → kanban_columns.id é FK direta)
  // SEM join de responsible (FK → auth.users)
  let query = supabase
    .from('kanban_cards')
    .select(`
      id, title, priority, due_date, content_type, platforms, tags,
      responsible_user_id,
      column:kanban_columns!kanban_cards_column_id_fkey(name, slug)
    `)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(15)

  // Filtro por prioridade
  if (entities.priority) {
    query = query.eq('priority', entities.priority)
  }

  // Filtro por coluna (resolver slug → column_id)
  if (entities.column) {
    const slugMap: Record<string, string> = {
      'brainstorm': 'brainstorming', 'brainstorming': 'brainstorming',
      'planning': 'planning', 'todo': 'todo', 'capturing': 'capturing',
      'editing': 'editing', 'awaiting_approval': 'awaiting_approval',
      'approved': 'approved', 'published': 'published', 'archived': 'archived',
    }
    const realSlug = slugMap[entities.column] || entities.column

    const { data: col } = await supabase
      .from('kanban_columns').select('id').eq('slug', realSlug).single()

    if (col?.id) {
      query = query.eq('column_id', col.id)
    }
  }

  // Filtro por marca (tag)
  if (entities.brand) {
    query = query.contains('tags', [entities.brand])
  }

  // Excluir archived + published por padrão (quando não filtrando coluna específica)
  if (!entities.column) {
    const { data: excludedCols } = await supabase
      .from('kanban_columns').select('id').in('slug', ['archived', 'published'])

    if (excludedCols && excludedCols.length > 0) {
      for (const exCol of excludedCols) {
        query = query.neq('column_id', exCol.id)
      }
    }
  }

  const { data: cards, error } = await query

  if (error) {
    console.error('[WA-04] Cards query error:', error)
    return { text: `❌ Erro ao consultar cards, ${userName}. Tente novamente.`, resultCount: 0, queryType: 'query_cards' }
  }

  if (!cards || cards.length === 0) {
    const filterDesc = entities.priority
      ? `com prioridade ${entities.priority}`
      : entities.column ? `na coluna ${entities.column}` : 'ativos'
    return {
      text: `📋 Nenhum card ${filterDesc} encontrado, ${userName}.\n\nQuer criar um? Ex: "cria card urgente pra gravar vídeo"`,
      resultCount: 0, queryType: 'query_cards',
    }
  }

  // Resolver nomes via lookup manual
  const responsibleIds = cards.map((c: any) => c.responsible_user_id).filter(Boolean)
  const nameMap = await resolveUserNames(supabase, responsibleIds)

  const filterLabel = entities.priority
    ? `prioridade ${entities.priority}`
    : entities.column ? `coluna ${entities.column}` : 'ativos'

  const header = `📋 *Cards ${filterLabel}* (${cards.length}):\n`

  const lines = cards.map((card: any, i: number) => {
    const emoji = getPriorityEmoji(card.priority)
    const colName = card.column?.name || '?'
    const responsible = card.responsible_user_id ? nameMap[card.responsible_user_id] : null
    const dueText = card.due_date ? `\n   📅 ${formatDateOnlyBR(card.due_date)}` : ''
    const responsibleText = responsible ? ` → ${responsible}` : ''
    return `${i + 1}. ${emoji} *${card.title}*\n   📍 ${colName}${responsibleText}${dueText}`
  })

  return { text: header + lines.join('\n\n'), resultCount: cards.length, queryType: 'query_cards' }
}

// ============================================
// QUERY: STATUS DO PROJETO
// FIX v2: Usa RPC get_cards_count_by_column() — 1 query em vez de N
// ============================================

export async function handleQueryProjects(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName } = ctx

  console.log(`[WA-04] Query projects`)

  // Buscar colunas
  const { data: columns, error: colError } = await supabase
    .from('kanban_columns')
    .select('id, name, slug, position')
    .order('position', { ascending: true })

  if (colError || !columns) {
    return { text: `❌ Erro ao consultar projeto, ${userName}.`, resultCount: 0, queryType: 'query_projects' }
  }

  // FIX v2: Uma única query via RPC em vez de N queries sequenciais
  const { data: cardCounts, error: countError } = await supabase.rpc('get_cards_count_by_column')

  const countMap: Record<string, number> = {}
  if (!countError && cardCounts) {
    for (const row of cardCounts) {
      countMap[row.column_id] = Number(row.card_count)
    }
  }

  let totalCards = 0
  const counts = columns.map((col: any) => {
    const c = countMap[col.id] || 0
    totalCards += c
    return { name: col.name, count: c, slug: col.slug }
  })

  // Cards urgentes (1 query)
  const { count: urgentCount } = await supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .eq('priority', 'urgent')
    .is('deleted_at', null)

  // Cards com prazo vencido (excluindo published/archived)
  const finishedIds = columns
    .filter((c: any) => ['published', 'archived'].includes(c.slug))
    .map((c: any) => c.id)

  let overdueQuery = supabase
    .from('kanban_cards')
    .select('id', { count: 'exact', head: true })
    .lt('due_date', new Date().toISOString())
    .is('deleted_at', null)

  for (const fId of finishedIds) {
    overdueQuery = overdueQuery.neq('column_id', fId)
  }
  const { count: overdueCount } = await overdueQuery

  // Formatar
  const header = `📊 *Status do Projeto* (${totalCards} cards total):\n`

  const colLines = counts
    .filter((c: any) => c.count > 0)
    .map((c: any) => {
      const bar = '█'.repeat(Math.min(c.count, 10)) + (c.count > 10 ? '…' : '')
      return `  ${c.name}: ${c.count} ${bar}`
    })

  const alerts: string[] = []
  if (urgentCount && urgentCount > 0) alerts.push(`🔴 ${urgentCount} card(s) urgente(s)`)
  if (overdueCount && overdueCount > 0) alerts.push(`⚠️ ${overdueCount} card(s) com prazo vencido`)

  const alertSection = alerts.length > 0 ? `\n\n*Alertas:*\n${alerts.join('\n')}` : ''

  return { text: header + colLines.join('\n') + alertSection, resultCount: totalCards, queryType: 'query_projects' }
}

// ============================================
// QUERY: RELATÓRIO / RESUMO
// ============================================

export async function handleGenerateReport(ctx: QueryContext): Promise<QueryResult> {
  const { supabase, userName, entities } = ctx
  const period = entities.query_period || 'this_week'
  const { start, end } = getDateRange(period)

  console.log(`[WA-04] Generate report: period=${period}`)

  // Cards criados no período
  const { data: newCards } = await supabase
    .from('kanban_cards')
    .select('id, title, priority, column:kanban_columns!kanban_cards_column_id_fkey(name)')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  // Cards publicados no período
  const { data: publishedCol } = await supabase
    .from('kanban_columns').select('id').eq('slug', 'published').single()

  let publishedCount = 0
  if (publishedCol?.id) {
    const { count } = await supabase
      .from('kanban_cards')
      .select('id', { count: 'exact', head: true })
      .eq('column_id', publishedCol.id)
      .gte('moved_to_column_at', start.toISOString())
      .lte('moved_to_column_at', end.toISOString())
      .is('deleted_at', null)
    publishedCount = count ?? 0
  }

  // Calendar items no período
  const { data: events } = await supabase
    .from('calendar_items')
    .select('id, title, type, status')
    .gte('start_time', start.toISOString())
    .lte('start_time', end.toISOString())
    .is('deleted_at', null)
    .neq('status', 'cancelled')

  const completedEvents = events?.filter((e: any) => e.status === 'completed').length ?? 0
  const totalEvents = events?.length ?? 0
  const newCardsCount = newCards?.length ?? 0

  const header = `📈 *Resumo ${getPeriodLabel(period)}*\n`

  const sections = [
    `📋 *Cards criados:* ${newCardsCount}`,
    `✅ *Cards publicados:* ${publishedCount}`,
    `📅 *Eventos:* ${totalEvents} (${completedEvents} concluído${completedEvents !== 1 ? 's' : ''})`,
  ]

  if (newCards && newCards.length > 0) {
    const topCards = newCards.slice(0, 5).map((c: any, i: number) =>
      `   ${i + 1}. ${getPriorityEmoji(c.priority)} ${c.title} → ${c.column?.name || '?'}`
    ).join('\n')
    sections.push(`\n📝 *Últimos cards criados:*\n${topCards}`)
  }

  return { text: header + sections.join('\n'), resultCount: newCardsCount + totalEvents, queryType: 'generate_report' }
}
```

---

## ✏️ PARTE D — MODIFICAR `gemini-classifier.ts`

### D.1 — Alterar assinatura de `classifyMessage`

```typescript
// ANTES (WA-02):
export async function classifyMessage(
  text: string,
  userName: string,
  conversationContext?: string
): Promise<ClassificationResult> {

// DEPOIS (WA-04) — adicionar 4º parâmetro:
export async function classifyMessage(
  text: string,
  userName: string,
  conversationContext?: string,
  memoryContext?: string
): Promise<ClassificationResult> {
```

### D.2 — Injetar memória no userMessage

**Localizar** onde `userMessage` é montado (APÓS o bloco de `conversationContext`) e **adicionar** este bloco:

```typescript
  // ↓↓↓ ADICIONAR ESTE BLOCO (WA-04) ↓↓↓
  if (memoryContext) {
    userMessage = `MEMÓRIA DO AGENTE (use para personalizar resposta e inferir contexto):\n${memoryContext}\n\n${userMessage}`
  }
  // ↑↑↑ FIM DO BLOCO WA-04 ↑↑↑
```

**Nada mais a alterar.** O `fallbackClassification` é regex simples e não precisa de memória.

---

## ✏️ PARTE E — MODIFICAR `message-router.ts`

### E.1 — Adicionar imports no topo

```typescript
// WA-04: Imports de memória e consultas
import { loadMemoryContext, formatMemoryForPrompt, saveEpisode, learnFact } from './memory-manager.ts'
import { handleQueryCalendar, handleQueryCards, handleQueryProjects, handleGenerateReport } from './query-handler.ts'
```

### E.2 — Carregar memória ANTES da classificação

**Localizar** no `routeMessage()`:
- DEPOIS do bloco de interceptação de confirmação WA-03
- ANTES de `// CLASSIFICAR MENSAGEM COM GEMINI`

**Adicionar entre esses dois blocos:**

```typescript
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
```

**⚠️ NÃO adicionar bloco `resolvedAuthUserId`!** O `authUserId` já existe no início do `routeMessage` (via `user.auth_user_id` do WA-03). Reusar diretamente nos QueryContext.

### E.3 — Passar memória para classifyMessage

```typescript
  // ANTES (WA-02/03):
  const classification = await classifyMessage(text, userName, conversationContext)

  // DEPOIS (WA-04):
  const classification = await classifyMessage(text, userName, conversationContext, memoryPrompt)
```

### E.4 — Substituir os 4 cases de query placeholder

**Localizar** no switch os cases `query_calendar`, `query_cards`, `query_projects`, `generate_report` que retornam "(Em breve!)" e **substituir por:**

```typescript
    case 'query_calendar': {
      const qCtx = { supabase, profileId: userId, authUserId, userName, entities: classification.entities }
      const result = await handleQueryCalendar(qCtx)

      // Salvar episódio (non-blocking)
      saveEpisode(supabase, {
        userId,
        summary: `${userName} consultou agenda (${classification.entities.query_period || 'hoje'}). ${result.resultCount} itens.`,
        entities: { query_type: 'calendar', period: classification.entities.query_period, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.3,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'query_calendar', confidence: classification.confidence }
    }

    case 'query_cards': {
      const qCtx = { supabase, profileId: userId, authUserId, userName, entities: classification.entities }
      const result = await handleQueryCards(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${userName} consultou cards${classification.entities.priority ? ` (${classification.entities.priority})` : ''}${classification.entities.column ? ` coluna ${classification.entities.column}` : ''}. ${result.resultCount} encontrados.`,
        entities: { query_type: 'cards', priority: classification.entities.priority, column: classification.entities.column, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.3,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      // Aprender padrão de consulta
      if (classification.entities.priority) {
        learnFact(supabase, {
          userId, category: 'pattern',
          fact: `${userName} frequentemente consulta cards com prioridade "${classification.entities.priority}".`,
          metadata: { applies_to: 'query_cards', priority: classification.entities.priority },
        }).catch(e => console.error('[WA-04] Fact learn error:', e))
      }

      return { text: result.text, intent: 'query_cards', confidence: classification.confidence }
    }

    case 'query_projects': {
      const qCtx = { supabase, profileId: userId, authUserId, userName, entities: classification.entities }
      const result = await handleQueryProjects(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${userName} consultou status do projeto. ${result.resultCount} cards total.`,
        entities: { query_type: 'projects', result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.4,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'query_projects', confidence: classification.confidence }
    }

    case 'generate_report': {
      const qCtx = { supabase, profileId: userId, authUserId, userName, entities: classification.entities }
      const result = await handleGenerateReport(qCtx)

      saveEpisode(supabase, {
        userId,
        summary: `${userName} pediu relatório (${classification.entities.query_period || 'esta semana'}). ${result.resultCount} itens.`,
        entities: { query_type: 'report', period: classification.entities.query_period, result_count: result.resultCount },
        outcome: 'query_answered',
        importance: 0.5,
      }).catch(e => console.error('[WA-04] Episode save error:', e))

      return { text: result.text, intent: 'generate_report', confidence: classification.confidence }
    }
```

### E.5 — Salvar episódios nas ações WA-03

**Localizar** no bloco de confirmação "sim", APÓS `executeConfirmedAction` retornar e ANTES do `return`. Adicionar:

```typescript
        // WA-04: Salvar episódio + aprender fatos
        if (result.success && supabase && userId) {
          const ents = activeContext.context_data?.entities || {}

          saveEpisode(supabase, {
            userId,
            summary: `${userName} confirmou ${activeContext.context_type}: "${ents.title || 'sem título'}".`,
            entities: {
              action_type: activeContext.context_type, record_id: result.record_id,
              title: ents.title, priority: ents.priority, brand: ents.brand, content_type: ents.content_type,
            },
            outcome: 'action_completed', importance: 0.6,
          }).catch(e => console.error('[WA-04] Episode save error:', e))

          if (ents.priority === 'urgent') {
            learnFact(supabase, {
              userId, category: 'preference',
              fact: `${userName} tende a usar prioridade "urgent" para ${ents.content_type || 'conteúdo'}.`,
              metadata: { applies_to: activeContext.context_type, content_type: ents.content_type, default_priority: 'urgent' },
            }).catch(e => console.error('[WA-04] Fact learn error:', e))
          }
          if (ents.brand) {
            learnFact(supabase, {
              userId, category: 'workflow',
              fact: `${userName} trabalha com a marca ${ents.brand}.`,
              metadata: { applies_to: 'brand_usage', brand: ents.brand },
            }).catch(e => console.error('[WA-04] Fact learn error:', e))
          }
        }
```

**Localizar** o bloco de cancelamento "não" e adicionar:

```typescript
        // WA-04: Registrar cancelamento
        if (supabase && userId) {
          saveEpisode(supabase, {
            userId,
            summary: `${userName} cancelou ${activeContext.context_type}: "${activeContext.context_data?.entities?.title || ''}".`,
            entities: { action_type: activeContext.context_type, cancelled: true },
            outcome: 'cancelled', importance: 0.2,
          }).catch(e => console.error('[WA-04] Episode save error:', e))
        }
```

### E.6 — Salvar episódio para general_chat

**Substituir** o case `general_chat`:

```typescript
    case 'general_chat': {
      // FIX v2: capturar text do parâmetro de routeMessage
      const msgPreview = (text || '').substring(0, 80)
      if (supabase && userId) {
        saveEpisode(supabase, {
          userId,
          summary: `${userName} conversa livre: "${msgPreview}"`,
          outcome: 'conversation', importance: 0.1,
        }).catch(e => console.error('[WA-04] Episode save error:', e))
      }
      return { text: classification.response_text, intent: 'general_chat', confidence: classification.confidence }
    }
```

**NOTA:** `text` aqui refere-se ao parâmetro destruturado no início de `routeMessage()` (`const { text, type, userName, ... } = params`). Já está no escopo.

---

## ✏️ PARTE F — ATUALIZAR `types.ts`

**Adicionar ao final** (sem alterar tipos existentes):

```typescript
// ============================================
// WA-04: Tipos de Memória (referência)
// Os tipos canônicos estão em memory-manager.ts.
// ============================================
export interface MemoryContextRef {
  recent_episodes: Array<{
    summary: string; outcome: string; entities: Record<string, any>
    importance: number; created_at: string
  }>
  user_facts: Array<{
    category: string; fact: string; metadata: Record<string, any>
    confidence: number; reinforcement_count: number; user_confirmed: boolean
  }>
  team_knowledge: Array<{
    category: string; fact: string; scope: string | null
    metadata: Record<string, any>; is_verified: boolean
  }>
  retrieved_at: string
}
```

---

## 📦 DEPLOY

### Ordem de execução:

1. **SQL Migration (Parte A):** Executar no Supabase SQL Editor
2. **Verificar seed:** `SELECT * FROM agent_memory_team;` → 6 rows
3. **Verificar RPC:** `SELECT * FROM get_cards_count_by_column();` → retorna rows
4. **Criar** `memory-manager.ts` (Parte B)
5. **Criar** `query-handler.ts` (Parte C)
6. **Modificar** `gemini-classifier.ts` (Parte D)
7. **Modificar** `message-router.ts` (Parte E)
8. **Atualizar** `types.ts` (Parte F)
9. **Deploy:**
```bash
supabase functions deploy process-whatsapp-message --no-verify-jwt
```

---

## 🧪 TESTES DE VALIDAÇÃO

### T1 — Query Calendário
```
Enviar: "o que tem na agenda hoje?"
Esperado: Lista com nomes de responsáveis resolvidos via lookup manual
Verificar: agent_memory_episodes tem outcome='query_answered'
```

### T2 — Query Cards Urgentes
```
Enviar: "quais cards estão urgentes?"
Esperado: Lista com nomes + colunas (join direto OK)
Verificar: agent_memory_facts tem padrão "consulta prioridade urgent"
```

### T3 — Status do Projeto (RPC)
```
Enviar: "como tá o projeto?"
Esperado: Contagem por coluna + alertas
Verificar logs: NÃO deve haver N queries sequenciais
```

### T4 — Relatório
```
Enviar: "resumo da semana"
Esperado: Cards criados + publicados + eventos
```

### T5 — Memória Enriquecendo Ação
```
Criar 2+ cards urgentes → depois: "cria card de vídeo pro LA Kids"
Esperado: Gemini sugere prioridade urgente via memória injetada
```

### T6 — Nomes de Responsáveis (FIX #1)
```
Criar card com responsible_user_id → "quais cards?"
Esperado: Nome aparece (não null/vazio)
Se deu erro no join → lookup manual não está funcionando
```

### T7 — Team Knowledge
```
Enviar: "cria card de reels pro LA Kids"
Verificar logs: memoryPrompt contém regras de marca do seed
```

### T8 — Timezone (FIX #6-7)
```
Enviar "agenda de hoje" às 22:00 SP (01:00 UTC dia seguinte)
Esperado: Retorna itens do dia correto em SP (não dia seguinte)
```

### T9 — Regressão WA-03
```
"cria card de foto pro instagram" → "sim"
Esperado: Card criado + episódio + fato
```

### T10 — Regressão WA-02
```
"oi" → saudação | "ajuda" → menu
```

---

## 📊 CHECKLIST FINAL

```
MIGRATION:
[ ] SQL executado no Supabase SQL Editor
[ ] agent_memory_team tem 6 rows
[ ] get_cards_count_by_column() funciona
[ ] get_agent_memory_context() retorna JSONB
[ ] RLS restritiva: episodes/facts por user_id, team aberta

ARQUIVOS NOVOS:
[ ] memory-manager.ts criado (datas SP, non-blocking)
[ ] query-handler.ts criado (resolveUserNames, SEM joins PostgREST!)

MODIFICAÇÕES:
[ ] gemini-classifier.ts: 4º parâmetro memoryContext
[ ] message-router.ts: imports memory-manager + query-handler
[ ] message-router.ts: loadMemoryContext ANTES classificação
[ ] message-router.ts: memoryPrompt passado para classifyMessage
[ ] message-router.ts: NÃO duplicou authUserId (usa existente do WA-03)
[ ] message-router.ts: 4 cases com handlers reais
[ ] message-router.ts: saveEpisode em sim/não/general_chat
[ ] message-router.ts: learnFact em padrões observados
[ ] types.ts: MemoryContextRef adicionado

DEPLOY + TESTES:
[ ] Deploy OK
[ ] T1-T10 passam
[ ] Nomes de responsáveis resolvidos corretamente
[ ] Datas em horário SP (não UTC)
```

---

## 📁 RESUMO DE ARQUIVOS

```
CRIAR:
  memory-manager.ts   (Parte B)
  query-handler.ts    (Parte C)

MODIFICAR:
  gemini-classifier.ts (Parte D)
  message-router.ts    (Parte E)
  types.ts             (Parte F)

NÃO MODIFICAR:
  index.ts | utils.ts | action-executor.ts | send-message.ts
```

---

## 🔧 CORREÇÕES v2 (vs v1)

| # | Sev. | Problema v1 | Correção v2 |
|---|------|-------------|-------------|
| 1 | 🔴 | Joins `user_profiles!*_fkey` inválidos | `resolveUserNames()` com lookup manual |
| 2 | 🟠 | Status `scheduled` vs `pending` | Docs corrigidos para `pending` |
| 3 | 🔴 | `resolvedAuthUserId` duplicava `authUserId` | Removido — reusa `authUserId` existente |
| 4-5 | 🟠 | card_type/calendar_item_type como TEXT | Documentados como ENUMs |
| 6-7 | 🟠 | getSPNow/spToUtc frágeis | `Date.now()-3h` e `Date.UTC()` |
| 8 | 🟠 | Episódios sem controle de volume | `WHERE created_at > 30 days` na function |
| 9 | 🟠 | Fact match substring 30 chars | Prioriza metadata match, substring 50 chars |
| 10-11 | 🟡 | N+1 queries handleQueryProjects | RPC `get_cards_count_by_column()` |
| 13 | 🟡 | `text` fora do escopo | `const msgPreview = (text \|\| '').substring(0,80)` |
| 14 | 🟡 | RLS totalmente permissivo | Episódios/fatos por `user_id`, team aberto |
| 15 | 🟡 | Datas de episódios em UTC | Conversão UTC→SP em `formatMemoryForPrompt` |

---

## 🔮 PRÓXIMOS PASSOS (WA-05+)

Com WA-04 concluído, o agente agora:
- ✅ Classifica intenções (WA-02)
- ✅ Executa ações com confirmação (WA-03)
- ✅ Responde consultas com dados reais (WA-04)
- ✅ Aprende e lembra preferências do usuário (WA-04)
- ✅ Usa conhecimento da equipe para enriquecer respostas (WA-04)

**WA-05:** Cron jobs + relatórios automáticos (daily digest, weekly summary, lembretes)
**WA-06:** Áudio + imagem (transcrição Whisper, Gemini Vision)
**WA-07:** Dashboard de configuração (memória editável, preferências do agente)