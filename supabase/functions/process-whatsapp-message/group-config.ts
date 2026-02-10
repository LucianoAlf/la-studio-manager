// =============================================================================
// GROUP-CONFIG.TS — WA-06.7 + WA-07: Configuração de grupos do Mike
// Grupos habilitados, triggers de ativação, frases de dispensa, timeout
// Agora com suporte a mike_config do banco (fallback para hardcoded)
// =============================================================================

// =============================================================================
// DEFAULTS HARDCODED (fallback caso o banco não esteja acessível)
// =============================================================================

const DEFAULT_ENABLED_GROUPS: Record<string, string> = {
  '120363154727577617@g.us': 'Marketing 2.0 L.A',
  '120363422932217390@g.us': 'Marketing LA Music',
}

const DEFAULT_TRIGGER_NAMES: string[] = ['mike', 'maike', 'maik', 'mik']
const DEFAULT_SESSION_TIMEOUT = 5
const DEFAULT_MEMORY_HOURS_BACK = 4
const DEFAULT_MEMORY_MAX_MESSAGES = 50
const DEFAULT_MEMORY_RETENTION_DAYS = 7
const DEFAULT_BOT_PHONE = '5521989784688'
const DEFAULT_PERSONALITY_TONE = 'casual_profissional'
const DEFAULT_PERSONALITY_EMOJI_LEVEL = 'moderado'
const DEFAULT_AI_MODEL = 'gemini-2.5-flash-preview-05-20'
const DEFAULT_FALLBACK_AI_MODEL = 'gpt-4.1'
const DEFAULT_MAX_OUTPUT_TOKENS = 4096

// =============================================================================
// CACHE — Carregado do banco uma vez por invocação da Edge Function
// =============================================================================

interface MikeConfigCache {
  enabled_groups: Record<string, string>
  agent_trigger_names: string[]
  group_session_timeout_minutes: number
  group_memory_hours_back: number
  group_memory_max_messages: number
  group_memory_retention_days: number
  bot_phone_number: string
  personality_tone: string
  personality_emoji_level: string
  default_ai_model: string
  fallback_ai_model: string
  max_output_tokens: number
  is_enabled: boolean
}

let _configCache: MikeConfigCache | null = null

/**
 * Carrega mike_config do banco (singleton). Cacheia por invocação.
 * Se falhar, usa defaults hardcoded.
 */
// deno-lint-ignore no-explicit-any
export async function loadMikeConfig(supabase: any): Promise<MikeConfigCache> {
  if (_configCache) return _configCache

  try {
    const { data, error } = await supabase
      .from('mike_config')
      .select('enabled_groups, agent_trigger_names, group_session_timeout_minutes, group_memory_hours_back, group_memory_max_messages, group_memory_retention_days, bot_phone_number, personality_tone, personality_emoji_level, default_ai_model, fallback_ai_model, max_output_tokens, is_enabled')
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('[GROUP-CONFIG] Falha ao carregar mike_config, usando defaults:', error?.message)
      _configCache = {
        enabled_groups: DEFAULT_ENABLED_GROUPS,
        agent_trigger_names: DEFAULT_TRIGGER_NAMES,
        group_session_timeout_minutes: DEFAULT_SESSION_TIMEOUT,
        group_memory_hours_back: DEFAULT_MEMORY_HOURS_BACK,
        group_memory_max_messages: DEFAULT_MEMORY_MAX_MESSAGES,
        group_memory_retention_days: DEFAULT_MEMORY_RETENTION_DAYS,
        bot_phone_number: DEFAULT_BOT_PHONE,
        personality_tone: DEFAULT_PERSONALITY_TONE,
        personality_emoji_level: DEFAULT_PERSONALITY_EMOJI_LEVEL,
        default_ai_model: DEFAULT_AI_MODEL,
        fallback_ai_model: DEFAULT_FALLBACK_AI_MODEL,
        max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        is_enabled: true,
      }
    } else {
      _configCache = {
        enabled_groups: (data.enabled_groups as Record<string, string>) || DEFAULT_ENABLED_GROUPS,
        agent_trigger_names: (data.agent_trigger_names as string[]) || DEFAULT_TRIGGER_NAMES,
        group_session_timeout_minutes: data.group_session_timeout_minutes ?? DEFAULT_SESSION_TIMEOUT,
        group_memory_hours_back: data.group_memory_hours_back ?? DEFAULT_MEMORY_HOURS_BACK,
        group_memory_max_messages: data.group_memory_max_messages ?? DEFAULT_MEMORY_MAX_MESSAGES,
        group_memory_retention_days: data.group_memory_retention_days ?? DEFAULT_MEMORY_RETENTION_DAYS,
        bot_phone_number: data.bot_phone_number ?? DEFAULT_BOT_PHONE,
        personality_tone: data.personality_tone ?? DEFAULT_PERSONALITY_TONE,
        personality_emoji_level: data.personality_emoji_level ?? DEFAULT_PERSONALITY_EMOJI_LEVEL,
        default_ai_model: data.default_ai_model ?? DEFAULT_AI_MODEL,
        fallback_ai_model: data.fallback_ai_model ?? DEFAULT_FALLBACK_AI_MODEL,
        max_output_tokens: data.max_output_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        is_enabled: data.is_enabled ?? true,
      }
      console.log(`[GROUP-CONFIG] mike_config carregado: ${Object.keys(_configCache.enabled_groups).length} grupos, ${_configCache.agent_trigger_names.length} triggers`)
    }
  } catch (err) {
    console.warn('[GROUP-CONFIG] Exceção ao carregar mike_config, usando defaults:', err)
    _configCache = {
      enabled_groups: DEFAULT_ENABLED_GROUPS,
      agent_trigger_names: DEFAULT_TRIGGER_NAMES,
      group_session_timeout_minutes: DEFAULT_SESSION_TIMEOUT,
      group_memory_hours_back: DEFAULT_MEMORY_HOURS_BACK,
      group_memory_max_messages: DEFAULT_MEMORY_MAX_MESSAGES,
      group_memory_retention_days: DEFAULT_MEMORY_RETENTION_DAYS,
      bot_phone_number: DEFAULT_BOT_PHONE,
      personality_tone: DEFAULT_PERSONALITY_TONE,
      personality_emoji_level: DEFAULT_PERSONALITY_EMOJI_LEVEL,
      default_ai_model: DEFAULT_AI_MODEL,
      fallback_ai_model: DEFAULT_FALLBACK_AI_MODEL,
      max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      is_enabled: true,
    }
  }

  return _configCache
}

/**
 * Retorna o cache atual (ou defaults se não carregado).
 * Para uso síncrono em funções que já passaram pelo loadMikeConfig.
 */
function getConfig(): MikeConfigCache {
  return _configCache || {
    enabled_groups: DEFAULT_ENABLED_GROUPS,
    agent_trigger_names: DEFAULT_TRIGGER_NAMES,
    group_session_timeout_minutes: DEFAULT_SESSION_TIMEOUT,
    group_memory_hours_back: DEFAULT_MEMORY_HOURS_BACK,
    group_memory_max_messages: DEFAULT_MEMORY_MAX_MESSAGES,
    group_memory_retention_days: DEFAULT_MEMORY_RETENTION_DAYS,
    bot_phone_number: DEFAULT_BOT_PHONE,
    personality_tone: DEFAULT_PERSONALITY_TONE,
    personality_emoji_level: DEFAULT_PERSONALITY_EMOJI_LEVEL,
    default_ai_model: DEFAULT_AI_MODEL,
    fallback_ai_model: DEFAULT_FALLBACK_AI_MODEL,
    max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
    is_enabled: true,
  }
}

// =============================================================================
// EXPORTS COMPATÍVEIS (mesma interface de antes, agora lê do cache)
// =============================================================================

/** Getter dinâmico — retorna grupos habilitados do cache/banco */
export function getEnabledGroups(): Record<string, string> {
  return getConfig().enabled_groups
}

/** Alias para compatibilidade — ENABLED_GROUPS agora é getter */
export const ENABLED_GROUPS: Record<string, string> = DEFAULT_ENABLED_GROUPS

/**
 * Verifica se um grupo está habilitado para o Mike.
 */
export function isGroupEnabled(groupJid: string): boolean {
  return groupJid in getConfig().enabled_groups
}

/** Getter dinâmico — retorna trigger names do cache/banco */
export function getTriggerNames(): string[] {
  return getConfig().agent_trigger_names
}

/** Alias para compatibilidade */
export const AGENT_TRIGGER_NAMES: string[] = DEFAULT_TRIGGER_NAMES

/**
 * Frases que dispensam o Mike (encerram sessão ativa).
 * Geradas dinamicamente a partir dos trigger names.
 */
function buildDismissPhrases(): string[] {
  const names = getConfig().agent_trigger_names
  const templates = [
    'valeu', 'obrigado', 'obrigada', 'brigado', 'brigada',
    'tchau', 'falou', 'pode parar', 'para', 'ok', 'beleza',
    'tmj', 'tamo junto', 'era isso', 'so isso', 'só isso',
    'vlw', 'flw', 'blz', 'fechou',
  ]
  const phrases: string[] = []
  for (const template of templates) {
    for (const name of names) {
      phrases.push(`${template} ${name}`)
    }
  }
  return phrases
}

/** Getter dinâmico — retorna frases de dispensa baseadas nos trigger names do cache */
export function getDismissPhrases(): string[] {
  return buildDismissPhrases()
}

/** Alias estático para compatibilidade (usa defaults) */
export const DISMISS_PHRASES: string[] = buildDismissPhrases()

/** Timeout da sessão de grupo em minutos. */
export function getSessionTimeout(): number {
  return getConfig().group_session_timeout_minutes
}
export const GROUP_SESSION_TIMEOUT_MINUTES = DEFAULT_SESSION_TIMEOUT

// =============================================================================
// CONFIGURAÇÃO DE MEMÓRIA DO GRUPO
// =============================================================================

export function getMemoryHoursBack(): number {
  return getConfig().group_memory_hours_back
}
export const GROUP_MEMORY_HOURS_BACK = DEFAULT_MEMORY_HOURS_BACK

export function getMemoryMaxMessages(): number {
  return getConfig().group_memory_max_messages
}
export const GROUP_MEMORY_MAX_MESSAGES = DEFAULT_MEMORY_MAX_MESSAGES

export function getMemoryRetentionDays(): number {
  return getConfig().group_memory_retention_days
}
export const GROUP_MEMORY_RETENTION_DAYS = DEFAULT_MEMORY_RETENTION_DAYS

// =============================================================================
// FUNÇÕES DE DETECÇÃO
// =============================================================================

/**
 * Padrões de terceira pessoa que indicam que o usuário está FALANDO SOBRE o Mike,
 * não CHAMANDO o Mike. Ex: "o mike entra quando chama", "do mike", "pro mike".
 */
const THIRD_PERSON_PREFIXES = [
  'o', 'do', 'ao', 'no', 'pro', 'pelo', 'com o', 'que o', 'e o',
  'quando o', 'se o', 'pra o', 'para o', 'sobre o', 'como o',
]

/**
 * Verifica se o texto contém o nome do Mike como CHAMADO DIRETO (vocativo).
 * Ignora menções em terceira pessoa ("o Mike faz X", "do Mike", "pro Mike").
 * Aceita: "Mike cria um card", "Fala Mike", "ei Mike", "Mike, agenda reunião"
 * Rejeita: "o Mike entra quando chama", "falei do Mike", "pro Mike funcionar"
 */
export function containsMikeName(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().trim()

  for (const name of getTriggerNames()) {
    const regex = new RegExp(`\\b${name}\\b`, 'i')
    if (!regex.test(lower)) continue

    // Encontrou o nome — verificar se é terceira pessoa
    let isThirdPerson = false
    for (const prefix of THIRD_PERSON_PREFIXES) {
      const thirdPersonRegex = new RegExp(`\\b${prefix}\\s+${name}\\b`, 'i')
      if (thirdPersonRegex.test(lower)) {
        isThirdPerson = true
        break
      }
    }

    if (!isThirdPerson) return true // Chamado direto
  }

  return false
}

/**
 * Verifica se o texto é uma frase de dispensa.
 */
export function isDismissPhrase(text: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().trim()
    .replace(/[.,!?;:]+$/g, '') // remover pontuação final
    .trim()
  return getDismissPhrases().includes(lower)
}

/**
 * Remove o nome do Mike do texto para processar o comando puro.
 * "Mike cria um card urgente" → "cria um card urgente"
 * "Fala Mike, agenda reunião" → "Fala, agenda reunião"
 */
export function removeMikeName(text: string): string {
  if (!text) return ''
  let cleaned = text
  for (const name of getTriggerNames()) {
    const regex = new RegExp(`\\b${name}\\b[,!.\\s]*`, 'gi')
    cleaned = cleaned.replace(regex, ' ')
  }
  // Limpar espaços duplos e trim
  return cleaned.replace(/\s+/g, ' ').trim()
}

/** Getter dinâmico — retorna número do bot do cache/banco */
export function getBotPhoneNumber(): string {
  return getConfig().bot_phone_number
}

/** Alias para compatibilidade */
export const BOT_PHONE_NUMBER = DEFAULT_BOT_PHONE

/** Getter dinâmico — retorna modelo de IA principal */
export function getDefaultAiModel(): string {
  return getConfig().default_ai_model
}

/** Getter dinâmico — retorna modelo de IA fallback */
export function getFallbackAiModel(): string {
  return getConfig().fallback_ai_model
}

/** Getter dinâmico — retorna max output tokens */
export function getMaxOutputTokens(): number {
  return getConfig().max_output_tokens
}

/** Getter dinâmico — retorna tom de personalidade */
export function getPersonalityTone(): string {
  return getConfig().personality_tone
}

/** Getter dinâmico — retorna nível de emojis */
export function getPersonalityEmojiLevel(): string {
  return getConfig().personality_emoji_level
}

/** Getter dinâmico — retorna se o Mike está habilitado globalmente */
export function isMikeEnabled(): boolean {
  return getConfig().is_enabled
}
