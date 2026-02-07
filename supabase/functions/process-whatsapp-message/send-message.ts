// ============================================
// Send Message — UAZAPI Integration
// ============================================

interface SendTextParams {
  serverUrl: string    // https://lamusic.uazapi.com
  token: string        // instance token
  to: string           // phone number or group JID
  text: string
  delay?: number       // delay em ms antes de enviar (simula digitando)
}

interface SendMediaParams extends SendTextParams {
  mediaUrl: string
  caption?: string
  mediaType: 'image' | 'audio' | 'document' | 'video'
}

/**
 * Envia mensagem de texto via UAZAPI
 * Docs: POST /send/text
 */
export async function sendTextMessage(params: SendTextParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { serverUrl, token, to, text, delay = 500 } = params

  try {
    const number = to.includes('@') ? to : to // UAZAPI aceita número puro ou JID

    const response = await fetch(`${serverUrl}/send/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number,
        text,
        delay,
        linkPreview: false,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[WA] Send error:', data)
      return { success: false, error: JSON.stringify(data) }
    }

    console.log(`[WA] Message sent to ${to}: ${text.substring(0, 50)}...`)
    return { 
      success: true, 
      messageId: data?.id || data?.messageid || data?.messageId 
    }
  } catch (error) {
    console.error('[WA] Send fatal error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Envia mídia via UAZAPI
 * Docs: POST /send/media
 */
export async function sendMediaMessage(params: SendMediaParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { serverUrl, token, to, mediaUrl, caption, mediaType, delay = 500 } = params

  try {
    const number = to.includes('@') ? to : to

    const response = await fetch(`${serverUrl}/send/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number,
        url: mediaUrl,
        type: mediaType,
        caption: caption || '',
        delay,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[WA] Send media error:', data)
      return { success: false, error: JSON.stringify(data) }
    }

    return { 
      success: true, 
      messageId: data?.id || data?.messageid 
    }
  } catch (error) {
    console.error('[WA] Send media fatal error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Envia indicador "digitando..." via UAZAPI
 * Docs: POST /message/presence
 * Tipos: composing (digitando), recording (gravando áudio), paused (cancelar)
 * O delay no /send/text já simula "digitando" antes de enviar,
 * mas esta função permite controle independente (ex: enquanto Gemini processa).
 */
export async function sendTypingIndicator(params: { 
  serverUrl: string; 
  token: string; 
  to: string;
  duration?: number; 
}): Promise<void> {
  const { serverUrl, token, to, duration = 3000 } = params

  try {
    await fetch(`${serverUrl}/message/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number: to,
        presence: 'composing',
        delay: duration,
      }),
    })
  } catch (error) {
    // Não-crítico, apenas log
    console.warn('[WA] Typing indicator error:', error)
  }
}
