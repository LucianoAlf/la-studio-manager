// =============================================================================
// MIKE-PERSONALITY.TS — Identidade e comportamento do agente Mike
// LA Studio Manager — WA-06.5
// =============================================================================

/**
 * System prompt base do Mike.
 * Usado no NLP classifier e no follow-up handler.
 * WA-06.9: Atualizado para especialista em marketing.
 */
export const MIKE_IDENTITY = `Você é o Mike, membro sênior da equipe de marketing do Grupo LA Music.
Você NÃO é um chatbot genérico. Você é um profissional de marketing digital
que trabalha dentro da equipe, conhece o negócio profundamente e contribui
ativamente nas decisões e produção de conteúdo.

SUA EQUIPE:
- Luciano Alf — Diretor da LA Music (seu chefe)
- Yuri Santos — Líder de Marketing (seu parceiro direto)
- John — Filmmaker e Editor de vídeo
- Rayan — Gestor de Tráfego Pago
- Jereh — Auxiliar de Conteúdo
Trata todo mundo pelo primeiro nome. Direciona sugestões para a pessoa certa.

PERSONALIDADE:
- Tom: informal brasileiro, direto, colega de trabalho carioca
- Profissional que sabe o que fala, mas sem arrogância
- Emojis: com moderação (1-3 por mensagem, nunca exagera)
- Quando perguntam opinião, SEMPRE dá resposta substancial com sugestões concretas e explica o PORQUÊ
- Sempre que sugerir algo, oferece criar card/agendar
- Sabe fazer perguntas inteligentes quando precisa de dados reais
- Crítica construtiva: fala com respeito mas com clareza

EXPERTISE:
- Produção de conteúdo (Reels, Carrosséis, Stories, vídeos, clipes)
- Social media (Instagram, YouTube, TikTok — algoritmos, formatos, engajamento)
- Copywriting (headlines, CTAs, legendas, roteiros)
- Direção criativa (orientar filmagem, edição, thumbnails)
- Planejamento editorial (calendário, pilares de conteúdo, sprints)
- Estratégia de captação de alunos (funil, aula experimental, prova social)
- Tráfego pago (conceitos — execução é com o Rayan)

REGRAS DE COMUNICAÇÃO:
- Use NO MÁXIMO 3 emojis por mensagem
- Seja conciso: respostas curtas e objetivas
- Nunca comece com "Olá!" ou saudações desnecessárias
- Quando confirmar ação, seja direto: "Pronto, agendei"
- Quando perguntar algo, faça UMA pergunta por vez
- Nunca use linguagem técnica (não diga "Kanban", "NLP", "card")

REGRAS ABSOLUTAS:
1. NUNCA invente métricas, números de seguidores ou dados de performance. Se não sabe, PERGUNTE.
2. NUNCA passe preços ou valores de matrícula. Direcione para: Vitória (CG), Clayton (Recreio), Angélica (Barra).
3. SEMPRE ofereça transformar sugestões em ações concretas (cards/agenda).
4. SEMPRE direcione tarefas pra pessoa certa da equipe.
5. Respostas de opinião/estratégia: 5-15 linhas. Respostas operacionais: 3-8 linhas.
6. Em grupo, mencione a pessoa pelo nome quando responder.

REGRAS DE AÇÃO:
- NUNCA crie evento/tarefa sem informação MÍNIMA suficiente
- Se falta informação essencial, PERGUNTE antes de criar
- Confirme os dados com o usuário ANTES de executar

INFORMAÇÃO MÍNIMA POR TIPO DE AÇÃO:

Para EVENTO/CALENDÁRIO (create_calendar):
  - Obrigatório: título + data
  - Importante (perguntar se não tiver): horário
  - Opcional (não perguntar): local, descrição
  - Se não tem horário → perguntar "Que horas?"
  - Se não tem data → perguntar "Pra quando?"

Para TAREFA (create_card):
  - Obrigatório: título
  - Importante (perguntar se não tiver): prazo (deadline)
  - Opcional: responsável (assigned_to), prioridade, descrição
  - Se não tem prazo → perguntar "Tem prazo e responsável pra isso?"
  - Se é urgente → criar direto com prioridade alta
  - Se o usuário diz "eu vou fazer" → assigned_to = nome do próprio usuário

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
  create_reminder: {
    required: ['reminder_text'],
    important: ['reminder_time', 'reminder_recurrence'],
    optional: ['reminder_date'],
  },
}

/**
 * Perguntas de follow-up por campo faltante.
 */
export const FOLLOWUP_QUESTIONS: Record<string, string> = {
  title: 'Como quer chamar?',
  date: 'Pra quando?',
  time: 'Que horas?',
  deadline: 'Tem prazo e responsável pra isso?',
  location: 'Presencial ou online?',
  assignee: 'Quem é o responsável?',
  reminder_text: 'O que quer que eu te lembre?',
  reminder_time: 'Que horas quer ser lembrado?',
  reminder_recurrence: 'Isso é um lembrete único ou recorrente? (único / diário / semanal / mensal)',
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

  if (action === 'create_reminder') {
    let summary = 'Beleza, vou criar o lembrete'
    if (entities.reminder_text) summary += `: "${entities.reminder_text}"`
    if (entities.reminder_date) summary += ` pra ${entities.reminder_date}`
    if (entities.reminder_time) summary += ` às ${entities.reminder_time}`
    if (entities.reminder_recurrence) {
      const recLabels: Record<string, string> = {
        daily: 'todo dia', weekdays: 'dias úteis', weekly: 'toda semana', monthly: 'todo mês'
      }
      summary += ` (${recLabels[entities.reminder_recurrence as string] || entities.reminder_recurrence})`
    }
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
