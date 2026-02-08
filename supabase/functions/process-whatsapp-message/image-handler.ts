// ============================================
// Image Handler — WA-06
// Análise de imagem via UAZAPI + Gemini 3 Flash Preview
// ============================================
// Fluxo:
// 1. UAZAPI /message/download com return_base64: true → base64
// 2. Gemini 3 Flash Preview analisa a imagem (Vision)
// 3. Retorna descrição + ação sugerida + entidades
// ============================================

export interface AnalyzeImageParams {
  serverUrl: string       // UAZAPI_SERVER_URL
  token: string           // UAZAPI_TOKEN
  geminiKey: string       // GEMINI_API_KEY
  messageId: string       // ID da mensagem na UAZAPI
  caption?: string | null // legenda da imagem (se houver)
  userName: string        // nome do usuário para contexto
}

export interface ImageResult {
  success: boolean
  description: string | null
  suggested_action: string | null
  suggested_entities: Record<string, unknown> | null
  file_url: string | null
  mime_type: string | null
  error?: string
}

// System prompt contextualizado para LA Music Studio
const VISION_SYSTEM_PROMPT = `Você é o assistente de IA do LA Studio Manager, uma plataforma de gestão do marketing da LA Music.

Ao analisar imagens recebidas via WhatsApp, considere o contexto de produção de conteúdo:
- Fotos de gravações, bastidores, equipamentos
- Screenshots de redes sociais (métricas, posts, stories)
- Referências visuais para conteúdo (moodboards, inspirações)
- Comprovantes, documentos, contratos
- Fotos de produtos, cenários, locações

Regras:
- Se a imagem é claramente uma referência de conteúdo → suggested_action: "create_card"
- Se parece um agendamento/evento/reunião → suggested_action: "create_calendar"
- Se é informativa mas não requer ação → suggested_action: "general_info"
- Se não conseguir identificar → suggested_action: "none"
- Seja conciso na descrição (máx 200 caracteres, texto puro, sem JSON)
- confidence < 0.5 → suggested_action: "none"
- IMPORTANTE: Se a imagem contém data, horário, local ou nomes de pessoas, EXTRAIA nos campos date, time, location e people de suggested_entities
- Converta horários para formato HH:MM (ex: "10H" → "10:00", "15h30" → "15:30")
- Converta datas relativas para YYYY-MM-DD quando possível, ou use termos como "amanhã", "sexta"`

// Schema JSON forçado via responseJsonSchema — garante JSON limpo do Gemini
const VISION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    description: {
      type: 'string',
      description: 'Descrição curta e objetiva da imagem em texto puro (máx 200 chars)',
    },
    suggested_action: {
      type: 'string',
      enum: ['create_card', 'create_calendar', 'general_info', 'none'],
      description: 'Ação sugerida baseada no conteúdo da imagem',
    },
    confidence: {
      type: 'number',
      description: 'Nível de confiança de 0.0 a 1.0',
    },
    suggested_entities: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título sugerido se for criar algo' },
        date: { type: 'string', description: 'Data se mencionada na imagem (formato YYYY-MM-DD ou relativo: hoje, amanhã, sexta). Calcule a partir da data atual.' },
        time: { type: 'string', description: 'Horário se mencionado na imagem (formato HH:MM 24h). Ex: "10H" → "10:00", "15h30" → "15:30"' },
        location: { type: 'string', description: 'Local se mencionado na imagem' },
        people: { type: 'string', description: 'Pessoas mencionadas (nomes separados por vírgula)' },
        calendar_type: { type: 'string', enum: ['event', 'meeting', 'task', 'delivery', 'creation'], description: 'Tipo de evento para o calendário' },
        content_type: { type: 'string', description: 'video, carousel, reels, story, photo' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        notes: { type: 'string', description: 'Observações adicionais' },
      },
      required: ['title'],
    },
  },
  required: ['description', 'suggested_action', 'confidence'],
}

/**
 * Analisa imagem via UAZAPI (download base64) + Gemini 3 Flash Preview.
 */
export async function analyzeImage(params: AnalyzeImageParams): Promise<ImageResult> {
  const { serverUrl, token, geminiKey, messageId, caption, userName } = params

  try {
    console.log(`[WA-06] Analyzing image: ${messageId}${caption ? ` (caption: ${caption.substring(0, 50)})` : ''}`)

    // ========================================
    // 1. Baixar imagem como base64 via UAZAPI
    // ========================================
    const downloadResponse = await fetch(`${serverUrl}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        id: messageId,
        return_base64: true,
        return_link: true,
      }),
    })

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text()
      console.error(`[WA-06] UAZAPI image download error (${downloadResponse.status}):`, errorText)
      return {
        success: false,
        description: null,
        suggested_action: null,
        suggested_entities: null,
        file_url: null,
        mime_type: null,
        error: `UAZAPI error ${downloadResponse.status}: ${errorText.substring(0, 200)}`,
      }
    }

    const downloadData = await downloadResponse.json()
    const base64Data = downloadData.base64Data || null
    const fileUrl = downloadData.fileURL || null
    const mimeType = downloadData.mimetype || 'image/jpeg'

    if (!base64Data) {
      console.error('[WA-06] No base64 data returned from UAZAPI')
      return {
        success: false,
        description: null,
        suggested_action: null,
        suggested_entities: null,
        file_url: fileUrl,
        mime_type: mimeType,
        error: 'UAZAPI não retornou base64 da imagem',
      }
    }

    console.log(`[WA-06] Image downloaded: ${mimeType}, base64 length: ${base64Data.length}`)

    // ========================================
    // 2. Enviar para Gemini 3 Flash Preview
    // ========================================
    const userPrompt = caption
      ? `${userName} enviou esta imagem com a legenda: "${caption}". Analise a imagem considerando a legenda.`
      : `${userName} enviou esta imagem sem legenda. Analise e descreva o que vê.`

    const visionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { text: userPrompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
            responseJsonSchema: VISION_JSON_SCHEMA,
          },
        }),
      }
    )

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text()
      console.error(`[WA-06] Gemini Vision error (${visionResponse.status}):`, errorText)
      return {
        success: false,
        description: null,
        suggested_action: null,
        suggested_entities: null,
        file_url: fileUrl,
        mime_type: mimeType,
        error: `Gemini error ${visionResponse.status}: ${errorText.substring(0, 200)}`,
      }
    }

    const visionData = await visionResponse.json()
    const rawContent = visionData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    console.log(`[WA-06] Gemini Vision response: ${rawContent.substring(0, 200)}`)

    // ========================================
    // 3. Parse da resposta JSON (com fallback)
    // ========================================
    const analysis = parseVisionResponse(rawContent)

    return {
      success: true,
      description: analysis.description,
      suggested_action: analysis.suggested_action,
      suggested_entities: analysis.suggested_entities,
      file_url: fileUrl,
      mime_type: mimeType,
    }
  } catch (error) {
    console.error('[WA-06] Image analysis fatal error:', error)
    return {
      success: false,
      description: null,
      suggested_action: null,
      suggested_entities: null,
      file_url: null,
      mime_type: null,
      error: `Fatal: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Parse robusto da resposta do Gemini Vision com 3 tentativas de fallback.
 * 1. JSON direto (quando responseMimeType funciona)
 * 2. Limpar markdown code fences
 * 3. Extrair primeiro bloco JSON com regex
 */
function parseVisionResponse(raw: string): {
  description: string
  suggested_action: string
  suggested_entities: Record<string, unknown> | null
} {
  // deno-lint-ignore no-explicit-any
  let parsed: any = null

  // Tentativa 1: JSON direto (responseMimeType: application/json)
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Tentativa 2: Limpar markdown code fences
    const cleaned = raw
      .replace(/```(?:json|JSON)?\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim()
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Tentativa 3: Extrair primeiro bloco JSON com regex
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0])
        } catch {
          console.error('[WA-06] Todas as tentativas de parse falharam')
        }
      }
    }
  }

  if (parsed && parsed.description) {
    return {
      description: String(parsed.description).substring(0, 300),
      suggested_action: parsed.suggested_action || 'none',
      suggested_entities: parsed.suggested_entities || null,
    }
  }

  // Fallback total: texto limpo sem JSON
  console.warn('[WA-06] Parse falhou, usando texto bruto como descrição')
  const cleanText = raw
    .replace(/```(?:json|JSON)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/[{}"\[\]]/g, '')
    .replace(/\n/g, ' ')
    .trim()
  return {
    description: cleanText.substring(0, 300) || 'Imagem recebida',
    suggested_action: 'none',
    suggested_entities: null,
  }
}
