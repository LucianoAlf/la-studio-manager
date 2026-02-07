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

Responda SEMPRE em JSON válido com esta estrutura:
{
  "description": "Descrição objetiva do que aparece na imagem",
  "suggested_action": "create_card | create_calendar | general_info | none",
  "suggested_entities": {
    "title": "título sugerido se for criar algo",
    "content_type": "video | carousel | reels | story | photo | null",
    "priority": "urgent | high | medium | low | null",
    "notes": "observações relevantes"
  },
  "confidence": 0.0 a 1.0
}

Regras:
- Se a imagem é claramente uma referência de conteúdo → suggested_action: "create_card"
- Se parece um agendamento/evento → suggested_action: "create_calendar"
- Se é informativa mas não requer ação → suggested_action: "general_info"
- Se não conseguir identificar → suggested_action: "none"
- Seja conciso na descrição (máx 200 caracteres)
- confidence < 0.5 → suggested_action: "none"`

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`,
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
 * Parse da resposta do Vision com fallback robusto.
 * O Gemini pode retornar JSON puro ou envolvido em markdown.
 */
function parseVisionResponse(raw: string): {
  description: string
  suggested_action: string
  suggested_entities: Record<string, unknown> | null
} {
  try {
    // Tentar extrair JSON de dentro de markdown ```json ... ```
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim()

    const parsed = JSON.parse(jsonStr)
    return {
      description: parsed.description || 'Imagem recebida',
      suggested_action: parsed.suggested_action || 'none',
      suggested_entities: parsed.suggested_entities || null,
    }
  } catch {
    // Fallback: usar texto bruto como descrição
    console.warn('[WA-06] Failed to parse Vision JSON, using raw text as description')
    return {
      description: raw.substring(0, 300),
      suggested_action: 'none',
      suggested_entities: null,
    }
  }
}
