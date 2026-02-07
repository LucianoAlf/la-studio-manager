// ============================================
// Audio Handler — WA-06
// Transcrição de áudio via UAZAPI (Whisper)
// ============================================
// A UAZAPI faz todo o trabalho pesado:
// POST /message/download com transcribe: true
// → retorna texto transcrito via Whisper
// ============================================

export interface TranscribeAudioParams {
  serverUrl: string       // UAZAPI_SERVER_URL
  token: string           // UAZAPI_TOKEN
  messageId: string       // messageid do webhook (hash hex)
  openaiApiKey: string    // OPENAI_API_KEY — UAZAPI usa para chamar Whisper
  durationSeconds?: number | null // duração do áudio (do payload)
}

export interface AudioResult {
  success: boolean
  transcription: string | null
  duration_seconds: number | null
  file_url: string | null
  mime_type: string | null
  error?: string
}

/**
 * Transcreve áudio via UAZAPI usando Whisper.
 * Um único POST /message/download com transcribe: true
 * retorna o texto transcrito — sem necessidade de baixar,
 * converter ou chamar Whisper manualmente.
 */
export async function transcribeAudio(params: TranscribeAudioParams): Promise<AudioResult> {
  const { serverUrl, token, messageId, openaiApiKey, durationSeconds } = params

  try {
    console.log(`[WA-06] Transcribing audio: ${messageId}`)

    const response = await fetch(`${serverUrl}/message/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        id: messageId,
        transcribe: true,
        openai_apikey: openaiApiKey,
        return_base64: false,
        return_link: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WA-06] UAZAPI download error (${response.status}):`, errorText)
      return {
        success: false,
        transcription: null,
        duration_seconds: durationSeconds || null,
        file_url: null,
        mime_type: null,
        error: `UAZAPI error ${response.status}: ${errorText.substring(0, 200)}`,
      }
    }

    const data = await response.json()
    console.log(`[WA-06] UAZAPI response keys: ${Object.keys(data).join(', ')}`)

    const transcription = data.transcription || null
    const fileUrl = data.fileURL || null
    const mimeType = data.mimetype || null

    if (!transcription) {
      console.warn('[WA-06] No transcription returned — audio may be empty or too short')
      return {
        success: false,
        transcription: null,
        duration_seconds: durationSeconds || null,
        file_url: fileUrl,
        mime_type: mimeType,
        error: 'Transcrição vazia — áudio pode estar vazio ou muito curto',
      }
    }

    console.log(`[WA-06] Transcription (${transcription.length} chars): ${transcription.substring(0, 100)}...`)

    return {
      success: true,
      transcription,
      duration_seconds: durationSeconds || null,
      file_url: fileUrl,
      mime_type: mimeType,
    }
  } catch (error) {
    console.error('[WA-06] Audio transcription fatal error:', error)
    return {
      success: false,
      transcription: null,
      duration_seconds: durationSeconds || null,
      file_url: null,
      mime_type: null,
      error: `Fatal: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
