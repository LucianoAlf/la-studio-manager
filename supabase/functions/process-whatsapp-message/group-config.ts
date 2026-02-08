// =============================================================================
// GROUP-CONFIG.TS — WA-06.7: Configuração de grupos do Mike
// Grupos habilitados, triggers de ativação, frases de dispensa, timeout
// =============================================================================

/**
 * Grupos onde o Mike está habilitado para operar.
 * Formato: JID do grupo → nome legível (para logs).
 */
export const ENABLED_GROUPS: Record<string, string> = {
  '120363154727577617@g.us': 'Marketing 2.0 L.A',
  '120363422932217390@g.us': 'Marketing LA Music',
}

/**
 * Verifica se um grupo está habilitado para o Mike.
 */
export function isGroupEnabled(groupJid: string): boolean {
  return groupJid in ENABLED_GROUPS
}

/**
 * Nomes/variações que ativam o Mike no grupo.
 * Case-insensitive, sem acentos.
 */
export const AGENT_TRIGGER_NAMES: string[] = [
  'mike',
  'maike',
  'maik',
  'mik',
]

/**
 * Frases que dispensam o Mike (encerram sessão ativa).
 */
export const DISMISS_PHRASES: string[] = [
  'valeu mike',
  'valeu maike',
  'obrigado mike',
  'obrigado maike',
  'obrigada mike',
  'obrigada maike',
  'brigado mike',
  'brigado maike',
  'brigada mike',
  'brigada maike',
  'tchau mike',
  'tchau maike',
  'falou mike',
  'falou maike',
  'pode parar mike',
  'pode parar maike',
  'para mike',
  'para maike',
  'ok mike',
  'ok maike',
  'beleza mike',
  'beleza maike',
  'tmj mike',
  'tmj maike',
  'tamo junto mike',
  'tamo junto maike',
  'era isso mike',
  'era isso maike',
  'so isso mike',
  'so isso maike',
  'só isso mike',
  'só isso maike',
]

/**
 * Timeout da sessão de grupo em minutos.
 * Após esse tempo sem interação, Mike volta ao silêncio.
 */
export const GROUP_SESSION_TIMEOUT_MINUTES = 5

// =============================================================================
// CONFIGURAÇÃO DE MEMÓRIA DO GRUPO
// =============================================================================

/**
 * Quantas horas de conversa buscar quando Mike é ativado.
 * 4h = contexto da manhã ou da tarde inteira.
 */
export const GROUP_MEMORY_HOURS_BACK = 4

/**
 * Máximo de mensagens a recuperar para contexto.
 * 50 mensagens ≈ 2000-4000 tokens no prompt.
 */
export const GROUP_MEMORY_MAX_MESSAGES = 50

/**
 * Dias de retenção da memória do grupo.
 * Após esse período, mensagens são deletadas automaticamente via cron.
 */
export const GROUP_MEMORY_RETENTION_DAYS = 7

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

  for (const name of AGENT_TRIGGER_NAMES) {
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
  return DISMISS_PHRASES.includes(lower)
}

/**
 * Remove o nome do Mike do texto para processar o comando puro.
 * "Mike cria um card urgente" → "cria um card urgente"
 * "Fala Mike, agenda reunião" → "Fala, agenda reunião"
 */
export function removeMikeName(text: string): string {
  if (!text) return ''
  let cleaned = text
  for (const name of AGENT_TRIGGER_NAMES) {
    const regex = new RegExp(`\\b${name}\\b[,!.\\s]*`, 'gi')
    cleaned = cleaned.replace(regex, ' ')
  }
  // Limpar espaços duplos e trim
  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * Número do bot (UAZAPI) — para identificar mensagens do próprio Mike.
 */
export const BOT_PHONE_NUMBER = '5521989784688'
