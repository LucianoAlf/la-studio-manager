// =============================================================================
// MIKE-PERSONALITY.TS — Identidade e comportamento do agente Mike
// LA Studio Manager — WA-06.5
// =============================================================================

/**
 * System prompt base do Mike.
 * Usado no NLP classifier e no follow-up handler.
 */
export const MIKE_IDENTITY = `Você é o Mike, assistente de gestão do LA Studio Manager.

QUEM VOCÊ É:
- Assistente da equipe de produção da LA Music (escola de música no Rio de Janeiro)
- Ajuda a gerenciar projetos, calendário e tarefas via WhatsApp
- Tom: profissional, direto, amigável — sem ser excessivamente informal
- Usa português brasileiro natural

REGRAS DE COMUNICAÇÃO:
- Use NO MÁXIMO 2 emojis por mensagem (prefira no início de linhas, não espalhados)
- Seja conciso: respostas curtas e objetivas
- Nunca comece com "Olá!" ou saudações desnecessárias (exceto na primeira mensagem do dia)
- Quando confirmar uma ação, seja direto: "Pronto, agendei" em vez de "✅🎉 Item criado com sucesso!"
- Quando perguntar algo, faça UMA pergunta por vez
- Nunca use linguagem técnica com o usuário (não diga "Kanban", "NLP", "card")

REGRAS DE AÇÃO:
- NUNCA crie um evento/tarefa sem ter informação MÍNIMA suficiente
- Se falta informação essencial, PERGUNTE antes de criar
- Confirme os dados com o usuário ANTES de executar a ação

INFORMAÇÃO MÍNIMA POR TIPO DE AÇÃO:

Para EVENTO/CALENDÁRIO (create_calendar):
  - Obrigatório: título + data
  - Importante (perguntar se não tiver): horário
  - Opcional (não perguntar): local, descrição
  - Se não tem horário → perguntar "Que horas?"
  - Se não tem data → perguntar "Pra quando?"

Para TAREFA (create_card):
  - Obrigatório: título
  - Importante (perguntar se não tiver): prazo
  - Opcional: responsável, prioridade, descrição
  - Se não tem prazo → perguntar "Tem prazo pra isso?"
  - Se é urgente → criar direto com prioridade alta

Para CONSULTA (query):
  - Responder diretamente, sem confirmação

FORMATO DE CONFIRMAÇÃO (quando tiver todos os dados):
📝 [Título]
📅 [Data e horário]
📍 [Local, se houver]
👤 [Responsável, se houver]

Confirma? (sim/não)
`

/**
 * Campos obrigatórios/importantes por tipo de ação.
 * Usado pelo follow-up handler para saber o que perguntar.
 */
export const ACTION_REQUIRED_FIELDS: Record<string, {
  required: string[]
  important: string[]
  optional: string[]
}> = {
  create_calendar: {
    required: ['title', 'date'],
    important: ['time'],
    optional: ['location', 'description', 'participants'],
  },
  create_card: {
    required: ['title'],
    important: ['deadline'],
    optional: ['assignee', 'priority', 'description', 'column'],
  },
}

/**
 * Perguntas de follow-up por campo faltante.
 */
export const FOLLOWUP_QUESTIONS: Record<string, string> = {
  title: 'Como quer chamar?',
  date: 'Pra quando?',
  time: 'Que horas?',
  deadline: 'Tem prazo pra isso?',
  location: 'Presencial ou online?',
  assignee: 'Quem é o responsável?',
}

/**
 * Palavras que indicam cancelamento do follow-up.
 */
export const CANCEL_WORDS = [
  'cancelar', 'cancela', 'deixa', 'esquece', 'deixa pra la',
  'deixa pra lá', 'nao quero', 'não quero', 'para', 'parar',
]

/**
 * Palavras que indicam que o usuário mudou de assunto (nova intenção).
 * Se detectadas durante follow-up, cancela e processa como mensagem nova.
 */
export const SUBJECT_CHANGE_PATTERNS = [
  /^(o que|quais?|quantos?|como|quando|onde|cadê|cade)\s/i,
  /^(agenda|calendario|semana|hoje|amanhã|amanha)\b/i,
  /^(relat[oó]rio|resumo|balan[cç]o)\b/i,
  /^(ajuda|help|comandos|menu)\b/i,
  /^(cria|criar|novo|adiciona|marca|agenda)\s/i,
]

/**
 * Retorna lista de campos faltantes (obrigatórios + importantes).
 */
export function getMissingFields(
  action: string,
  entities: Record<string, unknown>
): string[] {
  const config = ACTION_REQUIRED_FIELDS[action]
  if (!config) return []

  const allFields = [...config.required, ...config.important]
  return allFields.filter(f => !entities[f])
}

/**
 * Gera a pergunta de follow-up baseada nos campos faltantes.
 * Retorna null se não precisa perguntar nada.
 */
export function generateFollowUp(
  action: string,
  extractedEntities: Record<string, unknown>
): { question: string; missingField: string } | null {
  const config = ACTION_REQUIRED_FIELDS[action]
  if (!config) return null

  // 1. Verificar campos obrigatórios
  for (const field of config.required) {
    if (!extractedEntities[field]) {
      const question = FOLLOWUP_QUESTIONS[field]
      if (question) return { question, missingField: field }
    }
  }

  // 2. Verificar campos importantes
  for (const field of config.important) {
    if (!extractedEntities[field]) {
      const question = FOLLOWUP_QUESTIONS[field]
      if (question) return { question, missingField: field }
    }
  }

  return null // Tudo preenchido
}

/**
 * Monta resumo parcial dos dados coletados (tom Mike).
 */
export function buildPartialSummary(
  action: string,
  entities: Record<string, unknown>
): string {
  if (action === 'create_calendar') {
    let summary = 'Beleza, vou agendar'
    if (entities.title) summary += ` "${entities.title}"`
    if (entities.date) summary += ` pra ${entities.date}`
    if (entities.participants) summary += ` com ${entities.participants}`
    return summary + '.'
  }

  if (action === 'create_card') {
    let summary = 'Entendi, vou criar a tarefa'
    if (entities.title) summary += ` "${entities.title}"`
    return summary + '.'
  }

  return ''
}

/**
 * Detecta se a resposta do usuário é uma mudança de assunto.
 */
export function isSubjectChange(text: string): boolean {
  const trimmed = text.trim()
  return SUBJECT_CHANGE_PATTERNS.some(pattern => pattern.test(trimmed))
}
