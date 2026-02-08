// =============================================================================
// GEMINI-FOLLOWUP-PARSER.TS — Parser inteligente de respostas de follow-up
// LA Studio Manager — WA-06.8: Smart Follow-up
// =============================================================================
// Quando o usuário responde a um follow-up com uma frase complexa
// (ex: "Eu que vou editar o vídeo e o prazo é até terça"),
// este módulo usa Gemini para extrair TODAS as entidades da resposta,
// em vez de tentar fazer parse manual com regex.
// =============================================================================

/**
 * Resultado do parsing inteligente de follow-up.
 */
export interface SmartFollowUpResult {
  /** Entidades extraídas da resposta (merged com as existentes) */
  entities: Record<string, unknown>
  /** Se todas as entidades necessárias foram preenchidas */
  complete: boolean
  /** Próxima pergunta, se ainda falta algo */
  nextQuestion?: string
  /** Próximo campo aguardado */
  nextField?: string
}

/**
 * Contexto passado para o parser para que ele saiba o que já tem e o que falta.
 */
interface FollowUpParseContext {
  action: string                    // 'create_card' | 'create_calendar'
  existingEntities: Record<string, unknown>  // Dados já coletados
  missingFields: string[]           // Campos que faltam
  waitingForField: string           // Campo que foi perguntado
  teamMembers: string[]             // Nomes dos membros da equipe (para resolver "eu", "John", etc.)
  currentUserName: string           // Nome do usuário que está falando
}

/**
 * Verifica se a resposta é "complexa" o suficiente para justificar uma chamada ao Gemini.
 * Respostas curtas (1-3 palavras) são processadas pelo parser manual (mais rápido, sem custo).
 */
export function isComplexResponse(text: string): boolean {
  const words = text.trim().split(/\s+/)
  // Respostas com mais de 4 palavras OU que contêm conjunções/preposições indicando múltiplas informações
  if (words.length > 4) return true
  // Respostas curtas que mencionam "eu" (auto-atribuição) — precisa de contexto
  if (/\b(eu|meu|minha|pra mim|comigo)\b/i.test(text)) return true
  // Respostas que contêm "e" conectando informações
  if (/\be\b/i.test(text) && words.length > 2) return true
  return false
}

/**
 * Usa Gemini para extrair entidades de uma resposta complexa de follow-up.
 * Retorna as entidades extraídas merged com as existentes.
 */
export async function parseFollowUpWithGemini(
  userResponse: string,
  context: FollowUpParseContext,
): Promise<SmartFollowUpResult | null> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!geminiKey) {
    console.error('[SMART-FOLLOWUP] GEMINI_API_KEY não configurada')
    return null
  }

  // Calcular data atual em São Paulo para contexto temporal
  const now = new Date(Date.now() - 3 * 60 * 60000)
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const diaSemana = dias[now.getUTCDay()]
  const dia = now.getUTCDate()
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const mes = meses[now.getUTCMonth()]
  const ano = now.getUTCFullYear()

  const systemPrompt = buildFollowUpSystemPrompt(context, `${diaSemana}, ${dia} de ${mes} de ${ano}`, ano)
  const userMessage = `Resposta do usuário "${context.currentUserName}": "${userResponse}"`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SMART-FOLLOWUP] Gemini API error ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      console.error('[SMART-FOLLOWUP] Gemini returned empty response')
      return null
    }

    const parsed = JSON.parse(responseText)
    console.log('[SMART-FOLLOWUP] Gemini parsed:', JSON.stringify(parsed))

    // Merge entidades extraídas com as existentes
    const mergedEntities = { ...context.existingEntities }

    // Mapear campos do Gemini para entidades
    if (parsed.deadline) mergedEntities.deadline = parsed.deadline
    if (parsed.due_date) mergedEntities.deadline = parsed.due_date
    if (parsed.date) mergedEntities.date = parsed.date
    if (parsed.time) mergedEntities.time = parsed.time
    if (parsed.title) mergedEntities.title = parsed.title
    if (parsed.location) mergedEntities.location = parsed.location
    if (parsed.participants) mergedEntities.participants = parsed.participants
    if (parsed.priority) mergedEntities.priority = parsed.priority
    if (parsed.description) mergedEntities.description = parsed.description
    if (parsed.content_type) mergedEntities.content_type = parsed.content_type
    if (parsed.duration_minutes) mergedEntities.duration_minutes = parsed.duration_minutes
    if (parsed.calendar_type) mergedEntities.calendar_type = parsed.calendar_type

    // Resolver assigned_to / responsável
    if (parsed.assigned_to) {
      mergedEntities.assigned_to = parsed.assigned_to
    }

    // Se o Gemini disse "sem prazo" ou similar
    if (parsed.no_deadline === true) {
      mergedEntities.deadline = null
      mergedEntities._skipDeadline = true
    }

    // Verificar campos que ainda faltam
    const remainingMissing = context.missingFields.filter(f => {
      if (mergedEntities[f] !== undefined && mergedEntities[f] !== null) return false
      if (f === 'deadline' && mergedEntities._skipDeadline) return false
      return true
    })

    if (remainingMissing.length === 0) {
      // Limpar flags internas
      delete mergedEntities._skipDeadline
      return { entities: mergedEntities, complete: true }
    }

    // Ainda falta campo — usar a próxima pergunta do Gemini ou fallback
    const nextField = remainingMissing[0]
    const FOLLOWUP_QUESTIONS: Record<string, string> = {
      title: 'Como quer chamar?',
      date: 'Pra quando?',
      time: 'Que horas?',
      deadline: 'Tem prazo pra isso?',
      location: 'Presencial ou online?',
      assignee: 'Quem é o responsável?',
      assigned_to: 'Quem é o responsável?',
    }
    const nextQuestion = parsed.next_question || FOLLOWUP_QUESTIONS[nextField] || `Qual o ${nextField}?`

    return {
      entities: mergedEntities,
      complete: false,
      nextQuestion,
      nextField,
    }
  } catch (error) {
    console.error('[SMART-FOLLOWUP] Parse error:', error)
    return null
  }
}

// =============================================================================
// SYSTEM PROMPT PARA O PARSER DE FOLLOW-UP
// =============================================================================

function buildFollowUpSystemPrompt(
  context: FollowUpParseContext,
  dataAtual: string,
  ano: number,
): string {
  const actionLabel = context.action === 'create_calendar' ? 'evento/agendamento' : 'tarefa/card'
  const teamList = context.teamMembers.length > 0
    ? `Membros da equipe: ${context.teamMembers.join(', ')}`
    : 'Nenhum membro da equipe cadastrado além do próprio usuário.'

  return `Você é um parser de entidades para um assistente de gestão.

O usuário "${context.currentUserName}" está criando um(a) ${actionLabel}.

📅 DATA ATUAL: ${dataAtual}, ${ano}
⚠️ Use SEMPRE o ano ${ano}. "Terça" = próxima terça-feira. "Amanhã" = dia seguinte.

## DADOS JÁ COLETADOS
${JSON.stringify(context.existingEntities, null, 2)}

## CAMPOS QUE FALTAM
${context.missingFields.join(', ')}

## PERGUNTA FEITA AO USUÁRIO
Campo aguardado: "${context.waitingForField}"

## EQUIPE
${teamList}

## REGRAS DE EXTRAÇÃO

1. **assigned_to / responsável**: 
   - Se o usuário diz "eu", "eu mesmo", "eu que vou", "pra mim" → assigned_to = "${context.currentUserName}"
   - Se menciona um nome da equipe → assigned_to = nome da pessoa
   - Se não mencionou responsável → NÃO inventar

2. **deadline / prazo**:
   - "até terça" → deadline = "terça-feira"
   - "até sexta que vem" → deadline = "próxima sexta-feira"
   - "sem prazo", "não tem prazo" → no_deadline = true
   - Manter formato relativo (ex: "terça-feira", "amanhã")

3. **date / data**:
   - Mesmo formato que deadline, mas para eventos de calendário
   - Manter formato relativo

4. **time / horário**:
   - "10h" → time = "10:00"
   - "3 da tarde" → time = "15:00"
   - Hora < 7 sem indicador → assumir PM (horário comercial)

5. **title**: Só alterar se o usuário explicitamente corrigir o título

6. **Múltiplas informações**: O usuário pode responder com VÁRIAS informações de uma vez.
   Ex: "Eu que vou editar o vídeo e o prazo é até terça" → assigned_to + deadline

7. **NÃO inventar dados** que o usuário não mencionou.

## FORMATO DE RESPOSTA

Responda APENAS com JSON válido contendo os campos extraídos da resposta:
{
  "assigned_to": "Nome ou null",
  "deadline": "prazo ou null",
  "date": "data ou null",
  "time": "horário ou null",
  "title": "título corrigido ou null",
  "location": "local ou null",
  "participants": "participantes ou null",
  "priority": "prioridade ou null",
  "description": "descrição ou null",
  "content_type": "tipo de conteúdo ou null",
  "duration_minutes": null,
  "calendar_type": "tipo ou null",
  "no_deadline": false,
  "next_question": "próxima pergunta se ainda falta algo, ou null"
}

Retorne APENAS os campos que foram EXPLICITAMENTE mencionados na resposta. Campos não mencionados devem ser null.`
}
