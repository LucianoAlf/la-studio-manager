/**
 * gemini-classifier.ts
 * Classifica mensagens do WhatsApp usando Gemini API
 * Retorna intent + entidades extraídas em JSON estruturado
 */

// ============================================
// TIPOS
// ============================================

export interface ClassificationResult {
  intent: Intent
  confidence: number
  entities: ExtractedEntities
  response_text: string
  needs_confirmation: boolean
}

export type Intent =
  | 'create_card'
  | 'create_calendar'
  | 'create_reminder'
  | 'query_calendar'
  | 'query_cards'
  | 'query_projects'
  | 'generate_report'
  | 'update_card'
  | 'general_chat'
  | 'help'
  | 'unknown'

export interface ExtractedEntities {
  // Card / Calendar
  title?: string
  description?: string
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  content_type?: 'video' | 'carousel' | 'reels' | 'story' | 'photo' | 'live'
  platforms?: ('instagram' | 'youtube' | 'tiktok' | 'facebook' | 'whatsapp')[]
  brand?: 'la_music' | 'la_kids'

  // Calendar específico
  date?: string
  time?: string
  duration_minutes?: number
  calendar_type?: 'event' | 'delivery' | 'creation' | 'task' | 'meeting'

  // Kanban específico
  column?: 'brainstorm' | 'planning' | 'todo' | 'capturing' | 'editing' | 'awaiting_approval' | 'approved' | 'published' | 'archived'

  // Query
  query_period?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'this_month'
  query_filter?: string

  // Reminder
  reminder_date?: string
  reminder_time?: string
  reminder_text?: string

  // Genérico
  raw_text?: string
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `Você é o assistente de IA do LA Studio Manager, uma plataforma de gestão de produção audiovisual para a gravadora LA Music e LA Kids.

Sua função é classificar mensagens do WhatsApp e extrair informações estruturadas.

## INTENÇÕES POSSÍVEIS

1. **create_card** — Criar card no Kanban
   Gatilhos: "cria um card", "adiciona tarefa", "novo card", "preciso fazer", "bota no kanban"
   Entidades: title, priority, content_type, platforms, brand, column, description

2. **create_calendar** — Criar item no calendário
   Gatilhos: "agenda pra", "marca pra", "reunião dia", "gravação dia", "entrega dia"
   Entidades: title, date, time, duration_minutes, calendar_type, platforms, content_type

3. **create_reminder** — Criar lembrete
   Gatilhos: "me lembra", "lembrete pra", "não deixa eu esquecer"
   Entidades: reminder_text, reminder_date, reminder_time

4. **query_calendar** — Consultar agenda
   Gatilhos: "o que tem hoje", "agenda da semana", "o que tem amanhã", "próximos eventos"
   Entidades: query_period, query_filter

5. **query_cards** — Consultar cards/kanban
   Gatilhos: "quais cards", "o que tá pendente", "cards urgentes", "como tá o kanban"
   Entidades: query_filter, priority, column, brand

6. **query_projects** — Consultar projetos
   Gatilhos: "como tá o projeto", "status do", "andamento"
   Entidades: query_filter

7. **generate_report** — Gerar relatório
   Gatilhos: "relatório", "resumo da semana", "balanço do mês"
   Entidades: query_period

8. **update_card** — Atualizar card existente
   Gatilhos: "move o card", "muda prioridade", "atualiza", "marca como feito"
   Entidades: title (para buscar), column (destino), priority

9. **general_chat** — Conversa livre
   Gatilhos: saudações, perguntas gerais, brincadeiras
   Entidades: nenhuma

10. **help** — Pedir ajuda
    Gatilhos: "ajuda", "o que você faz", "comandos", "como funciona"
    Entidades: nenhuma

## VALORES VÁLIDOS

**Prioridades:** urgent, high, medium, low
**Tipos de conteúdo:** video, carousel, reels, story, photo, live
**Plataformas:** instagram, youtube, tiktok, facebook, whatsapp
**Marcas:** la_music, la_kids
**Colunas Kanban:** brainstorm, planning, todo, capturing, editing, awaiting_approval, approved, published, archived
**Tipos calendário:** event, delivery, creation, task, meeting
**Períodos:** today, tomorrow, this_week, next_week, this_month

## REGRAS

1. Se o usuário não especificar coluna, assumir "brainstorm" para create_card
2. Se o usuário não especificar prioridade, assumir "medium"
3. Se o usuário não especificar marca, assumir "la_music"
4. Datas relativas: "amanhã" = dia seguinte, "sexta" = próxima sexta, etc.
5. Se a mensagem for ambígua, classificar como "unknown" e pedir esclarecimento
6. Responda SEMPRE em português brasileiro, tom amigável e profissional
7. Para create_card e create_calendar, SEMPRE pedir confirmação (needs_confirmation: true)
8. Para queries, não precisa confirmação (needs_confirmation: false)

## FORMATO DE RESPOSTA

Responda APENAS com JSON válido, sem markdown, sem backticks, sem texto adicional:
{
  "intent": "nome_da_intencao",
  "confidence": 0.95,
  "entities": { ... campos relevantes ... },
  "response_text": "Texto amigável para enviar ao usuário",
  "needs_confirmation": true/false
}`

// ============================================
// CLASSIFICADOR
// ============================================

export async function classifyMessage(
  text: string,
  userName: string,
  conversationContext?: string
): Promise<ClassificationResult> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')

  let userMessage = `Mensagem do usuário "${userName}": "${text}"`
  if (conversationContext) {
    userMessage = `Contexto da conversa anterior:\n${conversationContext}\n\n${userMessage}`
  }

  // Tentar Gemini primeiro (gratuito)
  if (geminiKey) {
    const result = await tryGemini(geminiKey, userMessage)
    if (result) return result
  }

  // Fallback: OpenAI GPT-4.1
  if (openaiKey) {
    const result = await tryOpenAI(openaiKey, userMessage)
    if (result) return result
  }

  // Último fallback: regex local
  console.warn('[WA] Both Gemini and OpenAI failed, using regex fallback')
  return fallbackClassification(text, userName)
}

// ============================================
// GEMINI (primário)
// ============================================

async function tryGemini(apiKey: string, userMessage: string): Promise<ClassificationResult | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userMessage }]
            }
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
            maxOutputTokens: 1024,
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WA] Gemini API error ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      console.error('[WA] Gemini returned empty response')
      return null
    }

    const classification = JSON.parse(responseText) as ClassificationResult
    if (!classification.intent || !classification.response_text) {
      console.error('[WA] Gemini returned invalid classification')
      return null
    }

    classification.confidence = Number(classification.confidence) || 0.5
    console.log(`[WA] Gemini classified: intent=${classification.intent}, confidence=${classification.confidence}`)
    return classification

  } catch (error) {
    console.error('[WA] Gemini error:', error)
    return null
  }
}

// ============================================
// OPENAI GPT-4.1 (fallback)
// ============================================

async function tryOpenAI(apiKey: string, userMessage: string): Promise<ClassificationResult | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WA] OpenAI API error ${response.status}:`, errorText)
      return null
    }

    const data = await response.json()
    const responseText = data?.choices?.[0]?.message?.content
    if (!responseText) {
      console.error('[WA] OpenAI returned empty response')
      return null
    }

    const classification = JSON.parse(responseText) as ClassificationResult
    if (!classification.intent || !classification.response_text) {
      console.error('[WA] OpenAI returned invalid classification')
      return null
    }

    classification.confidence = Number(classification.confidence) || 0.5
    console.log(`[WA] OpenAI classified: intent=${classification.intent}, confidence=${classification.confidence}`)
    return classification

  } catch (error) {
    console.error('[WA] OpenAI error:', error)
    return null
  }
}

// ============================================
// FALLBACK (sem Gemini / erro)
// ============================================

function fallbackClassification(text: string, userName: string): ClassificationResult {
  const lower = text.toLowerCase().trim()

  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|eai|e ai|fala)/i.test(lower)) {
    return {
      intent: 'general_chat',
      confidence: 0.9,
      entities: { raw_text: text },
      response_text: `Olá, ${userName}! 👋 Como posso ajudar? Digite "ajuda" para ver os comandos disponíveis.`,
      needs_confirmation: false,
    }
  }

  if (/^(ajuda|help|comandos|menu|o que voce faz)/i.test(lower)) {
    return {
      intent: 'help',
      confidence: 0.95,
      entities: {},
      response_text: getHelpText(),
      needs_confirmation: false,
    }
  }

  if (/^(cria|criar|novo|adiciona|bota)/i.test(lower)) {
    return {
      intent: 'create_card',
      confidence: 0.6,
      entities: { title: text, raw_text: text },
      response_text: `Entendi que você quer criar algo, ${userName}. Pode detalhar melhor? Ex: "cria card urgente pra gravar vídeo do LA Kids"`,
      needs_confirmation: false,
    }
  }

  if (/^(agenda|calendario|semana|hoje|amanhã|amanha)/i.test(lower)) {
    return {
      intent: 'query_calendar',
      confidence: 0.6,
      entities: { query_period: 'this_week', raw_text: text },
      response_text: `Vou consultar a agenda, ${userName}. Um momento...`,
      needs_confirmation: false,
    }
  }

  return {
    intent: 'unknown',
    confidence: 0.3,
    entities: { raw_text: text },
    response_text: `Não entendi bem, ${userName}. Pode reformular? Ou digite "ajuda" para ver o que posso fazer.`,
    needs_confirmation: false,
  }
}

// ============================================
// HELP TEXT
// ============================================

export function getHelpText(): string {
  return `📋 *Comandos do LA Studio Manager*

🎯 *Criar*
• "Cria um card pra gravar vídeo do LA Kids"
• "Agenda reunião pra sexta às 14h"
• "Me lembra de enviar o relatório amanhã"

🔍 *Consultar*
• "O que tem na agenda hoje?"
• "Quais cards estão urgentes?"
• "Como tá o projeto X?"

📊 *Relatórios*
• "Resumo da semana"
• "Relatório do mês"

✏️ *Atualizar*
• "Move o card X pra coluna aprovado"
• "Muda prioridade do card Y pra urgente"

💡 *Dicas*
• Seja específico: inclua título, prioridade, data
• Posso entender datas: "amanhã", "sexta", "dia 15"
• Marcas: LA Music (padrão) ou LA Kids`
}
