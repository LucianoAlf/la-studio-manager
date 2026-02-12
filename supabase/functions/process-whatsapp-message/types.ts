// ============================================
// Types — WhatsApp Agent
// ============================================

// Formato REAL do payload UAZAPI (flat, descoberto em produção)
export interface WebhookPayload {
  BaseUrl?: string
  EventType?: string
  chatSource?: string
  instanceName?: string
  owner?: string
  token?: string
  chat?: {
    id?: string
    wa_chatid?: string
    wa_name?: string
    name?: string
    phone?: string
    wa_isGroup?: boolean
  }
  message?: {
    id?: string
    text?: string
    content?: string
    type?: string
    chatid?: string
    fromMe?: boolean
    sender?: string
    sender_pn?: string
    senderName?: string
    messageid?: string
    messageType?: string
    messageTimestamp?: number
    isGroup?: boolean
    mediaType?: string
    mediaUrl?: string
    wasSentByApi?: boolean
    groupName?: string
  }
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
  durationSeconds: number | null // WA-06: duração do áudio em segundos
}

export interface UserInfo {
  profile_id: string      // PK de user_profiles → usar em tabelas whatsapp_*
  auth_user_id: string    // FK auth.users → usar em kanban_cards, calendar_items, etc.
  full_name: string
  display_name: string | null  // Nome de exibição (ex: "Alf" em vez de "Luciano")
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
  groupContext?: string  // WA-06.7: Contexto da conversa recente do grupo (injetado no NLP)
  groupJid?: string      // WA-06.8: JID do grupo de origem (para notificações no grupo)
}

export interface MessageResponse {
  text: string | null
  intent: string | null
  confidence: number | null
  metadata?: Record<string, unknown>
}

// ============================================
// WA-04: Tipos de Memória (referência)
// Os tipos canônicos estão em memory-manager.ts.
// ============================================
export interface MemoryContextRef {
  recent_episodes: Array<{
    summary: string; outcome: string; entities: Record<string, any>
    importance: number; created_at: string
  }>
  user_facts: Array<{
    category: string; fact: string; metadata: Record<string, any>
    confidence: number; reinforcement_count: number; user_confirmed: boolean
  }>
  team_knowledge: Array<{
    category: string; fact: string; scope: string | null
    metadata: Record<string, any>; is_verified: boolean
  }>
  retrieved_at: string
}
