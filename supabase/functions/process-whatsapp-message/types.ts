// ============================================
// Types — WhatsApp Agent
// ============================================

export interface WebhookPayload {
  event?: string
  instance?: string
  data?: {
    from?: string
    message?: {
      type?: string
      text?: string
      caption?: string
      url?: string
      conversation?: string
      extendedTextMessage?: { text?: string }
      imageMessage?: { caption?: string; url?: string }
      audioMessage?: { url?: string }
      documentMessage?: { caption?: string; fileName?: string; url?: string }
      videoMessage?: { caption?: string; url?: string }
      stickerMessage?: Record<string, unknown>
    }
    messageTimestamp?: number
    key?: {
      id?: string
      remoteJid?: string
      fromMe?: boolean
      participant?: string
    }
    pushName?: string
    mediaUrl?: string
    sender?: string
  }
  // UAZAPI v2 format alternativo
  type?: string
  from?: string
  body?: string
  isGroup?: boolean
  sender?: string
  messageId?: string
  mediaUrl?: string
  chatid?: string
}

export interface ParsedMessage {
  from: string           // phone number
  text: string | null    // message text
  type: string           // 'text' | 'audio' | 'image' | etc
  mediaUrl: string | null
  messageId: string | null
  isGroup: boolean
  groupJid: string | null
  senderInGroup: string | null // quem mandou no grupo
  timestamp: number
  pushName: string | null
}

export interface UserInfo {
  profile_id: string      // PK de user_profiles → usar em tabelas whatsapp_*
  auth_user_id: string    // FK auth.users → usar em kanban_cards, calendar_items, etc.
  full_name: string
  avatar_url: string | null
  role: string
  phone_number: string
}

export interface WhatsAppMessage {
  id: string
  user_id: string | null
  phone_number: string
  direction: 'inbound' | 'outbound'
  message_type: string
  content: string | null
  media_url: string | null
  processing_status: string
  intent_detected: string | null
  intent_confidence: number | null
  response_text: string | null
  is_group_message: boolean
  group_jid: string | null
  uazapi_message_id: string | null
  created_at: string
}

export interface RouteMessageParams {
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>
  user: UserInfo
  message: WhatsAppMessage
  parsed: ParsedMessage
  uazapiUrl: string
  uazapiToken: string
}

export interface MessageResponse {
  text: string | null
  intent: string | null
  confidence: number | null
  metadata?: Record<string, unknown>
}
